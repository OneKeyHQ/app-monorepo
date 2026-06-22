import BigNumber from 'bignumber.js';

import type { IFetchQuoteResult } from '../../types/swap/types';

type ISwapQuoteDurationInput = {
  estTime?: IFetchQuoteResult['estTime'] | null;
  estimatedTime?: IFetchQuoteResult['estimatedTime'] | null;
};

function toPositiveBigNumber(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const valueBN = new BigNumber(value);
  if (!valueBN.isFinite() || valueBN.lte(0)) {
    return undefined;
  }

  return valueBN;
}

function formatMinutes(
  minutes: BigNumber,
  roundingMode: BigNumber.RoundingMode,
) {
  if (minutes.lt(1)) {
    return '< 1min';
  }

  if (minutes.gt(60)) {
    return '> 60min';
  }

  return `${minutes.integerValue(roundingMode).toFixed(0)}min`;
}

export function getSwapQuoteDurationMinutes(quote: ISwapQuoteDurationInput) {
  const estTimeMinutes = toPositiveBigNumber(quote.estTime);
  if (estTimeMinutes) {
    return estTimeMinutes;
  }

  const estimatedTimeSeconds = toPositiveBigNumber(quote.estimatedTime);
  return estimatedTimeSeconds?.dividedBy(60);
}

export function getSwapQuoteDurationSortValue(quote: ISwapQuoteDurationInput) {
  return getSwapQuoteDurationMinutes(quote) ?? new BigNumber(Infinity);
}

export function formatSwapQuoteDuration(quote: ISwapQuoteDurationInput) {
  const estTimeMinutes = toPositiveBigNumber(quote.estTime);
  if (estTimeMinutes) {
    return formatMinutes(estTimeMinutes, BigNumber.ROUND_UP);
  }

  const estimatedTimeSeconds = toPositiveBigNumber(quote.estimatedTime);
  if (!estimatedTimeSeconds) {
    return undefined;
  }

  return formatMinutes(estimatedTimeSeconds.dividedBy(60), BigNumber.ROUND_UP);
}
