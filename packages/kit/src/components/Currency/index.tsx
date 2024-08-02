import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { INumberSizeableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';
import { useCurrencyPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export interface ICurrencyProps extends INumberSizeableTextProps {
  // btc / eth / usd / sats / hkd
  sourceCurrency: string;
  targetCurrency: string;
}
function BasicCurrency({
  sourceCurrency,
  targetCurrency,
  children,
  ...props
}: ICurrencyProps) {
  const [{ currencyItems }] = useCurrencyPersistAtom();
  const sourceCurrencyInfo = useMemo(
    () => currencyItems.find((i) => i.id === sourceCurrency),
    [currencyItems, sourceCurrency],
  );
  const targetCurrencyInfo = useMemo(
    () => currencyItems.find((i) => i.id === targetCurrency),
    [currencyItems, targetCurrency],
  );

  const value = useMemo(
    () =>
      sourceCurrencyInfo && targetCurrencyInfo
        ? new BigNumber(String(children))
            .div(new BigNumber(sourceCurrencyInfo.value))
            .times(new BigNumber(targetCurrencyInfo.value))
            .toFixed()
        : children,
    [children, sourceCurrencyInfo, targetCurrencyInfo],
  );
  return (
    <NumberSizeableText
      formatter="price"
      formatterOptions={{ currency: targetCurrencyInfo?.unit }}
      {...props}
    >
      {value}
    </NumberSizeableText>
  );
}

export const Currency = memo(BasicCurrency);
