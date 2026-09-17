import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Card } from '../RewardCard';

import { getRewardSummary } from './getRewardSummary';
import { NoRewardYet } from './NoRewardYet';

import type { IRewardSummaryItem } from './getRewardSummary';

export function UndistributedReward({
  rewards,
}: {
  rewards: readonly IRewardSummaryItem[];
}) {
  const intl = useIntl();
  const rewardSummary = useMemo(() => getRewardSummary(rewards), [rewards]);

  if (!rewardSummary.hasReward) {
    return <NoRewardYet />;
  }

  return (
    <Card.Item
      label={intl.formatMessage({
        id: ETranslations.referral_undistributed,
      })}
      value={
        rewardSummary.kind === 'token' ? (
          <Card.TokenValue
            tokenImageUri={rewardSummary.token?.logoURI}
            amount={rewardSummary.amount}
            symbol={rewardSummary.token?.symbol}
          />
        ) : (
          <Currency formatter="value" size="$bodyMdMedium">
            {rewardSummary.fiatValue}
          </Currency>
        )
      }
    />
  );
}
