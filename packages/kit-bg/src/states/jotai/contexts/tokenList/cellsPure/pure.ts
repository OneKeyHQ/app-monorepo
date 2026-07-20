/**
 * TokenList cells — Phase-1 Slice 1 PURE FUNCTIONS (spec §11.1).
 *
 * Every function here is a pure, side-effect-free unit: inputs are explicit,
 * there is no React / native / jotai / global access. This is what makes the
 * cells diff/sum/predicate logic node-jest testable (spec §11, §11.5).
 */
import BigNumber from 'bignumber.js';

import { buildHomeDefaultTokenMapKey } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  ICustomTokenItem,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

/**
 * Single-key aggregate-token summation, extracted verbatim from
 * `flattenAggregateTokensMap` (tokenUtils.ts:709-790) so `aggCell` and the
 * legacy flatten share one summation implementation (spec §3.1, §11.1).
 *
 * - balance / balanceParsed / fiatValue / frozen* / total* are BigNumber.plus
 *   summed across the per-network entries.
 * - price / price24h / currency are taken from the FIRST entry (DO NOT drop
 *   price24h, otherwise the PriceChange leaf regresses — spec §3.1).
 * - undefined entries are tolerated (skipped); empty set yields a zeroed frame.
 */
export function sumAggregateEntry(
  entries: Array<ITokenFiat | undefined>,
): ITokenFiat | undefined {
  const present = entries.filter(
    (e): e is ITokenFiat => e !== undefined && e !== null,
  );
  if (present.length === 0) {
    return undefined;
  }

  const firstEntry = present[0];
  const aggregated: ITokenFiat = {
    balance: '0',
    balanceParsed: '0',
    fiatValue: '0',
    price: firstEntry.price,
    price24h: firstEntry.price24h,
    currency: firstEntry.currency,
  };

  for (const tokenFiat of present) {
    aggregated.balance = new BigNumber(aggregated.balance)
      .plus(tokenFiat.balance)
      .toFixed();
    aggregated.balanceParsed = new BigNumber(aggregated.balanceParsed)
      .plus(tokenFiat.balanceParsed)
      .toFixed();
    aggregated.fiatValue = new BigNumber(aggregated.fiatValue)
      .plus(tokenFiat.fiatValue)
      .toFixed();

    if (tokenFiat.frozenBalance) {
      aggregated.frozenBalance = new BigNumber(aggregated.frozenBalance ?? 0)
        .plus(tokenFiat.frozenBalance)
        .toFixed();
    }
    if (tokenFiat.frozenBalanceParsed) {
      aggregated.frozenBalanceParsed = new BigNumber(
        aggregated.frozenBalanceParsed ?? 0,
      )
        .plus(tokenFiat.frozenBalanceParsed)
        .toFixed();
    }
    if (tokenFiat.frozenBalanceFiatValue) {
      aggregated.frozenBalanceFiatValue = new BigNumber(
        aggregated.frozenBalanceFiatValue ?? 0,
      )
        .plus(tokenFiat.frozenBalanceFiatValue)
        .toFixed();
    }
    if (tokenFiat.totalBalance) {
      aggregated.totalBalance = new BigNumber(aggregated.totalBalance ?? 0)
        .plus(tokenFiat.totalBalance)
        .toFixed();
    }
    if (tokenFiat.totalBalanceParsed) {
      aggregated.totalBalanceParsed = new BigNumber(
        aggregated.totalBalanceParsed ?? 0,
      )
        .plus(tokenFiat.totalBalanceParsed)
        .toFixed();
    }
    if (tokenFiat.totalBalanceFiatValue) {
      aggregated.totalBalanceFiatValue = new BigNumber(
        aggregated.totalBalanceFiatValue ?? 0,
      )
        .plus(tokenFiat.totalBalanceFiatValue)
        .toFixed();
    }
  }

  return aggregated;
}

/**
 * Fiat-value equality used by the cell write path: only balance / fiatValue /
 * price / price24h / currency changes count as "different" (spec §11.1).
 * Two undefineds are equal; undefined↔value is different.
 */
export function fiatEqual(a?: ITokenFiat, b?: ITokenFiat): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.balance === b.balance &&
    a.fiatValue === b.fiatValue &&
    a.price === b.price &&
    a.price24h === b.price24h &&
    a.currency === b.currency
  );
}

/**
 * Meta equality used by the meta-cell write path. Only the visually-meaningful
 * fields are compared (spec §11.1 — "only balance/fiatValue/price/currency
 * changes count"; for meta the analogous render-affecting fields). Two
 * undefineds are equal; undefined↔value is different.
 */
export function metaEqual(a?: IToken, b?: IToken): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.symbol === b.symbol &&
    a.name === b.name &&
    a.address === b.address &&
    a.logoURI === b.logoURI &&
    a.networkId === b.networkId &&
    a.isNative === b.isNative &&
    a.isAggregateToken === b.isAggregateToken &&
    a.commonSymbol === b.commonSymbol &&
    a.riskLevel === b.riskLevel
  );
}

/**
 * `aggregate token` identity (spec §4.0): prefer the stamped
 * `isAggregateToken` field on the meta (builder stamps it at
 * tokenUtils.ts:1071), fall back to the `aggregate_` $key prefix only when
 * meta is not available (or does not carry the stamp). Prefix alone is NOT
 * authoritative — always try meta first (spec §3.1, §4.0, Codex r10
 * refinement).
 */
export function isAgg(key: string, metaOf?: IToken): boolean {
  return metaOf?.isAggregateToken ?? key.startsWith('aggregate_');
}

/**
 * Shallow element-by-element array equality (spec §11.1). Used by buildFrames
 * to detect structural id/membership changes without pulling in the apply
 * layer. Same length + same element identity. (apply.ts keeps its own copy for
 * orderedIds ref-stability; both are pure and identical in semantics.)
 */
export function shallowEqualArrayOf<T>(a: T[], b: T[]): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export interface IComputeNonZeroIdsParams {
  ids: string[];
  getFiat: (key: string) => ITokenFiat | undefined;
  getMeta: (key: string) => IAccountToken | IToken | undefined;
  keepDefault: boolean;
  homeDefaultTokenMap?: Record<string, unknown>;
  customTokens?: ICustomTokenItem[];
}

/**
 * hideZero non-zero predicate (spec §8#2), mirroring the in-view filter at
 * TokenListView/index.tsx:307-345. Three-branch keep:
 *   1. balance > 0, OR
 *   2. keepDefault AND homeDefaultTokenMap hit AND (isNative || isAggregate), OR
 *   3. keepDefault AND customTokens hit ($key match OR address+networkId match).
 *
 * `nonZeroIds` is the home hideZero authority: `TokenListFooter` filters its
 * count off membership in this set, and the cold-start bundle persists it so a
 * hideZero cold start paints the kept set at T0 (spec §8#2).
 */
export function computeNonZeroIds(params: IComputeNonZeroIdsParams): string[] {
  const {
    ids,
    getFiat,
    getMeta,
    keepDefault,
    homeDefaultTokenMap,
    customTokens,
  } = params;

  return ids.filter((key) => {
    const fiat = getFiat(key);
    const meta = getMeta(key);

    const tokenBalance = new BigNumber(fiat?.balance ?? 0);
    if (tokenBalance.gt(0)) {
      return true;
    }

    if (keepDefault && meta) {
      const defaultKey = buildHomeDefaultTokenMapKey({
        networkId: meta.networkId ?? '',
        symbol: meta.commonSymbol ?? meta.symbol ?? '',
      });
      if (
        homeDefaultTokenMap?.[defaultKey] &&
        (meta.isNative || meta.isAggregateToken)
      ) {
        return true;
      }

      if (
        customTokens?.find(
          (t) =>
            t.$key === key ||
            (t.address.toLowerCase() === (meta.address ?? '').toLowerCase() &&
              t.networkId === meta.networkId),
        )
      ) {
        return true;
      }
    }

    return false;
  });
}

export interface IComputeFundedIdsParams {
  ids: string[];
  getFiat: (key: string) => ITokenFiat | undefined;
}

/**
 * STRICT funded predicate (PR-0 full-delete enabler). Unlike `computeNonZeroIds`
 * — which is the hideZero VIEW filter and KEEPS zero-balance default/custom
 * tokens via its keepDefault branches (so it OVER-reports funded) — this is pure
 * `balance > 0`:
 *   - NO keepDefault retention (a fresh 0-balance native/default token is NOT
 *     funded), and
 *   - aggregate-aware: callers pass a `getFiat` that returns the per-network sum
 *     for aggregate ids, so an aggregate is funded iff its summed balance > 0.
 *
 * This is the correct `useHomeBalanceState.hasHoldingsNow` signal: `fundedIds`
 * is nonempty iff at least one token actually holds a positive balance, so it
 * will NOT latch a fresh 0-balance account as funded (which `nonZeroIds` would
 * via keepDefault) and wrongly hide the Add-money CTA.
 */
export function computeFundedIds(params: IComputeFundedIdsParams): string[] {
  const { ids, getFiat } = params;
  return ids.filter((key) => {
    const fiat = getFiat(key);
    return new BigNumber(fiat?.balance ?? 0).gt(0);
  });
}
