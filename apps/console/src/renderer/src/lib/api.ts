// Cliente thin de la Console: habla con la Edge Function `admin_console` con el
// JWT del admin logueado. La service_role NO existe en esta app.
import { ADMIN_FN_URL, SUPABASE_ANON_KEY_READ } from '../env';
import { supabase } from './session';

export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.status = status;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Traduce un error de la Edge Function a un mensaje legible. */
export function messageFor(code: string, hint?: string): string {
  let message: string;
  switch (code) {
    case 'unauthorized':
      message = 'Sesión inválida o vencida. Intentá iniciar sesión de nuevo.';
      break;
    case 'not_admin':
      message = 'No tenés permisos de administrador en esta cuenta.';
      break;
    case 'forbidden_action':
      message = 'Tu rol no autoriza esta acción.';
      break;
    case 'server_not_configured':
      message = 'El servidor no está configurado correctamente.';
      break;
    case 'invalid_json':
      message = 'El servidor recibió una petición inválida.';
      break;
    case 'missing_action':
      message = 'Falta la acción a ejecutar.';
      break;
    case 'invalid_key':
      message = 'Clave inválida (solo letras, números, punto, guion, guion bajo).';
      break;
    case 'invalid_enabled':
      message = 'El valor de "enabled" debe ser verdadero o falso.';
      break;
    case 'missing_user_id':
      message = 'Falta el user_id del usuario.';
      break;
    case 'invalid_expires_at':
      message = 'La fecha de expiración no es válida.';
      break;
    case 'invalid_product':
      message = 'Producto inválido (solo premium_monthly o premium_annual).';
      break;
    case 'invalid_event':
      message = 'Evento del ciclo de vida inválido.';
      break;
    case 'config_write_failed':
      message = 'No se pudo escribir la configuración (operación revertida).';
      break;
    case 'flag_write_failed':
      message = 'No se pudo escribir el feature flag (operación revertida).';
      break;
    case 'grant_failed':
      message = 'No se pudo otorgar el entitlement.';
      break;
    case 'revoke_failed':
      message = 'No se pudo revocar el entitlement.';
      break;
    case 'sim_lifecycle_failed':
      message = 'El evento simulado no se pudo ejecutar.';
      break;
    case 'config_read_failed':
    case 'flags_read_failed':
    case 'entitlements_read_failed':
    case 'audit_read_failed':
    case 'admin_lookup_failed':
      message = 'No se pudieron leer los datos del servidor.';
      break;
    default:
      message = 'Error inesperado del servidor.';
  }
  if (hint) return `${message} (${hint})`;
  return message;
}

/** Convierte una respuesta no-OK (o JSON raro) en un AdminApiError clasificable. */
export function apiError(json: unknown, status: number): AdminApiError {
  const code =
    isRecord(json) && typeof json.error === 'string' && json.error.length > 0
      ? json.error
      : `http_${status}`;
  const hint = isRecord(json) && typeof json.hint === 'string' ? json.hint : undefined;
  return new AdminApiError(code, status, messageFor(code, hint));
}

export async function callAdmin<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError('not_signed_in', 401, 'No hay sesión activa.');

  let res: Response;
  try {
    res = await fetch(ADMIN_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY_READ,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    throw new AdminApiError('network_error', 0, 'No se pudo contactar al servidor.');
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) throw apiError(json, res.status);
  return json as T;
}
