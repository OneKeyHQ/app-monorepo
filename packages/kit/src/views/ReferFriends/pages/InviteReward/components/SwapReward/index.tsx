import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useNavigateToSwapReward } from '../../../SwapReward/hooks/useNavigateToSwapReward';
import { Card } from '../RewardCard';
import { NoRewardYet } from '../shared/NoRewardYet';

import { getSwapRewardSummary } from './utils';

import type { ISwapRewardProps } from './types';

export function SwapReward({ swapRewards }: ISwapRewardProps) {
  const intl = useIntl();
  const navigateToSwapReward = useNavigateToSwapReward();
  const rewardSummary = useMemo(
    () => getSwapRewardSummary(swapRewards),
    [swapRewards],
  );

  return (
    <Card.Container flex={1}>
      <Card.Title
        icon="SwitchHorOutline"
        title={intl.formatMessage({
          id: ETranslations.global_trade,
        })}
        onPress={navigateToSwapReward}
      />

      {rewardSummary.hasReward ? (
        <Card.Item
          label={intl.formatMessage({
            id: ETranslations.referral_undistributed,
          })}
          value={
            rewardSummary.isSingleToken ? (
              <Card.TokenValue
                tokenImageUri={rewardSummary.token?.logoURI}
                amount={rewardSummary.amount}
                symbol={rewardSummary.token?.symbol}
              />
            ) : (
              <Currency formatter="value" size="$bodyMdMedium">
                {rewardSummary.amount}
              </Currency>
            )
          }
        />
      ) : (
        <NoRewardYet />
      )}
    </Card.Container>
  );
}
