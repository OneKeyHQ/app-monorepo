import BigNumber from 'bignumber.js';

import type { ICurrencyItem } from '@onekeyhq/shared/types';

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
