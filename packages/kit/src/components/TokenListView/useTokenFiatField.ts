/**
 * TokenList — per-FIELD fiat subscription (方案B).
 *
 * The row value leaves (balance / value / price / price-change) each read ONE
 * slice of a token's `ITokenFiat`. Subscribing to the WHOLE cell object
 * (`useTokenFiat`) makes every leaf re-render on any field change — so the
 * BALANCE leaf re-paints on a pure price tick even though `balanceParsed` did
 * not move. These hooks scope each leaf's subscription to the field(s) it
 * actually renders via `selectAtom`, so a leaf only re-renders when ITS slice
 * changes (`Object.is` / shallow-equal). They also fold the previously
 * duplicated home-cell-vs-context-map seam (`useCellSeam ? cell : map`) into one
 * place.
 *
 * Seam (spec §5): the HOME path subscribes to the per-key cell (field-scoped);
 * the selector / AssetList / LP-scoped paths read the field off the context map
 * (`tokenListMap[$key] ?? aggregateTokenFiatMap[$key]`) as before.
 */
import { useMemo } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';

import { isAgg } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { useTokenListContextData } from '../../states/jotai/contexts/tokenList/atoms';
import {
  aggCell,
  cell,
  meta,
} from '../../states/jotai/contexts/tokenList/cells/projection';

import { resolveMapTokenFiat } from './resolveMapTokenFiat';
import { useTokenListViewContext } from './TokenListViewContext';

/** Shallow equality for the small fixed-key field slices selected below. */
function shallowEqualSlice<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = Object.keys(ao);
  for (const k of keys) {
    if (ao[k] !== bo[k]) {
      return false;
    }
  }
  return true;
}

/**
 * Generic field-scoped fiat read. `select` + `isEqual` MUST be module-level
 * stable references (selectAtom caches the derived atom by them). Resolves the
 * HOME cell path through `selectAtom` (field-scoped) and the non-cell path off
 * the context map.
 */
function useTokenFiatField<T>(
  $key: string,
  select: (fiat: ITokenFiat | undefined) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
  // Row network, consulted only by the zero-fill gate on the non-cell path.
  networkId?: string,
): T {
  const {
    tokenListMap: contextTokenListMap,
    aggregateTokenFiatMap: contextAggregateTokenFiatMap,
    useCellSeam,
    zeroFillMissingFiat = false,
    zeroFillNetworkIds,
  } = useTokenListViewContext();
  // useTokenListContextData throws when no store is mounted, so `store` is
  // always defined here.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const store = useTokenListContextData().store!;

  const metaValue: IToken | undefined = useAtomValue(meta(store, $key), {
    store,
  });
  const aggregate = isAgg($key, metaValue);
  const baseAtom = aggregate ? aggCell(store, $key) : cell(store, $key);

  const fieldAtom = useMemo(
    () => selectAtom(baseAtom, select, isEqual),
    [baseAtom, select, isEqual],
  );
  const cellField = useAtomValue(fieldAtom, { store });

  // Non-cell paths keep reading the whole context map; the field is projected
  // off it so callers get the same shape on both paths.
  const mapToken = resolveMapTokenFiat({
    $key,
    networkId,
    tokenListMap: contextTokenListMap,
    aggregateTokenFiatMap: contextAggregateTokenFiatMap,
    zeroFillMissingFiat,
    zeroFillNetworkIds,
  });

  return useCellSeam ? cellField : select(mapToken);
}

// --- per-field selectors (module-level for selectAtom caching) -------------

// Scaled-UI (rebase) tokens: the fiat map keeps balanceParsed RAW; the display
// leaf shows balanceParsed × balanceMultiplier (no-op when absent). fiatValue
// is already multiplied server-side.
const selectBalanceParsed = (f: ITokenFiat | undefined): string | undefined =>
  tokenRebaseUtils.applyBalanceMultiplier({
    amount: f?.balanceParsed,
    balanceMultiplier: f?.balanceMultiplier,
  });

// Raw `balanceMultiplier` field — for consumers that gate scaled-UI-unaware
// flows (e.g. the swap entry), not for display math.
const selectBalanceMultiplier = (
  f: ITokenFiat | undefined,
): string | undefined => f?.balanceMultiplier;

const selectPrice24h = (f: ITokenFiat | undefined): number | undefined =>
  f?.price24h;

export interface ITokenPriceSlice {
  price: number | undefined;
  currency: string | undefined;
}
const selectPriceSlice = (f: ITokenFiat | undefined): ITokenPriceSlice => ({
  price: f?.price,
  currency: f?.currency,
});

export interface ITokenValueSlice {
  has: boolean;
  fiatValue: string | undefined;
  /** DISPLAY basis: balanceParsed × balanceMultiplier. See `selectBalanceParsed`. */
  balanceParsed: string | undefined;
  currency: string | undefined;
}
const selectValueSlice = (f: ITokenFiat | undefined): ITokenValueSlice => ({
  has: !!f,
  fiatValue: f?.fiatValue,
  // See the contract comment above `selectBalanceParsed`: DISPLAY basis.
  balanceParsed: tokenRebaseUtils.applyBalanceMultiplier({
    amount: f?.balanceParsed,
    balanceMultiplier: f?.balanceMultiplier,
  }),
  currency: f?.currency,
});

// --- public per-field hooks ------------------------------------------------

/**
 * `balanceParsed` only — does NOT re-render on a price tick.
 *
 * Returns the DISPLAY basis (balanceParsed × balanceMultiplier; a no-op for
 * every non-rebase token).
 */
export function useTokenBalanceParsed(
  $key: string,
  networkId?: string,
): string | undefined {
  return useTokenFiatField($key, selectBalanceParsed, Object.is, networkId);
}

/**
 * `balanceMultiplier` only — lets scaled-UI-unaware consumers (e.g. the swap
 * entry) detect rebase tokens and fail closed.
 */
export function useTokenBalanceMultiplier($key: string): string | undefined {
  return useTokenFiatField($key, selectBalanceMultiplier);
}

/** `price24h` only. */
export function useTokenPrice24h($key: string): number | undefined {
  return useTokenFiatField($key, selectPrice24h);
}

/** `{ price, currency }` — re-renders when price (or currency) changes. */
export function useTokenPriceSlice($key: string): ITokenPriceSlice {
  return useTokenFiatField($key, selectPriceSlice, shallowEqualSlice);
}

/** `{ has, fiatValue, balanceParsed, currency }` for the holding-value leaf. */
export function useTokenValueSlice(
  $key: string,
  networkId?: string,
): ITokenValueSlice {
  return useTokenFiatField(
    $key,
    selectValueSlice,
    shallowEqualSlice,
    networkId,
  );
}
