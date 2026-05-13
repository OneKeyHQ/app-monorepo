import BigNumber from 'bignumber.js';

import {
  LIMIT_PRICE_DEFAULT_DECIMALS,
  LIMIT_PRICE_RATE_DECIMALS,
} from '../../types/swap/types';

const LIMIT_PRICE_INPUT_SIGNIFICANT_DECIMALS = 4;
const LIMIT_PRICE_INPUT_DEFAULT_DECIMALS = 6;

export function getSwapLimitPriceRateDecimals(tokenDecimals?: number) {
  const decimals = Number(tokenDecimals ?? LIMIT_PRICE_DEFAULT_DECIMALS);
  return Math.max(
    Number.isFinite(decimals) ? decimals : LIMIT_PRICE_DEFAULT_DECIMALS,
    LIMIT_PRICE_RATE_DECIMALS,
  );
}

function countLeadingZeroDecimals(value: BigNumber) {
  const [, decimalPart = ''] = value.abs().toFixed().split('.');
  const firstNonZeroIndex = decimalPart.search(/[1-9]/);
  return firstNonZeroIndex < 0 ? 0 : firstNonZeroIndex;
}

export function formatSwapLimitTokenPriceInputValue(value?: BigNumber.Value) {
  const valueBN = new BigNumber(value ?? '');
  if (!valueBN.isFinite() || valueBN.lte(0)) {
    return '';
  }

  const decimalPlaces = valueBN.abs().gte(1)
    ? LIMIT_PRICE_INPUT_DEFAULT_DECIMALS
    : countLeadingZeroDecimals(valueBN) +
      LIMIT_PRICE_INPUT_SIGNIFICANT_DECIMALS;

  return valueBN
    .decimalPlaces(decimalPlaces, BigNumber.ROUND_HALF_UP)
    .toFixed();
}
