import type { TranslationKey } from '../i18n/translations';
import type { AuthErrorCode } from './authService';

const MAP: Record<AuthErrorCode, TranslationKey> = {
  invalid_email: 'auth.err_invalid_email',
  password_short: 'auth.err_password_short',
  auth_not_configured: 'auth.err_auth_not_configured',
  email_in_use: 'auth.err_email_in_use',
  invalid_credentials: 'auth.err_invalid_credentials',
  network: 'auth.err_network',
  provider_not_configured: 'auth.err_provider_not_configured',
  canceled: 'auth.err_canceled',
  unknown: 'auth.err_unknown',
};

export function authErrorKey(code: AuthErrorCode): TranslationKey {
  return MAP[code];
}
