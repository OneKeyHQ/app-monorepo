import { memo, useMemo } from 'react';

import type { INumberSizeableTextProps } from '@onekeyhq/components';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { UNAVAILABLE_DISPLAY } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { convertFiat } from '../../utils/fiatConvert';
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
  const effectiveSource = sourceCurrency ?? currencyInfo?.id;
  const effectiveTarget = targetCurrency ?? currencyInfo?.id;

  const value = useMemo(() => {
    if (children === undefined || children === null || children === '') {
      return '0';
    }
    // Pass the unavailable sentinel through unchanged so NumberSizeableText
    // can render the literal placeholder instead of formatting NaN.
    if (children === UNAVAILABLE_DISPLAY) {
      return UNAVAILABLE_DISPLAY;
    }
    return convertFiat({
      value: String(children),
      sourceCurrency: effectiveSource,
      targetCurrency: effectiveTarget,
      currencyMap,
    });
  }, [children, effectiveSource, effectiveTarget, currencyMap]);

  // When the rate map can't resolve the target unit yet (cold-start window
  // before currencyMap hydrates), fall back to the source unit so the rendered
  // symbol matches the numeric basis.
  const formatterCurrencyUnit =
    currencyMap[effectiveTarget]?.unit ?? currencyMap[effectiveSource]?.unit;

  return (
    <NumberSizeableTextWrapper
      formatter={formatter}
      formatterOptions={{
        currency: formatterCurrencyUnit,
        ...formatterOptions,
      }}
      {...props}
      width={
        props.w ||
        props.width ||
        dynamicWidth?.(String(value || 0), formatterCurrencyUnit || '')
      }
    >
      {value}
    </NumberSizeableTextWrapper>
  );
}

export const Currency = memo(BasicCurrency);
