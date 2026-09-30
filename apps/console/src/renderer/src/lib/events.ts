// Catálogo de productos y eventos del simulador del ciclo de vida. Este archivo
// es puro (sin dependencias de Electron ni de red) para poder testear las
// invariantes del catálogo.
import type { LifecycleEvent, PremiumProduct } from '@console/shared/constants';

export const PRODUCT_CHOICES: ReadonlyArray<{
  id: PremiumProduct;
  label: string;
  days: number;
}> = [
  { id: 'premium_monthly', label: 'Premium Mensual (30 días)', days: 30 },
  { id: 'premium_annual', label: 'Premium Anual (365 días)', days: 365 },
];

export const EVENT_CATALOGUE: ReadonlyArray<{
  id: LifecycleEvent;
  label: string;
  hint: string;
}> = [
  { id: 'purchase', label: 'Compra', hint: 'Otorga el entitlement (30d mensual / 365d anual).' },
  {
    id: 'trial_start',
    label: 'Trial (7 días)',
    hint: 'Únicamente para premium_annual (decisión D-B).',
  },
  { id: 'renew', label: 'Renovación', hint: 'Extiende la fecha de vencimiento.' },
  {
    id: 'cancel',
    label: 'Cancelar',
    hint: 'Marca will_renew=false; NO revoca (conserva acceso hasta expirar).',
  },
  { id: 'expire', label: 'Vencer', hint: 'Revoca al vencerse la fecha.' },
  { id: 'refund', label: 'Reembolso', hint: 'Revoca el entitlement inmediatamente.' },
  {
    id: 'billing_issue',
    label: 'Problema de cobro',
    hint: 'Entra en período de gracia; NO revoca.',
  },
  {
    id: 'transfer',
    label: 'Transferir',
    hint: 'Mueve la suscripción a otro usuario (requiere target).',
  },
  {
    id: 'restore',
    label: 'Restaurar',
    hint: 'Recrea la compra original (válida si existe el purchase).',
  },
];

export function productById(
  id: string,
): { id: PremiumProduct; label: string; days: number } | undefined {
  return PRODUCT_CHOICES.find((p) => p.id === id);
}

export function eventById(
  id: string,
): { id: LifecycleEvent; label: string; hint: string } | undefined {
  return EVENT_CATALOGUE.find((e) => e.id === id);
}
