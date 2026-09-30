// Configuración del renderer. Soporta override por variable de entorno Vite
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Los valores por defecto son los
// del proyecto de producción. Nada de secrets acá (misma publishable key pública
// que usa la app móvil).
import {
  ADMIN_FN_URL_PATH,
  DEFAULT_SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from '@console/shared/constants';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_URL = envUrl?.trim() || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY_READ = envAnon?.trim() || SUPABASE_ANON_KEY;
export const ADMIN_FN_URL = `${SUPABASE_URL}${ADMIN_FN_URL_PATH}`;
