import BigNumber from 'bignumber.js';

import {
  isValidNumberValue,
  sumFiatValuesIgnoringUnavailable,
} from './tokenValueUtils';

import type { ITokenData } from '../../types/token';

// Shared-balance groups (OK-63633): on Arc (evm--5042) the native USDC and the
// ERC-20 interface 0x3600… are "two interfaces, one balance". The server marks
// the ERC-20 row with `sharedBalanceExcluded: true` + `sharedBalanceWith:
// <primary address>` (both always together; the primary and every other token
// lack both). Any client-side fiat total must count that balance ONCE, while
// the token list itself keeps both rows (the ERC-20 row is still the target of
// swap / approve / transfer).
//
// Rule (mirrors the wallet BFF, OK-63604):
// 1. Skip a marked row ONLY when the summed set contains a VALID primary: same
//    networkId, `address === sharedBalanceWith`, itself not marked, finite
//    positive price and finite fiatValue.
// 2. Otherwise (primary hidden / blocked / unpriced / not fetched) the marked
//    row is counted normally, so the balance is counted once rather than zero
//    times.
// 3. Presence is `!== undefined`: the Arc native address is '' so
//    `sharedBalanceWith` is '' too, and a truthy check would mis-classify it.

export type ISharedBalanceMarkerLike = {
  sharedBalanceExcluded?: boolean;
  sharedBalanceWith?: string;
};

export type ISharedBalanceCandidate = ISharedBalanceMarkerLike & {
  key: string;
  networkId?: string;
  address: string;
  price?: number | string | null;
  fiatValue?: string | number | null;
};

export function isSharedBalanceMarkedToken(
  token: ISharedBalanceMarkerLike | undefined,
): boolean {
  return (
    !!token &&
    token.sharedBalanceExcluded === true &&
    token.sharedBalanceWith !== undefined
  );
}

function isPositiveFiniteNumber(v: number | string | null | undefined) {
  return isValidNumberValue(v) && new BigNumber(v).gt(0);
}

// Returns the keys of marked rows that must be excluded from a total computed
// over `candidates` (the set that actually participates in the sum). Rows
// without the marker are never returned, so non-Arc data is untouched.
export function resolveSharedBalanceExcludedKeys(
  candidates: ISharedBalanceCandidate[],
): Set<string> {
  const excluded = new Set<string>();
  const marked = candidates.filter(isSharedBalanceMarkedToken);
  if (marked.length === 0) {
    return excluded;
  }
  for (const member of marked) {
    const hasValidPrimary = candidates.some(
      (candidate) =>
        candidate.key !== member.key &&
        !isSharedBalanceMarkedToken(candidate) &&
        (candidate.networkId ?? '') === (member.networkId ?? '') &&
        candidate.address === member.sharedBalanceWith &&
        isPositiveFiniteNumber(candidate.price) &&
        isValidNumberValue(candidate.fiatValue),
    );
    if (hasValidPrimary) {
      excluded.add(member.key);
    }
  }
  return excluded;
}

// Applies the rule to a token-list response IN PLACE: the summed set is
// `tokens ∪ smallBalanceTokens` (cross-bucket — the ERC-20 row may fall into
// the small-balance bucket alone while the native stays in `tokens`;
// risk-only rows are not part of any total). Marked rows that must be skipped
// get `sharedBalanceExcludedFromTotal: true` on their fiat-map entry so every
// map-only sum helper can honour the decision; rows that must be re-included
// have the flag cleared. `data` / `keys` / `map` membership is never changed.
// Bucket `fiatValue` is recomputed from the (flagged) map only when something
// was excluded, so responses without markers keep the server total verbatim.
export function applySharedBalanceExclusionToTokenGroups({
  tokens,
  smallBalanceTokens,
}: {
  tokens?: ITokenData;
  smallBalanceTokens?: ITokenData;
}): Set<string> {
  const groups = [tokens, smallBalanceTokens].filter(
    (g): g is ITokenData => !!g,
  );
  const candidates: ISharedBalanceCandidate[] = [];
  for (const group of groups) {
    for (const token of group.data ?? []) {
      const fiat = group.map?.[token.$key];
      candidates.push({
        key: token.$key,
        networkId: token.networkId,
        address: token.address,
        sharedBalanceExcluded: token.sharedBalanceExcluded,
        sharedBalanceWith: token.sharedBalanceWith,
        price: fiat?.price,
        fiatValue: fiat?.fiatValue,
      });
    }
  }
  const excludedKeys = resolveSharedBalanceExcludedKeys(candidates);
  const hasMarked = candidates.some(isSharedBalanceMarkedToken);
  if (!hasMarked) {
    return excludedKeys;
  }
  for (const group of groups) {
    let touched = false;
    for (const token of group.data ?? []) {
      const fiat = group.map?.[token.$key];
      if (fiat && excludedKeys.has(token.$key)) {
        fiat.sharedBalanceExcludedFromTotal = true;
        touched = true;
      } else if (fiat && fiat.sharedBalanceExcludedFromTotal !== undefined) {
        delete fiat.sharedBalanceExcludedFromTotal;
        touched = true;
      }
    }
    if (touched) {
      group.fiatValue = sumFiatValuesIgnoringUnavailable(group.map);
    }
  }
  return excludedKeys;
}
