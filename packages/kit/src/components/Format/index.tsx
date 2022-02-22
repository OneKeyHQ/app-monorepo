/* eslint-disable no-nested-ternary */
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
  /** 是否完整显示，为 false 时抹零 */
  fullPrecision?: boolean;
};

export type FormatAmountResult = {
  int: string;
  dec?: string;
  sep: string;
};

/** 默认使用 25 位小数防止格式化为科学计数法 */
BigNumber.config({ DECIMAL_PLACES: 25 });

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

    const [int, dec] = (
      typeof opts.fixed === 'number'
        ? // 向下取整
          opts.fullPrecision
          ? bn.toFormat(opts.fixed, BigNumber.ROUND_FLOOR)
          : bn.decimalPlaces(opts.fixed, BigNumber.ROUND_FLOOR).toFormat()
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
  numbers: (BigNumber.Value | string | undefined)[];
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
      if (curr === undefined || memo === undefined) return memo;
      const memoBN = new BigNumber(memo);
      const currBN = new BigNumber(curr);
      return memoBN.multipliedBy(currBN);
    }, fiatBN);
  }, [fiat, numbers]);

  const child = useMemo(
    () => (
      <>
        {isNil(amount) || numbers.some((number) => isNil(number))
          ? '-'
          : formatNumber(amount, {
              ...formatOptions,
              // currency 固定保留两位，不抹零
              fixed: 2,
              fullPrecision: true,
            })}
        &nbsp;{selectedFiatMoneySymbol.toUpperCase()}
      </>
    ),
    [amount, formatOptions, selectedFiatMoneySymbol, numbers],
  );

  if (render) {
    return render?.(child);
  }

  const Component = as;

  return <Component>{child}</Component>;
};

export const FormatBalance: FC<{
  balance: BigNumber.Value | string | undefined;
  suffix?: string;
  formatOptions?: FormatOptions;
  render?: (c: JSX.Element) => JSX.Element;
  as?: FC;
}> = ({ balance, formatOptions = {}, as = Text, render, suffix }) => {
  const balanceBN = useMemo(
    () => (isNil(balance) ? undefined : new BigNumber(balance)),
    [balance],
  );

  const child = useMemo(
    () => (
      <>
        {isNil(balanceBN) || balanceBN.isNaN()
          ? '-'
          : formatNumber(balanceBN, {
              ...formatOptions,
              // balance 需要抹零，同时展示当前 formatOptions 下所有的位数
              fullPrecision: false,
            })}
        {suffix ? `  ${suffix}` : null}
      </>
    ),
    [balanceBN, formatOptions, suffix],
  );

  if (render) {
    return render?.(child);
  }

  const Component = as;

  return <Component>{child}</Component>;
};
