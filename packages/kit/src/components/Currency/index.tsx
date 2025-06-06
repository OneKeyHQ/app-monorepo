import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { INumberSizeableTextProps } from '@onekeyhq/components';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

export const useCurrency = () => {
  const [{ currencyInfo }] = useSettingsPersistAtom();
  return currencyInfo;
};

export interface ICurrencyProps extends INumberSizeableTextProps {
  // btc / eth / usd / sats / hkd
  sourceCurrency?: string;
  targetCurrency?: string;
}
function BasicCurrency({
  sourceCurrency,
  targetCurrency,
  formatterOptions,
  children,
  dynamicWidth,
  formatter = 'price',
  ...props
}: ICurrencyProps & {
  dynamicWidth?: (value: string, currency: string) => number;
}) {
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const sourceCurrencyInfo = useMemo(
    () => currencyMap[sourceCurrency ?? currencyInfo?.id],
    [currencyInfo?.id, currencyMap, sourceCurrency],
  );
  const targetCurrencyInfo = useMemo(
    () => currencyMap[targetCurrency ?? currencyInfo?.id],
    [currencyInfo?.id, currencyMap, targetCurrency],
  );

  const value = useMemo(() => {
    if (sourceCurrencyInfo?.id === targetCurrencyInfo?.id) {
      return BigNumber(String(children)).toFixed();
    }
    return sourceCurrencyInfo && targetCurrencyInfo
      ? new BigNumber(String(children))
          .div(new BigNumber(sourceCurrencyInfo.value))
          .times(new BigNumber(targetCurrencyInfo.value))
          .toFixed()
      : children;
  }, [children, sourceCurrencyInfo, targetCurrencyInfo]);

  return (
    <NumberSizeableTextWrapper
      formatter={formatter}
      formatterOptions={{
        currency: targetCurrencyInfo?.unit,
        ...formatterOptions,
      }}
      {...props}
      width={
        props.w ||
        props.width ||
        dynamicWidth?.(String(value || 0), targetCurrencyInfo?.unit || '')
      }
    >
      {value}
    </NumberSizeableTextWrapper>
  );
}

export const Currency = memo(BasicCurrency);
