import React, { FC, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { Text } from 'react-native';

import { useAppSelector, useSettings } from '@onekeyhq/kit/src/hooks/redux';

export type FormatOptions = {
  /** 向左偏移的位数，用于 decimal 的处理 */
  unit?: number;
  /** 保留小数位数 */
  fixed?: number;
  /** 是否完整显示 */
  fullPrecision?: boolean;
};

export type FormatAmountResult = {
  int: string;
  dec?: string;
  sep: string;
};

function decimalSeparator() {
  return (
    BigNumber.config(undefined as unknown as BigNumber.Config)?.FORMAT
      ?.decimalSeparator ?? ''
  );
}

function formatAmount(
  val: BigNumber.Value,
  opts: FormatOptions = {},
): FormatAmountResult | null {
  try {
    let bn = new BigNumber(val);
    if (opts.unit) {
      bn = bn.div(`1${'0'.repeat(opts.unit)}`);
    }

    // NaN or Infinite is not valid
    if (!bn.isFinite()) {
      return null;
    }

    const sep = decimalSeparator();

    if (opts.fullPrecision) {
      const [int, dec] = bn.toFormat().split(sep);
      if (typeof opts.fixed !== 'number' || opts.fixed <= 0) {
        return { int, dec, sep };
      }
      if (dec) {
        if (dec.length < opts.fixed) {
          return { int, dec: dec + '0'.repeat(opts.fixed - dec.length), sep };
        }
        return { int, dec, sep };
      }

      return { int, dec: '0'.repeat(opts.fixed), sep };
    }

    const [int, dec] = (
      typeof opts.fixed === 'number'
        ? // 向下取整
          bn.toFormat(opts.fixed, BigNumber.ROUND_FLOOR)
        : bn.toFormat()
    ).split(sep);
    return { int, dec, sep };
  } catch {
    return null;
  }
}

export function formatNumber(val: BigNumber.Value, opts: FormatOptions) {
  const formattedNumber = formatAmount(val, opts);

  if (!formattedNumber) return null;
  if (formattedNumber.dec === undefined) return `${formattedNumber.int}`;
  return `${formattedNumber.int}${formattedNumber.sep}${formattedNumber.dec}`;
}

export const FormatCurrency: FC<{
  numbers: (BigNumber.Value | string)[];
  formatOptions?: FormatOptions;
  render: (c: JSX.Element) => JSX.Element;
  as?: FC;
}> = ({ numbers, formatOptions = {}, as = Text, render }) => {
  const { selectedFiatMoneySymbol = 'usd' } = useSettings();
  const map = useAppSelector((s) => s.fiatMoney.map);
  const fiat = map[selectedFiatMoneySymbol];

  const amount = useMemo(() => {
    const fiatBN = new BigNumber(fiat);

    if (fiatBN.isNaN()) return null;

    return numbers.reduce((memo, curr) => {
      const memoBN = new BigNumber(memo);
      const currBN = new BigNumber(curr);
      return memoBN.multipliedBy(currBN);
    }, fiatBN);
  }, [fiat, numbers]);

  const child = useMemo(
    () => (
      <>
        {isNil(amount)
          ? '-'
          : formatNumber(amount, {
              ...formatOptions,
              // currency 固定保留两位，不抹零
              fixed: 2,
            })}
        &nbsp;{selectedFiatMoneySymbol.toUpperCase()}
      </>
    ),
    [amount, formatOptions, selectedFiatMoneySymbol],
  );

  if (render) {
    return render?.(child);
  }

  const Component = as;

  return <Component>{child}</Component>;
};
