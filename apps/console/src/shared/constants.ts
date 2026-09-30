// Constantes compartidas entre los procesos del proceso principal, el preload y
// el renderer de la Console. Nunca hay secrets acá (solo la publishable key,
// que es pública de por sí y la misma que usa la app móvil).

export const DEFAULT_SUPABASE_URL = 'https://cgaxpmmbpwaefaigsisu.supabase.co';

// Publishable key pública (no es secreta). La service_role nunca entra a esta app.
export const SUPABASE_ANON_KEY = 'sb_publishable_LowQ8eHd35Tvfm3yqc9ExQ_nx7tRVvQ';

export const ADMIN_FN_URL_PATH = '/functions/v1/admin_console';

// URL de callback del OAuth (debe estar dada de alta en Supabase Auth → Redirect
// URLs). El proceso principal la intercepta en la ventana del OAuth antes de
// navegar y le pasa el código PKCE al renderer. Tiene que coincidir con el
// puerto del Vite dev server y con la ruta que espera oauth.ts.
export const OAUTH_REDIRECT = 'http://127.0.0.1:5173/auth/callback';

export const PREMIUM_PRODUCTS = ['premium_monthly', 'premium_annual'] as const;
export type PremiumProduct = (typeof PREMIUM_PRODUCTS)[number];

export const LIFECYCLE_EVENTS = [
  'purchase',
  'trial_start',
  'renew',
  'cancel',
  'expire',
  'refund',
  'billing_issue',
  'transfer',
  'restore',
] as const;
export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];
