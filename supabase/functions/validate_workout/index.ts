import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const MAX_BATCH = 50;
const MAX_EVIDENCE_BYTES = 64_000;
const MAX_REPS = 1000;
const MAX_SECONDS = 900;
const MIN_MS_PER_REP = 350;
const MIN_CADENCE_SEC = 2;
// Versiones de evidencia soportadas. La versión llega en la URL de la cámara
// (?v=) y en buildVerifyUri; solo se aceptan versiones explícitas para evitar
// downgrade o versiones inventadas.
const ALLOWED_EVIDENCE_VERSIONS = new Set([12]);
const GOALS = ['perder_grasa', 'ganar_musculo', 'mantener'] as const;
type Goal = (typeof GOALS)[number];

const EXERCISE_ORDER: Record<Goal, string[]> = {
  perder_grasa: [
    'sentadillas',
    'mountain_climbers',
    'plancha',
    'zancadas',
    'flexiones',
    'sentadilla_isometrica',
    'puente_gluteo',
  ],
  ganar_musculo: [
    'flexiones',
    'sentadillas',
    'zancadas',
    'puente_gluteo',
    'plancha',
    'sentadilla_isometrica',
    'mountain_climbers',
  ],
  mantener: [
    'sentadillas',
    'plancha',
    'flexiones',
    'zancadas',
    'puente_gluteo',
    'mountain_climbers',
    'sentadilla_isometrica',
  ],
};

const DEFAULT_TARGETS: Record<string, number> = {
  sentadillas: 20,
  flexiones: 10,
  plancha: 30,
  zancadas: 24,
  puente_gluteo: 15,
  mountain_climbers: 30,
  sentadilla_isometrica: 25,
};

const TARGET_MULTIPLIER: Record<Goal, number> = {
  perder_grasa: 1.2,
  ganar_musculo: 1.1,
  mantener: 1,
};

const EXERCISE_UNITS: Record<string, 'reps' | 'seconds'> = {
  sentadillas: 'reps',
  flexiones: 'reps',
  plancha: 'seconds',
  zancadas: 'reps',
  puente_gluteo: 'reps',
  mountain_climbers: 'seconds',
  sentadilla_isometrica: 'seconds',
};

type Exercise = { code: string; id: string; measurement_type: 'reps' | 'seconds' };

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

type IncomingCompletion = {
  clientOpId: string;
  challengeDate: string;
  exerciseCode: string;
  value: number;
  target: number;
  goal: 'perder_grasa' | 'ganar_musculo' | 'mantener';
  unit?: 'reps' | 'seconds';
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

function unitLimit(unit: string): number {
  return unit === 'reps' ? MAX_REPS : MAX_SECONDS;
}

async function sha256Hex(input: string): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'na';
  }
}

// ---------------------------------------------------------------------------
// Reto diario determinista: el servidor calcula el ejercicio, objetivo y
// unidad esperados para (fecha, objetivo) con el MISMO algoritmo de la app.
// El cliente ya no define ni ejercicio ni target.
// ---------------------------------------------------------------------------
function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

function expectedChallenge(
  dateKey: string,
  goal: string,
): { exerciseCode: string; target: number; unit: 'reps' | 'seconds' } | null {
  if (!isDateKey(dateKey)) return null;
  if (!(GOALS as readonly string[]).includes(goal)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  const ids = EXERCISE_ORDER[goal as Goal];
  const index = (isoWeekNumber(parsed) + isoWeekday(parsed)) % ids.length;
  const exerciseId = ids[index];
  const base = DEFAULT_TARGETS[exerciseId] ?? 10;
  return {
    exerciseCode: exerciseId,
    target: Math.round(base * TARGET_MULTIPLIER[goal as Goal]),
    unit: EXERCISE_UNITS[exerciseId] ?? 'reps',
  };
}

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Ventana de fecha aceptada: hoy o ayer (UTC) para tolerar zonas horarias.
function challengeDateInWindow(dateKey: string): boolean {
  const now = new Date();
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  const min = yesterday.toISOString().slice(0, 10);
  const max = todayUtcKey();
  return dateKey >= min && dateKey <= max;
}

// La evidencia sirve como registro y filtro de datos imposibles, no como
// prueba criptográfica. Hasta que exista un validador real (video/attestation
// server-side), ninguna propuesta se aprueba: TODO queda pending.
function evidenceIssue(
  evidence: Record<string, unknown> | undefined,
  value: number,
  unit: string,
  ranked: boolean,
): string | null {
  if (evidence === undefined) return ranked ? 'missing_evidence' : null;
  if (!isRecord(evidence)) return 'invalid_evidence';

  const version = evidence.verifyVersion;
  if (!isInt(version) || !ALLOWED_EVIDENCE_VERSIONS.has(version)) {
    return 'unsupported_evidence_version';
  }

  const duration = evidence.durationMs;
  if (!isInt(duration) || duration < 0) return 'invalid_duration';

  const startedAt = evidence.startedAt;
  const finishedAt = evidence.finishedAt;
  if (!isInt(startedAt) || !isInt(finishedAt) || finishedAt < startedAt) {
    return 'invalid_timestamps';
  }

  const minDurationMs = unit === 'reps' ? value * MIN_MS_PER_REP : value * 1000;
  if (duration < minDurationMs) return 'impossible_duration';

  if (unit === 'reps') {
    const cadence = evidence.cadenceSec;
    if (
      typeof cadence === 'number' &&
      Number.isFinite(cadence) &&
      cadence > 0 &&
      cadence < MIN_CADENCE_SEC
    ) {
      return 'impossible_cadence';
    }
  }

  if (ranked && evidence.livenessRequired === true && evidence.livenessPassed !== true) {
    return 'liveness_failed';
  }

  return null;
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

function validateCompletion(
  item: unknown,
  exercises: Map<string, Exercise>,
): { value: IncomingCompletion; error?: string } {
  if (!isRecord(item)) return { value: {} as IncomingCompletion, error: 'invalid_completion' };

  const goal = item.goal;
  const value: IncomingCompletion = {
    clientOpId: String(item.clientOpId ?? ''),
    challengeDate: String(item.challengeDate ?? ''),
    exerciseCode: String(item.exerciseCode ?? ''),
    value: Number(item.value),
    target: Number(item.target),
    goal: goal as IncomingCompletion['goal'],
    unit: item.unit === 'seconds' ? 'seconds' : item.unit === 'reps' ? 'reps' : undefined,
    evidence: item.evidence as Record<string, unknown> | undefined,
  };

  if (value.clientOpId.length < 1 || value.clientOpId.length > 128) {
    return { value, error: 'invalid_client_op_id' };
  }
  if (!isDateKey(value.challengeDate)) return { value, error: 'invalid_challenge_date' };
  if (!exercises.has(value.exerciseCode)) return { value, error: 'invalid_exercise' };
  if (!isInt(value.value) || value.value < 1 || value.value > 7200) {
    return { value, error: 'invalid_value' };
  }
  if (!isInt(value.target) || value.target < 1 || value.target > 7200) {
    return { value, error: 'invalid_target' };
  }
  if (!(GOALS as readonly string[]).includes(value.goal)) {
    return { value, error: 'invalid_goal' };
  }
  if (!evidenceWithinLimit(value.evidence)) return { value, error: 'evidence_too_large' };

  return { value };
}

function uniqueCompletions(items: IncomingCompletion[]): IncomingCompletion[] {
  const byClientOp = new Map<string, IncomingCompletion>();
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

  const rawSessions = isRecord(body) && Array.isArray(body.sessions) ? body.sessions : [];
  const rawCompletions = isRecord(body) && Array.isArray(body.completions) ? body.completions : [];
  if (
    rawSessions.length + rawCompletions.length < 1 ||
    rawSessions.length + rawCompletions.length > MAX_BATCH
  ) {
    return response({ error: 'invalid_batch' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const exerciseCodes = [
    ...new Set(
      [...rawSessions, ...rawCompletions]
        .filter(isRecord)
        .map((item) => String(item.exerciseCode ?? ''))
        .filter(Boolean),
    ),
  ];
  const { data: exerciseRows, error: exerciseError } = await admin
    .from('exercises')
    .select('id, code, measurement_type')
    .in('code', exerciseCodes);
  if (exerciseError) return response({ error: 'catalog_unavailable' }, 503);

  const exercises = new Map<string, Exercise>(
    (exerciseRows ?? []).map((row) => [row.code, row as Exercise]),
  );
  const parsed = rawSessions.map((item) => validateSubmission(item, exercises));
  const invalid = parsed.filter((item) => item.error);
  const valid = uniqueSubmissions(parsed.filter((item) => !item.error).map((item) => item.value));
  const parsedCompletions = rawCompletions.map((item) => validateCompletion(item, exercises));
  const invalidCompletions = parsedCompletions.filter((item) => item.error);
  const validCompletions = uniqueCompletions(
    parsedCompletions.filter((item) => !item.error).map((item) => item.value),
  );

  // ---------------------------------------------------------------------------
  // Sesiones libres: SIEMPRE pending. Hasta que exista un validador real,
  // ninguna propuesta se aprueba ni escribe workout_sessions. Las propuestas
  // se guardan con su evidencia para auditoría y futura revisión manual.
  // ---------------------------------------------------------------------------
  const sessionRows: Record<string, unknown>[] = [];
  let sessionsRejected = 0;
  let sessionsPending = 0;

  for (const item of valid) {
    const unit = exercises.get(item.exerciseCode)?.measurement_type ?? 'reps';
    let status = 'pending';
    let reason = 'awaiting_server_validator';

    if (item.value > unitLimit(unit) || item.target > unitLimit(unit)) {
      status = 'rejected';
      reason = 'value_out_of_bounds';
    } else if (item.ranked) {
      if (item.livenessOk !== true) {
        status = 'rejected';
        reason = 'liveness_required';
      } else {
        const issue = evidenceIssue(item.evidence, item.value, unit, true);
        if (issue === 'missing_evidence') {
          status = 'pending';
          reason = 'missing_evidence';
        } else if (issue !== null) {
          status = 'rejected';
          reason = issue;
        }
      }
    }

    if (status === 'rejected') {
      sessionsRejected++;
    } else {
      sessionsPending++;
    }

    sessionRows.push({
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
      verification_status: status,
      verification_reason: reason,
      evidence: item.evidence ?? {},
      evidence_hash: await sha256Hex(JSON.stringify(item.evidence ?? {})),
      verification_version: String(
        isRecord(item.evidence) && isInt(item.evidence.verifyVersion)
          ? item.evidence.verifyVersion
          : 1,
      ),
    });
  }

  if (sessionRows.length > 0) {
    const { error: insertError } = await admin
      .from('workout_submissions')
      .upsert(sessionRows, { onConflict: 'user_id,client_op_id', ignoreDuplicates: true });
    if (insertError) return response({ error: 'submission_storage_failed' }, 503);
  }

  // ---------------------------------------------------------------------------
  // Retos diarios: SIEMPRE pending. El servidor deriva el reto esperado y
  // rechaza propuestas que no coincidan (fecha fuera de ventana, ejercicio,
  // objetivo o unidad incorrectos). No escribe daily_challenges.
  // ---------------------------------------------------------------------------
  const completionRows: Record<string, unknown>[] = [];
  let completionsRejected = 0;
  let completionsPending = 0;

  for (const item of validCompletions) {
    const exercise = exercises.get(item.exerciseCode);
    const unit = exercise?.measurement_type ?? 'reps';
    let status = 'pending';
    let reason = 'awaiting_server_validator';

    if (!challengeDateInWindow(item.challengeDate)) {
      status = 'rejected';
      reason = 'challenge_date_out_of_window';
    } else if (item.value > unitLimit(unit) || item.target > unitLimit(unit)) {
      status = 'rejected';
      reason = 'value_out_of_bounds';
    } else {
      const expected = expectedChallenge(item.challengeDate, item.goal);
      if (
        expected === null ||
        expected.exerciseCode !== item.exerciseCode ||
        expected.target !== item.target ||
        expected.unit !== unit ||
        item.unit !== unit
      ) {
        status = 'rejected';
        reason = 'challenge_mismatch';
      } else if (item.value < item.target) {
        status = 'pending';
        reason = 'target_not_met';
      } else {
        const issue = evidenceIssue(item.evidence, item.value, unit, true);
        if (issue === 'missing_evidence') {
          status = 'pending';
          reason = issue;
        } else if (issue !== null) {
          status = 'rejected';
          reason = issue;
        }
      }
    }

    if (status === 'rejected') {
      completionsRejected++;
    } else {
      completionsPending++;
    }

    completionRows.push({
      user_id: userData.user.id,
      client_op_id: item.clientOpId,
      challenge_date: item.challengeDate,
      exercise_code: item.exerciseCode,
      client_value: item.value,
      client_target: item.target,
      goal_requested: item.goal,
      verification_status: status,
      verification_reason: reason,
      evidence: item.evidence ?? {},
      evidence_hash: await sha256Hex(JSON.stringify(item.evidence ?? {})),
      verification_version: String(
        isRecord(item.evidence) && isInt(item.evidence.verifyVersion)
          ? item.evidence.verifyVersion
          : 1,
      ),
    });
  }

  if (completionRows.length > 0) {
    const { error: insertError } = await admin
      .from('daily_challenge_submissions')
      .upsert(completionRows, { onConflict: 'user_id,challenge_date', ignoreDuplicates: true });
    if (insertError) return response({ error: 'completion_storage_failed' }, 503);
  }

  const pendingCount = sessionsPending + completionsPending;
  const rejectedCount =
    invalid.length + invalidCompletions.length + sessionsRejected + completionsRejected;

  return response({
    received: valid.length + validCompletions.length,
    verified: 0,
    pending: pendingCount,
    rejected: rejectedCount,
    completionReceived: validCompletions.length,
    completionPending: completionsPending,
    completionVerified: 0,
    message:
      'Todas las propuestas quedan en revisión (pending). El ranking se reabre solo cuando exista un validador server-side real.',
  });
});
