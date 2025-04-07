import BigNumber from 'bignumber.js';

import { formatDistanceToNowStrict } from '@onekeyhq/shared/src/utils/dateUtils';

const TIME_23H = 23 * 3600;
const TIME_24H = 24 * 3600;

const MAX_STAKING_DISTANCE = 24 * 3600 * 365 * 10;
export function formatStakingDistanceToNowStrict(
  stakingTime?: number | string,
) {
  const number = Number(stakingTime);
  if (!Number.isFinite(number) || Number.isNaN(number) || number <= 0) {
    return undefined;
  }
  const stakingTimeNumber =
    number > TIME_23H && number < TIME_24H
      ? TIME_24H
      : Math.min(number, MAX_STAKING_DISTANCE);
  return formatDistanceToNowStrict(Date.now() + stakingTimeNumber * 1000, {
    addSuffix: false,
  });
}

export const formatApy = (apy: string | number | undefined): string => {
  if (!apy) return '0';
  return new BigNumber(apy).decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed(2);
};
