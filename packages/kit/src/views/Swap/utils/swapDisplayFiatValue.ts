import BigNumber from 'bignumber.js';

import {
  canConvertFiat,
  convertFiat,
} from '@onekeyhq/kit/src/utils/fiatConvert';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function getSwapTokenDisplayFiatValue({
  token,
  amount,
  sourceCurrency,
  targetCurrency,
  currencyMap,
  strictCurrencyConversion = false,
}: {
  token?: Pick<ISwapToken, 'price' | 'currency'>;
  amount: string;
  sourceCurrency?: string;
  targetCurrency: string;
  currencyMap: Record<string, ICurrencyItem>;
  strictCurrencyConversion?: boolean;
}) {
  const price = token?.price;
  if (!price || !amount) return '0';

  const fiatValueBN = new BigNumber(amount).multipliedBy(price);
  if (!fiatValueBN.isFinite()) return '0';

  const resolvedSourceCurrency =
    token.currency ?? sourceCurrency ?? targetCurrency;
  if (
    strictCurrencyConversion &&
    !fiatValueBN.isZero() &&
    !canConvertFiat({
      sourceCurrency: resolvedSourceCurrency,
      targetCurrency,
      currencyMap,
    })
  ) {
    return '--';
  }

  return convertFiat({
    value: strictCurrencyConversion
      ? fiatValueBN.toFixed()
      : fiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(),
    sourceCurrency: resolvedSourceCurrency,
    targetCurrency,
    currencyMap,
  });
}

export function getSwapTokenDisplayPrice({
  token,
  sourceCurrency,
  targetCurrency,
  currencyMap,
}: {
  token?: Pick<ISwapToken, 'price' | 'currency'>;
  sourceCurrency?: string;
  targetCurrency: string;
  currencyMap: Record<string, ICurrencyItem>;
}) {
  const price = token?.price;
  if (!price) return undefined;

  const priceBN = new BigNumber(price);
  if (!priceBN.isFinite() || !priceBN.gt(0)) return undefined;

  return convertFiat({
    value: priceBN.toFixed(),
    sourceCurrency: token.currency ?? sourceCurrency ?? targetCurrency,
    targetCurrency,
    currencyMap,
  });
}
