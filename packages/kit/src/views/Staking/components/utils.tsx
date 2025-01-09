import { formatDistanceToNowStrict } from '@onekeyhq/shared/src/utils/dateUtils';

const TIME_23H = 23 * 3600;
const TIME_24H = 24 * 3600;

export function formatStakingDistanceToNowStrict(
  stakingTime?: number | string,
) {
  const number = Number(stakingTime);
  if (Number.isNaN(number) || number <= 0) {
    return undefined;
  }
  const stakingTimeNumber =
    number > TIME_23H && number < TIME_24H ? TIME_24H : number;
  return formatDistanceToNowStrict(Date.now() + stakingTimeNumber * 1000, {
    addSuffix: false,
  });
}
