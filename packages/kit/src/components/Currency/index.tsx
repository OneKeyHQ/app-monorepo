import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { INumberSizeableTextProps } from '@onekeyhq/components';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

export interface ICurrencyProps extends INumberSizeableTextProps {
  // btc / eth / usd / sats / hkd
  sourceCurrency: string;
  targetCurrency?: string;
}
function BasicCurrency({
  sourceCurrency,
  targetCurrency,
  children,
  ...props
}: ICurrencyProps) {
  const [{ currencyItems }] = useCurrencyPersistAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const sourceCurrencyInfo = useMemo(
    () => currencyItems.find((i) => i.id === sourceCurrency),
    [currencyItems, sourceCurrency],
  );
  const targetCurrencyInfo = useMemo(() => {
    const currencyId = targetCurrency ?? currencyInfo.id;
    return currencyItems.find((i) => i.id === currencyId);
  }, [currencyInfo.id, currencyItems, targetCurrency]);

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
    <NumberSizeableTextWrapper
      formatter="price"
      formatterOptions={{ currency: targetCurrencyInfo?.unit }}
      {...props}
    >
      {value}
    </NumberSizeableTextWrapper>
  );
}

export const Currency = memo(BasicCurrency);
