import { describe, expect, it } from 'vitest';
import { AdminApiError, apiError, isRecord, messageFor } from '../api';

describe('api.ts (cliente thin de la Console)', () => {
  it('isRecord solo acepta objetos planos', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('apiError clasifica códigos del server en AdminApiError', () => {
    const err = apiError({ error: 'not_admin' }, 403);
    expect(err).toBeInstanceOf(AdminApiError);
    expect(err.code).toBe('not_admin');
    expect(err.status).toBe(403);
    expect(err.message).toContain('administrador');
  });

  it('los fallos de autorización del rol son distinguibles del resto', () => {
    expect(messageFor('forbidden_action')).toBe('Tu rol no autoriza esta acción.');
    expect(messageFor('missing_user_id')).toContain('user_id');
  });

  it('mantiene el mensaje del servidor cuando no conoce el código', () => {
    const err = apiError({ error: 'coso_raro' }, 500);
    expect(err.code).toBe('coso_raro');
    expect(err.status).toBe(500);
  });

  it('falla cerrado: sin error de código cae a http_<status>', () => {
    const err = apiError({ foo: 1 }, 500);
    expect(err.code).toBe('http_500');
  });

  it('incluye el hint del servidor si viene', () => {
    const err = apiError({ error: 'invalid_enabled', hint: 'se espera boolean' }, 400);
    expect(err.message).toContain('se espera boolean');
  });
});
