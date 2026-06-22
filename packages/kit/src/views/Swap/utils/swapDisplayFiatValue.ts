import BigNumber from 'bignumber.js';

import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function getSwapTokenDisplayFiatValue({
  token,
  amount,
  targetCurrency,
  currencyMap,
}: {
  token?: Pick<ISwapToken, 'price' | 'currency'>;
  amount: string;
  targetCurrency: string;
  currencyMap: Record<string, ICurrencyItem>;
}) {
  if (!token?.price || !amount) return '0';

  const fiatValueBN = new BigNumber(amount).multipliedBy(token.price);
  if (!fiatValueBN.isFinite()) return '0';

  return convertFiat({
    value: fiatValueBN.decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed(),
    sourceCurrency: token.currency ?? targetCurrency,
    targetCurrency,
    currencyMap,
  });
}
