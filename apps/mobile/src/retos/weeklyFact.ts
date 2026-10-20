// Dato de la semana para la tarjeta de Inicio (Fase 1).
//
// Sin red y sin backend: el indice rota de forma deterministica por semana ISO,
// asi que el mismo usuario ve el mismo dato toda la semana y cambia la proxima.
// El contenido es propio (tips de tecnica / habito), no de terceros, para no
// tener problemas de copyright ni depender de conexion.
//
// `key` apunta a una clave i18n (`weekly.<key>.title` / `weekly.<key>.body`) que
// existe en es/en/pt. Para agregar un dato, sumar el id aca y las 3 claves.

import type { TranslationKey } from '../i18n/translations';

export interface WeeklyFact {
  key: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

// Rotacion curada. Los ids son estables: reordenar cambia la rotacion historica.
export const WEEKLY_FACT_IDS = [
  'breath',
  'rest',
  'posture',
  'consistency',
  'warmup',
  'form',
  'recovery',
] as const;

export function factTitleKey(key: string): TranslationKey {
  return `weekly.${key}.title` as TranslationKey;
}

export function factBodyKey(key: string): TranslationKey {
  return `weekly.${key}.body` as TranslationKey;
}

// Semana ISO (1..53). Se calcula sin dependencias para que sea estable en el
// dispositivo del usuario y no dependa de zona horaria del servidor.
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// Dato de la semana para la fecha dada (rota por semana ISO). Devuelve siempre
// un dato valido mientras `WEEKLY_FACT_IDS` no este vacio.
export function weeklyFact(date: Date = new Date()): WeeklyFact {
  const index = (isoWeek(date) - 1) % WEEKLY_FACT_IDS.length;
  const key = WEEKLY_FACT_IDS[index];
  return { key, titleKey: factTitleKey(key), bodyKey: factBodyKey(key) };
}
