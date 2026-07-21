// cspell: words unifold Unifold
import BigNumber from 'bignumber.js';

import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

// SDK formatter: ceil(seconds/60) → "< N min"; ≥60min → "< N hr"; null → "< 1 min".
export function formatUnifoldProcessingTime(
  seconds: number | null | undefined,
): string {
  if (!seconds || seconds <= 0) {
    return '< 1 min';
  }
  const mins = Math.ceil(seconds / 60);
  if (mins >= 60) {
    return `< ${Math.ceil(mins / 60)} hr`;
  }
  return `< ${mins} min`;
}

// Amount discipline (contract §4-3): strings end-to-end, null renders as an
// em dash, never 0.
export function formatUnifoldUsd(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return `$${value}`;
}

export function formatUnifoldTokenAmount({
  baseUnit,
  decimals,
  currency,
}: {
  baseUnit: string | null | undefined;
  decimals: number | null | undefined;
  currency: string | null | undefined;
}): string {
  if (!baseUnit || decimals === null || decimals === undefined) {
    return '—';
  }
  const amount = new BigNumber(baseUnit).shiftedBy(-decimals);
  if (amount.isNaN()) {
    return '—';
  }
  const rendered = amount.gte(1)
    ? amount.toFixed(2)
    : amount.decimalPlaces(8).toFixed();
  return currency ? `${rendered} ${currency.toUpperCase()}` : rendered;
}

export function formatUnifoldExecutionDate(
  createdAt: string | null | undefined,
): string {
  if (!createdAt) {
    return '—';
  }
  try {
    return formatDate(new Date(createdAt));
  } catch {
    return '—';
  }
}
