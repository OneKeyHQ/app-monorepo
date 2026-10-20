import BigNumber from 'bignumber.js';

import { formatHlPrice } from '@onekeyhq/shared/src/utils/perpsUtils';

import { convertPerpsSizeDisplayValueToToken } from '../components/TradingPanel/inputs/sizeInputConversion';

export function getSimpleSliderAmount({
  percent,
  maxSize,
  price,
  leverage,
  inputUnit,
  decimals,
}: {
  percent: number;
  maxSize: string;
  price: string;
  leverage: number;
  inputUnit: 'token' | 'usd' | 'margin';
  decimals: number;
}) {
  let amount = new BigNumber(maxSize)
    .times(Math.max(0, Math.min(100, percent)))
    .div(100);
  if (inputUnit !== 'token') amount = amount.times(price);
  if (inputUnit === 'margin') amount = amount.div(leverage);
  return amount.isFinite() && amount.gte(0)
    ? amount.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed()
    : '0';
}

export function getSimpleLimitPricePreset(
  price: string,
  szDecimals: number,
  percent: 0 | 1 | 2 | 3,
  side: 'long' | 'short',
) {
  const offset = side === 'short' ? percent : -percent;
  return formatHlPrice(
    new BigNumber(price).times(100 + offset).div(100),
    szDecimals,
  );
}

export type ISimpleOrderError =
  | 'invalidAmount'
  | 'feeUnavailable'
  | 'minimumOrderValue'
  | 'insufficientMargin';

export function getSimpleOrderPreview({
  inputAmount,
  inputUnit = 'margin',
  price,
  leverage,
  szDecimals,
  maxSize,
  feeRate,
}: {
  inputAmount: string;
  inputUnit?: 'token' | 'usd' | 'margin';
  price: string;
  leverage: number;
  szDecimals: number;
  maxSize: string;
  feeRate: string;
}) {
  const validInput = /^(?:\d+\.?\d*|\.\d+)$/.test(inputAmount);
  let tokenSize = '';
  if (validInput && Number.isFinite(leverage) && leverage > 0) {
    tokenSize =
      inputUnit === 'token'
        ? new BigNumber(inputAmount)
            .decimalPlaces(szDecimals, BigNumber.ROUND_DOWN)
            .toFixed()
        : convertPerpsSizeDisplayValueToToken({
            displayValue: inputAmount,
            inputMode: inputUnit,
            referencePrice: price,
            leverage,
            szDecimals,
          });
  }
  const size = new BigNumber(tokenSize || 0);
  const value = size.times(price);
  const fees = value.times(feeRate);
  let notionalMultiplier: string | number = 1;
  if (inputUnit === 'margin') notionalMultiplier = leverage;
  else if (inputUnit === 'token') notionalMultiplier = price;
  let error: ISimpleOrderError | undefined;
  if (!validInput || new BigNumber(inputAmount).lte(0)) error = 'invalidAmount';
  else if (
    new BigNumber(price).isFinite() &&
    new BigNumber(price).gt(0) &&
    Number.isFinite(leverage) &&
    leverage > 0 &&
    new BigNumber(inputAmount).times(notionalMultiplier).lt(10)
  )
    error = 'minimumOrderValue';
  else if (!size.isFinite() || size.lte(0)) error = 'invalidAmount';
  else if (!fees.isFinite() || fees.lt(0)) error = 'feeUnavailable';
  else if (!value.isFinite() || value.lt(10)) error = 'minimumOrderValue';
  else if (!new BigNumber(maxSize).isFinite() || size.gt(maxSize))
    error = 'insufficientMargin';
  return { size, value, fees, error };
}

// Keep decimal entry as text; converting through Number loses a trailing decimal.
export function applySimpleAmountKey(value: string, key: string): string {
  if (key === 'backspace') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : `${value || '0'}.`;
  if (!/^[0-9]$/.test(key)) return value;
  return value === '0' ? key : `${value}${key}`;
}
