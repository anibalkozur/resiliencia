import { describe, expect, it } from 'vitest';
import { LIFECYCLE_EVENTS, PREMIUM_PRODUCTS } from '@console/shared/constants';
import { EVENT_CATALOGUE, PRODUCT_CHOICES, eventById, productById } from '../events';

describe('catálogo del simulador (events.ts)', () => {
  it('cubre exactamente los 9 eventos soportados por la Edge Function', () => {
    const ids = EVENT_CATALOGUE.map((e) => e.id).sort();
    const expected = [...LIFECYCLE_EVENTS].sort();
    expect(ids).toEqual(expected);
  });

  it('los ids de eventos son únicos y tienen etiqueta y ayuda', () => {
    const ids = EVENT_CATALOGUE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EVENT_CATALOGUE) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.hint.length).toBeGreaterThan(0);
    }
  });

  it('productos: solo premium_monthly y premium_annual', () => {
    const ids = PRODUCT_CHOICES.map((p) => p.id);
    expect(ids.sort()).toEqual([...PREMIUM_PRODUCTS].sort());
    expect(PRODUCT_CHOICES.some((p) => p.id === 'premium_annual' && p.days === 365)).toBe(true);
    expect(PRODUCT_CHOICES.some((p) => p.id === 'premium_monthly' && p.days === 30)).toBe(true);
  });

  it('trial_start queda documentado como exclusivo del producto anual (decisión D-B)', () => {
    const trial = eventById('trial_start');
    expect(trial?.hint.toLowerCase()).toContain('premium_annual');
  });

  it('eventById/productById devuelven la entrada y no rompen con ids desconocidos', () => {
    expect(eventById('refund')?.label).toBe('Reembolso');
    expect(productById('premium_annual')?.days).toBe(365);
    expect(eventById('no-existe')).toBeUndefined();
    expect(productById('no-existe')).toBeUndefined();
  });
});
