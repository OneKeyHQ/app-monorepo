import BigNumber from 'bignumber.js';

import { isValidNumberValue } from '@onekeyhq/shared/src/utils/tokenValueUtils';

export type IHomeBalanceState = 'unknown' | 'zero' | 'positive';

// What a worth source can say about an owner: nothing (`undefined`), that the
// owner is worth nothing, or that it is worth something.
export type IWorthEvidence = 'zero' | 'positive' | undefined;

/**
 * Classifies a persisted worth record — a scalar for a single network or the
 * per-network map that `simpleDb.accountValue` keeps for All Networks.
 * Entries that do not parse (the `'--'` unavailable sentinel, `NaN`) are
 * dropped rather than treated as zero; an empty or fully unparseable record
 * is no evidence at all.
 */
export function classifyWorth(
  value: Record<string, string> | string | null | undefined,
): IWorthEvidence {
  if (value === null || value === undefined) {
    return undefined;
  }
  const entries = (
    typeof value === 'string' ? [value] : Object.values(value)
  ).filter(isValidNumberValue);
  if (entries.length === 0) {
    return undefined;
  }
  return entries.some((entry) => !new BigNumber(entry).isZero())
    ? 'positive'
    : 'zero';
}

/**
 * Composes the Home header balance state from its evidence sources, in
 * precedence order:
 *   1. held tokens (STRICT positive-balance set) — funded regardless of fiat
 *      worth, since unpriced tokens sum to a worth of 0;
 *   2. the per-owner confirmed overview snapshot (`byOwner`);
 *   3. the live worth atom for this owner;
 *   4. the persisted per-account value that the account selector row shows —
 *      the only source an empty account has before its All Networks fan-out
 *      commits, which is the window where the action row used to stay blank.
 */
export function resolveHomeBalanceState({
  hasWallet,
  hasHoldings,
  confirmedWorth,
  liveIsPositive,
  persistedWorth,
}: {
  hasWallet: boolean;
  hasHoldings: boolean;
  confirmedWorth: string | undefined;
  liveIsPositive: boolean | undefined;
  persistedWorth: IWorthEvidence;
}): IHomeBalanceState {
  if (!hasWallet) return 'unknown';
  if (hasHoldings) return 'positive';
  if (confirmedWorth !== undefined) {
    return new BigNumber(confirmedWorth).isZero() ? 'zero' : 'positive';
  }
  if (liveIsPositive !== undefined) {
    return liveIsPositive ? 'positive' : 'zero';
  }
  if (persistedWorth !== undefined) {
    return persistedWorth;
  }
  return 'unknown';
}
