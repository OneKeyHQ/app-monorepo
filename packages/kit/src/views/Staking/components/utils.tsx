import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDistanceToNowStrict } from '@onekeyhq/shared/src/utils/dateUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

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

export const renderStakeText = (provider?: string): ETranslations => {
  if (provider && earnUtils.isMorphoProvider({ providerName: provider })) {
    return ETranslations.earn_supply;
  }
  return ETranslations.earn_stake;
};
