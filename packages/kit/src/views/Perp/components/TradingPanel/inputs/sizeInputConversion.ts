import BigNumber from 'bignumber.js';

import {
  formatHlSize,
  getMinimumOrderSize,
} from '@onekeyhq/shared/src/utils/perpsUtils';

/**
 * Whether a reference-price change can be ignored because nothing needs
 * re-converting.
 *
 * A usd/margin amount typed while the price was empty converts to nothing, so it
 * never produces a token value. Skipping on an empty token value alone would
 * strand that amount: the later price entry would not convert it, and the order
 * would still submit as "no size".
 */
export function canSkipPerpsSizePriceConversion({
  tokenValue,
  inputMode,
  usdAmount,
  marginAmount,
}: {
  tokenValue: string;
  inputMode: 'token' | 'usd' | 'margin';
  usdAmount: string;
  marginAmount: string;
}) {
  if (tokenValue) {
    return false;
  }
  if (inputMode === 'usd') {
    return !usdAmount;
  }
  if (inputMode === 'margin') {
    return !marginAmount;
  }
  return true;
}

export function convertPerpsSizeDisplayValueToToken({
  displayValue,
  inputMode,
  referencePrice,
  leverage,
  szDecimals,
}: {
  displayValue: string;
  inputMode: 'usd' | 'margin';
  referencePrice: string;
  leverage: number;
  szDecimals: number;
}) {
  const displayValueBN = new BigNumber(displayValue);
  const referencePriceBN = new BigNumber(referencePrice);
  if (
    !displayValueBN.isFinite() ||
    !referencePriceBN.isFinite() ||
    !referencePriceBN.gt(0)
  ) {
    return '';
  }

  const notionalValue =
    inputMode === 'margin'
      ? displayValueBN.multipliedBy(leverage || 1)
      : displayValueBN;
  return formatHlSize(notionalValue.dividedBy(referencePriceBN), szDecimals);
}

export function getPerpsMinimumOrderSuggestion({
  price,
  szDecimals,
  minimumNotional,
  inputMode,
  leverage,
  symbol,
}: {
  price: BigNumber.Value;
  szDecimals: number;
  minimumNotional: number;
  inputMode: 'token' | 'usd' | 'margin';
  leverage: number;
  symbol: string;
}) {
  const tokenValue = getMinimumOrderSize({
    price,
    szDecimals,
    minimumNotional,
  })?.toFixed(szDecimals);
  if (!tokenValue) return undefined;
  if (inputMode === 'token') {
    return {
      displayValue: tokenValue,
      label: `${tokenValue} ${symbol}`.trim(),
    };
  }

  const orderValue = new BigNumber(tokenValue).multipliedBy(price);
  const displayValue = (
    inputMode === 'margin' ? orderValue.dividedBy(leverage || 1) : orderValue
  ).toFixed(2, BigNumber.ROUND_CEIL);
  return { displayValue, label: `$${displayValue}` };
}
