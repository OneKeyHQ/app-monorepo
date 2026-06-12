import BigNumber from 'bignumber.js';

import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

// Convert a fiat amount between two currencies using the shared exchange
// rate map (`currencyPersistAtom.currencyMap`, sourced from
// `/utility/v1/currency/exchange-rates/map`). Use this in non-React contexts
// — the React render path should prefer the <Currency sourceCurrency=...>
// component which wraps the same math plus formatting.
//
// Returns the original value unchanged when source === target, when either
// rate is missing from the map, or when conversion produces a non-finite
// result. Callers should treat the output as "best effort": pre-migration
// data may still be tagged with a currency that isn't in the loaded map yet,
// and silently passing through is preferable to showing 0 in those cases.
export function convertFiat({
  value,
  sourceCurrency,
  targetCurrency,
  currencyMap,
}: {
  value: BigNumber.Value;
  sourceCurrency: string;
  targetCurrency: string;
  currencyMap: Record<string, ICurrencyItem>;
}): string {
  const bn = new BigNumber(value);
  if (!bn.isFinite()) return bn.toFixed();
  if (sourceCurrency === targetCurrency) return bn.toFixed();
  const source = currencyMap[sourceCurrency];
  const target = currencyMap[targetCurrency];
  if (!source || !target) return bn.toFixed();
  const sourceRate = new BigNumber(source.value);
  const targetRate = new BigNumber(target.value);
  if (!sourceRate.isFinite() || sourceRate.isZero() || !targetRate.isFinite()) {
    return bn.toFixed();
  }
  return bn.div(sourceRate).times(targetRate).toFixed();
}

// Convert the fiat-denominated fields of an ITokenFiat item (price, fiatValue,
// frozenBalanceFiatValue, totalBalanceFiatValue) from the basis recorded in
// its `currency` tag (ServiceToken normalizes cache writes to 'usd') into
// `targetCurrency`, returning a new object tagged with the target currency.
//
// Use this when a screen does MATH on these values against user input in the
// display currency (fiat-input conversion, Max fill, balance checks) — a
// render-only <Currency sourceCurrency=...> wrapper can't cover those paths.
// Render-only sites should still prefer <Currency>.
//
// Returns the input unchanged (same reference) when the basis already matches,
// when the tag is missing (pre-migration data is already in the then-active
// display currency), or when either rate is absent/unusable — so values are
// never re-tagged without actually being converted.
export function convertTokenFiatToCurrency<T extends ITokenFiat>({
  tokenFiat,
  targetCurrency,
  currencyMap,
}: {
  tokenFiat: T;
  targetCurrency: string;
  currencyMap: Record<string, ICurrencyItem>;
}): T {
  const sourceCurrency = tokenFiat.currency;
  if (!sourceCurrency || sourceCurrency === targetCurrency) return tokenFiat;
  const sourceRate = new BigNumber(currencyMap[sourceCurrency]?.value ?? NaN);
  const targetRate = new BigNumber(currencyMap[targetCurrency]?.value ?? NaN);
  // A zero target rate would silently turn every fiat field into 0 while
  // re-tagging the item as converted — treat it as unusable like the source.
  if (
    !sourceRate.isFinite() ||
    sourceRate.isZero() ||
    !targetRate.isFinite() ||
    targetRate.isZero()
  ) {
    return tokenFiat;
  }

  // Backend reports "--" (NaN once parsed) for unknown prices/values; leave
  // non-finite inputs untouched so downstream "is the price usable" guards
  // keep seeing the original sentinel instead of a fabricated number.
  const convertValue = <V extends string | number | undefined>(value: V): V => {
    if (value === undefined) return value;
    const bn = new BigNumber(value);
    if (!bn.isFinite()) return value;
    const converted = bn.div(sourceRate).times(targetRate);
    return (
      typeof value === 'number' ? converted.toNumber() : converted.toFixed()
    ) as V;
  };

  return {
    ...tokenFiat,
    price: convertValue(tokenFiat.price),
    fiatValue: convertValue(tokenFiat.fiatValue),
    frozenBalanceFiatValue: convertValue(tokenFiat.frozenBalanceFiatValue),
    totalBalanceFiatValue: convertValue(tokenFiat.totalBalanceFiatValue),
    currency: targetCurrency,
  };
}
