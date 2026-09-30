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
const MAX_CHALLENGE_AGE_DAYS = 365;
// Versiones de evidencia soportadas. La versión llega en la URL de la cámara
// (?v=) y en buildVerifyUri; solo se aceptan versiones explícitas para evitar
// downgrade o versiones inventadas.
const ALLOWED_EVIDENCE_VERSIONS = new Set([12, 13]);
const GOALS = ['perder_grasa', 'ganar_musculo', 'mantener'] as const;
type Goal = (typeof GOALS)[number];

// El título de sesión por ángulo del cuerpo NO cambia la rotación: desde
// FEATURE_DATE el reto diario gratuito rota solo entre el pool FREE. La misma
// fecha límite se define en apps/mobile/src/retos/catalog.ts.
const FEATURE_DATE = '2026-09-28';
const FEATURE_VERSION = 13;
const FREE_EXERCISE_ORDER: string[] = ['sentadillas', 'flexiones', 'abdominales'];

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
  abdominales: 15,
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
  abdominales: 'reps',
  plancha: 'seconds',
  zancadas: 'reps',
  puente_gluteo: 'reps',
  mountain_climbers: 'seconds',
  sentadilla_isometrica: 'seconds',
};

type Exercise = {
  code: string;
  id: string;
  measurement_type: 'reps' | 'seconds';
  tier: 'free' | 'premium';
};

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

type SubmissionResult = {
  clientOpId: string;
  status: 'accepted' | 'pending' | 'rejected';
  reason?: string;
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
// Desde FEATURE_DATE el ejercicio sale solo del pool FREE; antes conserva el
// algoritmo por objetivo para que las sincronizaciones tardías de retos
// antiguos sigan validando.
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
  const ids = dateKey >= FEATURE_DATE ? FREE_EXERCISE_ORDER : EXERCISE_ORDER[goal as Goal];
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

// Ventana de fecha aceptada: desde hoy hasta el límite offline de la app
// (UTC). No se aceptan fechas futuras.
function challengeDateInWindow(dateKey: string): boolean {
  const now = new Date();
  const minimumDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (MAX_CHALLENGE_AGE_DAYS - 1),
    ),
  );
  const min = minimumDate.toISOString().slice(0, 10);
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
  if (!challengeDateInWindow(value.sessionDate)) {
    return { value, error: 'session_date_out_of_window' };
  }
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

  // Entitlement del usuario (Fase B). Fail-closed: si la consulta falla se
  // trata como free; un premium SOLO corre cuando el servidor confirma un
  // entitlement activo ('premium' sin expirar). Es la ÚNICA puerta de premium.
  let hasPremium = false;
  try {
    const { data } = await admin.rpc('has_active_entitlement', {
      p_user: userData.user.id,
      p_key: 'premium',
    });
    hasPremium = data === true;
  } catch {
    hasPremium = false;
  }
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
    .select('id, code, measurement_type, tier')
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
  // Los elementos inválidos también se reportan por clientOpId para que el
  // cliente pueda marcar la operación rechazada (no reintentarla en loop).
  const invalidResults: SubmissionResult[] = invalid.map((item) => ({
    clientOpId: String(item.value.clientOpId ?? ''),
    status: 'rejected',
    reason: item.error ?? 'invalid_submission',
  }));
  const invalidCompletionResults: SubmissionResult[] = invalidCompletions.map((item) => ({
    clientOpId: String(item.value.clientOpId ?? ''),
    status: 'rejected',
    reason: item.error ?? 'invalid_completion',
  }));

  // ---------------------------------------------------------------------------
  // Tier (PLAN v4 / F0 + Fase B): el catálogo en la DB manda. Fail-closed:
  // SOLO se acepta el tier 'free' salvo que el servidor confirme un entitlement
  // activo (hasPremium). Como el default en la migración es 'premium', cualquier
  // ejercicio sin tier explícito queda rechazado (premium_required) para usuarios
  // sin entitlement. Los rechazos se reportan por elemento para que la cola
  // local no se borre silenciosamente.
  // ---------------------------------------------------------------------------
  function tierGate(exercise: Exercise, hasPremiumEntitlement: boolean): string | null {
    if (exercise.tier === 'free') return null;
    return hasPremiumEntitlement ? null : 'premium_required';
  }

  // ---------------------------------------------------------------------------
  // Sesiones libres: SIEMPRE pending. Hasta que exista un validador real,
  // ninguna propuesta se aprueba ni escribe workout_sessions. Las propuestas
  // se guardan con su evidencia para auditoría y futura revisión manual.
  // ---------------------------------------------------------------------------
  const sessionRows: Record<string, unknown>[] = [];
  const sessionResults: SubmissionResult[] = [];

  for (const item of valid) {
    const exercise = exercises.get(item.exerciseCode);
    const unit = exercise?.measurement_type ?? 'reps';
    let status: SubmissionResult['status'] = 'pending';
    let reason = 'awaiting_server_validator';

    const tierIssue = exercise ? tierGate(exercise, hasPremium) : 'invalid_exercise';
    if (tierIssue) {
      status = 'rejected';
      reason = tierIssue;
    } else if (item.value > unitLimit(unit) || item.target > unitLimit(unit)) {
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

    sessionResults.push({ clientOpId: item.clientOpId, status, reason });

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
    // server-authoritative: no re-escribir filas ya decididas. Si una propuesta
    // ya está verified, el veredicto es terminal (trigger 0015) y se conserva;
    // al cliente se le devuelve accepted (verified) en vez de re-evaluar.
    let existingDecided: Set<string> = new Set();
    try {
      const clientOpIds = [...new Set(sessionRows.map((r) => String(r.client_op_id)))];
      const { data: existing } = await admin
        .from('workout_submissions')
        .select('client_op_id, verification_status')
        .eq('user_id', userData.user.id)
        .in('client_op_id', clientOpIds);
      if (Array.isArray(existing)) {
        existingDecided = new Set(
          existing
            .filter((row) => row.verification_status === 'verified')
            .map((row) => String(row.client_op_id)),
        );
      }
    } catch {
      existingDecided = new Set();
    }
    const rowsToWrite = sessionRows.filter((r) => {
      const opId = String(r.client_op_id);
      if (existingDecided.has(opId)) {
        const result = sessionResults.find((res) => res.clientOpId === opId);
        if (result) {
          result.status = 'accepted';
          result.reason = 'already_verified';
        }
        return false;
      }
      return true;
    });
    if (rowsToWrite.length > 0) {
      const { error: insertError } = await admin
        .from('workout_submissions')
        .upsert(rowsToWrite, { onConflict: 'user_id,client_op_id' });
      if (insertError) return response({ error: 'submission_storage_failed' }, 503);
    }
  }

  // ---------------------------------------------------------------------------
  // Retos diarios: SIEMPRE pending. El servidor deriva el reto esperado desde
  // goal_history (el objetivo vigente para la fecha) y materializa la
  // asignación en daily_challenge_assignments como fuente de verdad. No
  // escribe daily_challenges. Los rechazos se reportan por elemento.
  // ---------------------------------------------------------------------------
  const completionRows: Record<string, unknown>[] = [];
  const completionResults: SubmissionResult[] = [];
  const completionDates = [...new Set(validCompletions.map((c) => c.challengeDate))].sort();

  // Objetivo vigente por fecha desde goal_history (server-side), como manda
  // la decisión F0. Si no hay historial para una fecha, se usa el actual del
  // perfil como fallback conservador.
  let effectiveGoals: Record<string, string> = {};
  try {
    const { data: history, error: historyError } = await admin
      .from('goal_history')
      .select('goal, valid_from, valid_until')
      .eq('user_id', userData.user.id)
      .lte('valid_from', completionDates[completionDates.length - 1] ?? todayUtcKey());
    if (!historyError && Array.isArray(history)) {
      for (const dateKey of completionDates) {
        const row = history
          .filter(
            (h) => h.valid_from <= dateKey && (h.valid_until === null || h.valid_until >= dateKey),
          )
          .sort(
            (a, b) =>
              String(b.valid_from).localeCompare(String(a.valid_from)) ||
              String(b.valid_until ?? '9999').localeCompare(String(a.valid_until ?? '9999')),
          )[0];
        if (row && (GOALS as readonly string[]).includes(String(row.goal))) {
          effectiveGoals[dateKey] = String(row.goal);
        }
      }
    }
  } catch {
    // Sin goal_history disponible se cae al fallback del perfil.
  }

  let profileGoal: string | null = null;
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('goal')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (profile && (GOALS as readonly string[]).includes(String(profile.goal))) {
      profileGoal = String(profile.goal);
    }
  } catch {
    profileGoal = null;
  }

  // La asignación server-side es la fuente de verdad (plan F0): si ya existe
  // una asignación materializada para una fecha, se respeta sin recalcular ni
  // sobrescribir. Solo se calcula e inserta cuando falta, y nunca se pisa una
  // existente (las asignaciones no cambian retroactivamente aunque el usuario
  // cambie su objetivo después).
  const assignmentByDate = new Map<string, string>();
  try {
    const { data: assignments } = await admin
      .from('daily_challenge_assignments')
      .select('challenge_date, exercise_code, target, unit, goal_snapshot')
      .eq('user_id', userData.user.id)
      .in('challenge_date', completionDates);
    if (Array.isArray(assignments)) {
      for (const row of assignments) {
        const key = String(row.challenge_date);
        if (!assignmentByDate.has(key)) {
          assignmentByDate.set(key, ''); // marca que ya existe
        }
      }
    }
  } catch {
    // Sin asignaciones consultables se cae al cálculo determinista.
  }

  for (const item of validCompletions) {
    const exercise = exercises.get(item.exerciseCode);
    const unit = exercise?.measurement_type ?? 'reps';
    let status: SubmissionResult['status'] = 'pending';
    let reason = 'awaiting_server_validator';

    const tierIssue = exercise ? tierGate(exercise, hasPremium) : 'invalid_exercise';
    if (tierIssue) {
      status = 'rejected';
      reason = tierIssue;
    } else if (!challengeDateInWindow(item.challengeDate)) {
      status = 'rejected';
      reason = 'challenge_date_out_of_window';
    } else if (item.value > unitLimit(unit) || item.target > unitLimit(unit)) {
      status = 'rejected';
      reason = 'value_out_of_bounds';
    } else {
      const hasAssignment = assignmentByDate.has(item.challengeDate);
      const serverGoal = effectiveGoals[item.challengeDate] ?? profileGoal;
      // Si la asignación ya existe, se valida contra ella (fuente de verdad):
      // ejercicio, target, unidad Y goal_snapshot (el objetivo con que se creó).
      // El goal_snapshot es autoritativo incluso si el usuario cambió su
      // objetivo después; goal_history solo se usa para crear la asignación.
      let expected: { exerciseCode: string; target: number; unit: 'reps' | 'seconds' } | null =
        null;
      let expectedGoal: string | null = null;
      if (hasAssignment) {
        try {
          const { data: existing } = await admin
            .from('daily_challenge_assignments')
            .select('exercise_code, target, unit, goal_snapshot')
            .eq('user_id', userData.user.id)
            .eq('challenge_date', item.challengeDate)
            .maybeSingle();
          if (existing) {
            expected = {
              exerciseCode: String(existing.exercise_code),
              target: Number(existing.target),
              unit: String(existing.unit) === 'seconds' ? 'seconds' : 'reps',
            };
            expectedGoal =
              existing.goal_snapshot &&
              (GOALS as readonly string[]).includes(String(existing.goal_snapshot))
                ? String(existing.goal_snapshot)
                : null;
          }
        } catch {
          expected = null;
        }
      } else {
        expected = serverGoal === null ? null : expectedChallenge(item.challengeDate, serverGoal);
      }
      // La comparación de goal usa el snapshot de la asignación (autoritativo)
      // cuando la asignación existe; si no, el goal vigente del historial/perfil.
      const goalForMatch = expectedGoal ?? serverGoal;
      if (
        expected === null ||
        expected.exerciseCode !== item.exerciseCode ||
        expected.target !== item.target ||
        expected.unit !== unit ||
        (goalForMatch !== null && item.goal !== goalForMatch) ||
        (item.unit !== undefined && item.unit !== unit)
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

    completionResults.push({ clientOpId: item.clientOpId, status, reason });

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

    // Materializar la asignación SOLO si no existe (fuente de verdad). Nunca
    // recalcular ni sobrescribir una asignación ya creada.
    const serverGoal = effectiveGoals[item.challengeDate] ?? profileGoal;
    if (!assignmentByDate.has(item.challengeDate) && serverGoal !== null) {
      const expected = expectedChallenge(item.challengeDate, serverGoal);
      if (expected !== null) {
        await admin.from('daily_challenge_assignments').upsert(
          {
            user_id: userData.user.id,
            challenge_date: item.challengeDate,
            goal_snapshot: serverGoal,
            exercise_code: expected.exerciseCode,
            target: expected.target,
            unit: expected.unit,
            feature_version: FEATURE_VERSION,
          },
          { onConflict: 'user_id,challenge_date' },
        );
      }
    }
  }

  if (completionRows.length > 0) {
    // server-authoritative: no re-escribir una fecha ya decidida. Si la
    // propuesta ya está verified, el veredicto es terminal (trigger 0015) y se
    // conserva; al cliente se le devuelve accepted (verified) en vez de volver
    // a evaluarla como pending/rejected.
    let decidedDates: Set<string> = new Set();
    try {
      const { data: existing } = await admin
        .from('daily_challenge_submissions')
        .select('challenge_date, verification_status')
        .eq('user_id', userData.user.id)
        .in(
          'challenge_date',
          completionRows.map((r) => String(r.challenge_date)),
        );
      if (Array.isArray(existing)) {
        decidedDates = new Set(
          existing
            .filter((row) => row.verification_status === 'verified')
            .map((row) => String(row.challenge_date)),
        );
      }
    } catch {
      decidedDates = new Set();
    }
    const rowsToWrite = completionRows.filter((r) => {
      const dateKey = String(r.challenge_date);
      if (decidedDates.has(dateKey)) {
        const result = completionResults.find((res) => res.clientOpId === `daily:${dateKey}`);
        if (result) {
          result.status = 'accepted';
          result.reason = 'already_verified';
        }
        return false;
      }
      return true;
    });
    if (rowsToWrite.length > 0) {
      const { error: insertError } = await admin
        .from('daily_challenge_submissions')
        .upsert(rowsToWrite, { onConflict: 'user_id,challenge_date' });
      if (insertError) return response({ error: 'completion_storage_failed' }, 503);
    }
  }

  const sessionAccepted = sessionResults.filter((r) => r.status === 'accepted').length;
  const sessionsPending = sessionResults.filter((r) => r.status === 'pending').length;
  const sessionsRejected =
    invalid.length + sessionResults.filter((r) => r.status === 'rejected').length;
  const completionAccepted = completionResults.filter((r) => r.status === 'accepted').length;
  const completionsPending = completionResults.filter((r) => r.status === 'pending').length;
  const completionsRejected =
    invalidCompletions.length + completionResults.filter((r) => r.status === 'rejected').length;

  return response({
    received: valid.length + validCompletions.length,
    verified: sessionAccepted + completionAccepted,
    pending: sessionsPending + completionsPending,
    rejected: sessionsRejected + completionsRejected,
    completionReceived: validCompletions.length,
    completionVerified: completionAccepted,
    completionPending: completionsPending,
    // Por elemento: el cliente conserva en su cola todo lo no-accepted. Los
    // inválidos de formato también se reportan con su clientOpId para que el
    // cliente los marque como rechazados en vez de reintentarlos en bucle.
    results: [
      ...invalidResults,
      ...sessionResults,
      ...invalidCompletionResults,
      ...completionResults,
    ],
    message:
      'Todas las propuestas quedan en revisión (pending). El ranking se reabre solo cuando exista un validador server-side real.',
  });
});
