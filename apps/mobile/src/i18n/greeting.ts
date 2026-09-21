import type { TranslationKey } from './translations';

export function greetingKey(hour: number): TranslationKey {
  if (hour < 12) return 'home.greeting_morning';
  if (hour < 19) return 'home.greeting_afternoon';
  return 'home.greeting_evening';
}
