import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToPerpsReward } from '../../../PerpsReward/hooks/useNavigateToPerpsReward';
import { Card } from '../RewardCard';
import { NoRewardYet } from '../shared/NoRewardYet';

import type { IPerpsRewardProps } from './types';

export function PerpsReward({ perpsCumulativeRewards }: IPerpsRewardProps) {
  const intl = useIntl();
  const navigateToPerpsReward = useNavigateToPerpsReward();

  const hasReward =
    perpsCumulativeRewards &&
    new BigNumber(perpsCumulativeRewards.undistributedReward).isGreaterThan(0);

  const handlePress = () => {
    navigateToPerpsReward();
  };

  return (
    <Card.Container flex={1}>
      <Card.Title
        icon="TradingViewCandlesOutline"
        title={intl.formatMessage({ id: ETranslations.global_perp })}
        description={intl.formatMessage({
          id: ETranslations.referral_perps_description,
        })}
        onPress={handlePress}
      />
      {hasReward ? (
        <Card.Item
          label={intl.formatMessage({
            id: ETranslations.referral_undistributed,
          })}
          value={
            <Card.TokenValue
              tokenImageUri={perpsCumulativeRewards.token?.logoURI}
              amount={perpsCumulativeRewards.undistributedReward}
              symbol={perpsCumulativeRewards.token?.symbol}
            />
          }
        />
      ) : (
        <NoRewardYet />
      )}
    </Card.Container>
  );
}

export { usePerpsCumulativeRewards } from './hooks/usePerpsCumulativeRewards';
