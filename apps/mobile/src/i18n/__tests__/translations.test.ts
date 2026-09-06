import { describe, expect, it } from '@jest/globals';
import { translate, TRANSLATIONS } from '../translations';
import type { TranslationKey } from '../translations';

describe('i18n translations', () => {
  it('keeps every translation key defined for all three languages', () => {
    const esKeys = Object.keys(TRANSLATIONS.es).sort();
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const ptKeys = Object.keys(TRANSLATIONS.pt).sort();
    expect(enKeys).toEqual(esKeys);
    expect(ptKeys).toEqual(esKeys);
  });

  it('interpolates variables', () => {
    expect(translate('es', 'home.greeting', { name: 'Anibal' })).toBe('Hola, Anibal');
    expect(translate('en', 'home.greeting', { name: 'Ana' })).toBe('Hi, Ana');
    expect(translate('pt', 'home.challenge')).toBe('DESAFIO DE HOJE');
  });

  it('types keys as TranslationKey', () => {
    const key: TranslationKey = 'home.streak';
    expect(key).toBe('home.streak');
  });
});
