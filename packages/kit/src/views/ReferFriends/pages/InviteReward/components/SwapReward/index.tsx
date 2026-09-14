import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToSwapReward } from '../../../SwapReward/hooks/useNavigateToSwapReward';
import { Card } from '../RewardCard';
import { UndistributedReward } from '../shared/UndistributedReward';

import type { ISwapRewardProps } from './types';

export function SwapReward({ swapRewards }: ISwapRewardProps) {
  const intl = useIntl();
  const navigateToSwapReward = useNavigateToSwapReward();

  return (
    <Card.Container flex={1}>
      <Card.Title
        icon="SwitchHorOutline"
        title={intl.formatMessage({
          id: ETranslations.swap_referral_link__title,
        })}
        onPress={navigateToSwapReward}
      />

      <UndistributedReward rewards={swapRewards} />
    </Card.Container>
  );
}
