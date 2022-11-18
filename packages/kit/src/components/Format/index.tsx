/* eslint-disable no-nested-ternary */
import React, { FC, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { FormattedNumber } from 'react-intl';

import { Text } from '@onekeyhq/components';

import {
  useActiveSideAccount,
  useActiveWalletAccount,
  useAppSelector,
  useManageTokensOfAccount,
  useSettings,
} from '../../hooks';
import { Token } from '../../store/typings';
import { getSuggestedDecimals } from '../../utils/priceUtils';
import { formatDecimalZero, getFiatCodeUnit } from '../../views/Market/utils';

export type FormatOptions = {
  /** 向左偏移的位数，用于 decimal 的处理 */
  unit?: number;
  /** 单位显示最大位数 */
  unitMaxLength?: number;
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
          ? bn.toFormat(opts.fixed, BigNumber.ROUND_FLOOR) // TODO custom ROUND: round, floor, ceil
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

export function formatBalanceDisplay(
  balance?: BigNumber.Value | string,
  suffix?: string | null,
  formatOptions?: FormatOptions,
): { amount?: string; unit?: string } {
  const { unit, fixed, fullPrecision } = formatOptions || {};

  let newUnit = suffix ? suffix.toUpperCase().trim() : undefined;

  // Example: a data error causes the unit to be too long.
  // If it's too long, just take the first 11 characters.
  if (newUnit && newUnit.length > (formatOptions?.unitMaxLength ?? 20)) {
    newUnit = `${newUnit.slice(0, formatOptions?.unitMaxLength ?? 11)}...`;
  }

  if (isNil(balance)) {
    return {
      amount: undefined,
      unit: newUnit,
    };
  }
  const amount = formatNumber(balance, {
    unit,
    fixed,
    fullPrecision,
  });

  return {
    amount: amount || '0',
    unit: newUnit,
  };
}

export function useFormatAmount() {
  const useFormatBalanceDisplay = (
    balance?: BigNumber.Value,
    suffix?: string | null,
    formatOptions?: FormatOptions,
  ) =>
    useMemo(
      () => formatBalanceDisplay(balance, suffix, formatOptions),
      [balance, formatOptions, suffix],
    );

  const useFormatCurrencyDisplay = (
    numbers: (BigNumber.Value | string | undefined)[],
    formatOptions?: FormatOptions,
  ) => {
    // Because token prices are pulled with fiat parameters, the local fiat conversion is removed
    const { selectedFiatMoneySymbol = 'usd' } = useSettings();
    // const map = useAppSelector((s) => s.fiatMoney.map);
    // const fiat = map[selectedFiatMoneySymbol];
    const fiat = 1;

    const balance = useMemo(() => {
      const fiatBN = new BigNumber(fiat);

      if (fiatBN.isNaN()) {
        return undefined;
      }

      return numbers.reduce((memo, curr) => {
        if (curr === undefined || memo === undefined) return memo;
        const memoBN = new BigNumber(memo ?? '0');
        const currBN = new BigNumber(curr ?? '0');
        return memoBN.multipliedBy(currBN);
      }, fiatBN);
    }, [fiat, numbers]);

    return useMemo(() => {
      if (balance === undefined || balance === '0') {
        return { amount: undefined, unit: undefined };
      }

      const amount = formatNumber(balance, {
        ...formatOptions,
        fixed: 2,
        fullPrecision: true,
      });

      return {
        amount: amount || '0',
        unit: selectedFiatMoneySymbol.toUpperCase().trim(),
      };
    }, [balance, formatOptions, selectedFiatMoneySymbol]);
  };

  return { useFormatCurrencyDisplay, useFormatBalanceDisplay };
}

export const FormatCurrency: FC<{
  numbers: (BigNumber.Value | string | undefined)[];
  formatOptions?: FormatOptions;
  render: (c: JSX.Element) => JSX.Element;
  as?: FC;
}> = ({ numbers, formatOptions = {}, as = Text, render }) => {
  const { useFormatCurrencyDisplay } = useFormatAmount();
  const amount = useFormatCurrencyDisplay(numbers, formatOptions);

  const child = useMemo(
    () => (
      <>
        {numbers.length ? amount.amount : '--'}
        &nbsp;{amount.unit}
      </>
    ),
    [amount.amount, amount.unit, numbers.length],
  );

  if (render) {
    return render?.(child);
  }

  const Component = as;

  return <Component>{child}</Component>;
};
type IFormatCurrencyTokenProps = {
  token?: Token | null;
  value: BigNumber.Value | string | undefined;
  formatOptions?: FormatOptions;
  render: (c: JSX.Element) => JSX.Element;
  as?: FC;
};
export function FormatCurrencyTokenOfAccount({
  token,
  value,
  formatOptions = {},
  as,
  render,
  accountId,
  networkId,
}: IFormatCurrencyTokenProps & {
  accountId: string;
  networkId: string;
}) {
  const { prices } = useManageTokensOfAccount({
    accountId,
    networkId,
  });
  const priceKey =
    token && token.tokenIdOnNetwork ? token.tokenIdOnNetwork : 'main';
  const priceValue = prices?.[priceKey];
  const priceUndefined = priceValue === undefined || priceValue === null;
  return (
    <FormatCurrency
      numbers={
        priceUndefined ? [] : [priceValue, value, !value ? undefined : 1]
      }
      render={render}
      formatOptions={formatOptions}
      as={as}
    />
  );
}
export function FormatCurrencyToken(props: IFormatCurrencyTokenProps) {
  const { accountId, networkId } = useActiveWalletAccount();
  return (
    <FormatCurrencyTokenOfAccount
      {...props}
      accountId={accountId}
      networkId={networkId}
    />
  );
}

type IFormatCurrencyNativeProps = {
  value: BigNumber.Value | string | undefined;
  formatOptions?: FormatOptions;
  render: (c: JSX.Element) => JSX.Element;
  as?: FC;
};
export function FormatCurrencyNativeOfAccount({
  value,
  formatOptions = {},
  as,
  render,
  accountId,
  networkId,
}: IFormatCurrencyNativeProps & {
  accountId: string;
  networkId: string;
}) {
  return (
    <FormatCurrencyTokenOfAccount
      accountId={accountId}
      networkId={networkId}
      // token is native
      token={null}
      value={value}
      formatOptions={formatOptions}
      render={render}
      as={as}
    />
  );
}
export function FormatCurrencyNative(props: IFormatCurrencyNativeProps) {
  const { accountId, networkId } = useActiveWalletAccount();
  return (
    <FormatCurrencyNativeOfAccount
      {...props}
      accountId={accountId}
      networkId={networkId}
    />
  );
}

export const FormatBalance: FC<{
  balance: BigNumber.Value | string | undefined;
  suffix?: string;
  formatOptions?: FormatOptions;
  render?: (c: JSX.Element) => JSX.Element;
  as?: FC;
}> = ({ balance, formatOptions = {}, as = Text, render, suffix }) => {
  const { useFormatBalanceDisplay } = useFormatAmount();
  const amount = useFormatBalanceDisplay(balance, suffix, formatOptions);

  const child = useMemo(
    () => (
      <>
        {amount.amount}
        {amount?.unit ? ` ${amount?.unit}` : null}
      </>
    ),
    [amount.amount, amount?.unit],
  );

  if (render) {
    return render?.(child);
  }

  const Component = as;

  return <Component>{child}</Component>;
};

export function FormatBalanceTokenOfAccount({
  token,
  render,
  accountId,
  networkId,
}: {
  render?: (c: JSX.Element) => JSX.Element;
  token?: Token | null;
  accountId: string;
  networkId: string;
}) {
  const { getTokenBalance } = useManageTokensOfAccount({
    networkId,
    accountId,
  });
  const tokenBalance = useMemo(
    () =>
      getTokenBalance({
        token,
        defaultValue: '0',
      }),
    [getTokenBalance, token],
  );
  const { network } = useActiveSideAccount({
    accountId,
    networkId,
  });
  const isNativeToken = !token?.tokenIdOnNetwork;
  const decimal = isNativeToken
    ? network?.nativeDisplayDecimals
    : network?.tokenDisplayDecimals;

  return (
    <FormatBalance
      balance={tokenBalance}
      suffix={token?.symbol}
      formatOptions={{
        fixed: decimal ?? 4,
      }}
      render={
        render ??
        ((ele) => (
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {ele}
          </Text>
        ))
      }
    />
  );
}
export function FormatBalanceToken({
  token,
  render,
}: {
  render?: (c: JSX.Element) => JSX.Element;
  token?: Token | null;
}) {
  const { networkId, accountId } = useActiveWalletAccount();
  return (
    <FormatBalanceTokenOfAccount
      token={token}
      render={render}
      accountId={accountId}
      networkId={networkId}
    />
  );
}

export function FormatCurrencyNumber({
  decimals,
  value,
  onlyNumber,
  convertValue,
}: {
  value: number | BigNumber | '' | null | undefined;
  decimals?: number;
  onlyNumber?: boolean;
  convertValue?: number | BigNumber | '' | null | undefined;
}) {
  const { selectedFiatMoneySymbol = 'usd' } = useSettings();
  const fiatMap = useAppSelector((s) => s.fiatMoney.map);
  if (typeof value !== 'number' && !(value instanceof BigNumber)) {
    return null;
  }
  const fiat = fiatMap[selectedFiatMoneySymbol] || 0;
  const maxDecimals =
    decimals ??
    getSuggestedDecimals(value instanceof BigNumber ? value.toNumber() : value);
  const isBTCCurrency = selectedFiatMoneySymbol === 'btc';
  const numberValue = value instanceof BigNumber ? value.toNumber() : value;
  const numberConvertValue = convertValue
    ? new BigNumber(fiat).multipliedBy(convertValue).toNumber()
    : 0;
  const resNumber = numberValue + numberConvertValue;
  return (
    <>
      {`${
        isBTCCurrency && !onlyNumber
          ? getFiatCodeUnit(selectedFiatMoneySymbol)
          : ''
      }`}
      {resNumber < 0.01 ? (
        `${
          !isBTCCurrency && !onlyNumber
            ? getFiatCodeUnit(selectedFiatMoneySymbol)
            : ''
        }${formatDecimalZero(resNumber)}`
      ) : (
        <FormattedNumber
          value={resNumber ?? 0}
          currencyDisplay="narrowSymbol"
          // eslint-disable-next-line react/style-prop-object
          style={onlyNumber || isBTCCurrency ? 'decimal' : 'currency'}
          minimumFractionDigits={2}
          maximumFractionDigits={maxDecimals}
          currency={selectedFiatMoneySymbol}
        />
      )}
    </>
  );
}
