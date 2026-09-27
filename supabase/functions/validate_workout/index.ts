import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const MAX_BATCH = 50;
const MAX_EVIDENCE_BYTES = 64_000;

type Exercise = { code: string; measurement_type: 'reps' | 'seconds' };

type IncomingSubmission = {
  clientOpId: string;
  exerciseCode: string;
  value: number;
  target: number;
  source?: 'reto_diario' | 'libre';
  ranked?: boolean;
  seriesOk?: boolean;
  livenessOk?: boolean;
  sessionDate: string;
  evidence?: Record<string, unknown>;
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function evidenceWithinLimit(evidence: unknown): evidence is Record<string, unknown> {
  if (evidence === undefined) return true;
  if (!isRecord(evidence)) return false;
  return JSON.stringify(evidence).length <= MAX_EVIDENCE_BYTES;
}

function validateSubmission(
  item: unknown,
  exercises: Map<string, Exercise>,
): { value: IncomingSubmission; error?: string } {
  if (!isRecord(item)) return { value: {} as IncomingSubmission, error: 'invalid_submission' };

  const value: IncomingSubmission = {
    clientOpId: String(item.clientOpId ?? ''),
    exerciseCode: String(item.exerciseCode ?? ''),
    value: Number(item.value),
    target: Number(item.target),
    source: item.source === 'reto_diario' ? 'reto_diario' : 'libre',
    ranked: item.ranked === true,
    seriesOk: item.seriesOk === true,
    livenessOk: item.livenessOk === true,
    sessionDate: String(item.sessionDate ?? ''),
    evidence: item.evidence as Record<string, unknown> | undefined,
  };

  if (value.clientOpId.length < 1 || value.clientOpId.length > 128) {
    return { value, error: 'invalid_client_op_id' };
  }
  if (!exercises.has(value.exerciseCode)) return { value, error: 'invalid_exercise' };
  if (!isInt(value.value) || value.value < 1 || value.value > 7200) {
    return { value, error: 'invalid_value' };
  }
  if (!isInt(value.target) || value.target < 1 || value.target > 7200) {
    return { value, error: 'invalid_target' };
  }
  if (!isDateKey(value.sessionDate)) return { value, error: 'invalid_session_date' };
  if (!evidenceWithinLimit(value.evidence)) return { value, error: 'evidence_too_large' };

  return { value };
}

function uniqueSubmissions(items: IncomingSubmission[]): IncomingSubmission[] {
  const byClientOp = new Map<string, IncomingSubmission>();
  for (const item of items) byClientOp.set(item.clientOpId, item);
  return [...byClientOp.values()];
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization?.startsWith('Bearer ')) {
    return response({ error: 'server_not_configured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return response({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: 'invalid_json' }, 400);
  }

  const rawSessions = isRecord(body) && Array.isArray(body.sessions) ? body.sessions : null;
  if (!rawSessions || rawSessions.length < 1 || rawSessions.length > MAX_BATCH) {
    return response({ error: 'invalid_batch' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const exerciseCodes = [
    ...new Set(
      rawSessions
        .filter(isRecord)
        .map((item) => String(item.exerciseCode ?? ''))
        .filter(Boolean),
    ),
  ];
  const { data: exerciseRows, error: exerciseError } = await admin
    .from('exercises')
    .select('code, measurement_type')
    .in('code', exerciseCodes);
  if (exerciseError) return response({ error: 'catalog_unavailable' }, 503);

  const exercises = new Map<string, Exercise>(
    (exerciseRows ?? []).map((row) => [row.code, row as Exercise]),
  );
  const parsed = rawSessions.map((item) => validateSubmission(item, exercises));
  const invalid = parsed.filter((item) => item.error);
  const valid = uniqueSubmissions(parsed.filter((item) => !item.error).map((item) => item.value));

  if (valid.length > 0) {
    const rows = valid.map((item) => ({
      user_id: userData.user.id,
      client_op_id: item.clientOpId,
      exercise_code: item.exerciseCode,
      client_value: item.value,
      client_target: item.target,
      source: item.source ?? 'libre',
      ranked_requested: item.ranked === true,
      series_ok_reported: item.seriesOk === true,
      liveness_ok_reported: item.livenessOk === true,
      session_date: item.sessionDate,
      verification_status: 'pending',
      verification_reason:
        item.ranked === true ? 'requires_server_evidence_validation' : 'recorded_without_ranking',
      evidence: item.evidence ?? {},
    }));

    const { error: insertError } = await admin
      .from('workout_submissions')
      .upsert(rows, { onConflict: 'user_id,client_op_id', ignoreDuplicates: true });
    if (insertError) return response({ error: 'submission_storage_failed' }, 503);
  }

  return response({
    received: valid.length,
    pending: valid.filter((item) => item.ranked === true).length,
    rejected: invalid.length,
    verified: 0,
    message: 'Las sesiones quedan pendientes de validación server-side y no alimentan el ranking.',
  });
});
