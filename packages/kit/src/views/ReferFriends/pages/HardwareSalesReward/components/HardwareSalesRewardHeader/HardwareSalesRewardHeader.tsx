import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { YStack, useMedia } from '@onekeyhq/components';
import {
  RewardHeaderLayout,
  RewardSummaryCard,
  StatCard,
} from '@onekeyhq/kit/src/views/ReferFriends/components';
import { useNextDistributionLabel } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useNextDistributionLabel';
import { REFERRAL_USD_SOURCE_PROPS } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared/getRewardSummary';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHardwareCumulativeRewards } from '@onekeyhq/shared/src/referralCode/type';

interface IHardwareSalesRewardHeaderProps {
  cumulativeRewards: IHardwareCumulativeRewards;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function HardwareSalesRewardHeader({
  cumulativeRewards,
  isLoading,
  onRefresh,
}: IHardwareSalesRewardHeaderProps) {
  const intl = useIntl();
  const { md } = useMedia();

  const distributed = cumulativeRewards.distributed || '0';
  const undistributed = cumulativeRewards.undistributed || '0';
  const pending = cumulativeRewards.pending || '0';
  const isPendingZero = BigNumber(pending).isZero();

  const totalEarned = BigNumber(distributed).plus(undistributed).toFixed();

  const formattedNextDistributionDate =
    useNextDistributionLabel(cumulativeRewards.nextDistribution) ?? '';

  const unpaidHint = intl.formatMessage(
    { id: ETranslations.referral_expected_by_date },
    { date: formattedNextDistributionDate },
  );
  const pendingHint = intl.formatMessage({
    id: ETranslations.referral_days_to_confirm,
  });

  if (md) {
    return (
      <YStack px="$5" pb="$6">
        <RewardSummaryCard
          title={intl.formatMessage({
            id: ETranslations.referral_cumulative_rewards,
          })}
          value={totalEarned}
          sourceCurrency={REFERRAL_USD_SOURCE_PROPS.sourceCurrency}
          isLoading={isLoading}
          onRefresh={onRefresh}
          rows={[
            {
              label: intl.formatMessage({
                id: ETranslations.referral_undistributed,
              }),
              value: undistributed,
              sourceCurrency: REFERRAL_USD_SOURCE_PROPS.sourceCurrency,
              hint: unpaidHint,
            },
            {
              label: intl.formatMessage({ id: ETranslations.referral_pending }),
              value: pending,
              sourceCurrency: REFERRAL_USD_SOURCE_PROPS.sourceCurrency,
              prefix: isPendingZero ? undefined : '~',
              hint: pendingHint,
            },
          ]}
        />
      </YStack>
    );
  }

  return (
    <RewardHeaderLayout
      primaryCard={
        <StatCard
          sourceCurrency={REFERRAL_USD_SOURCE_PROPS.sourceCurrency}
          title={intl.formatMessage({
            id: ETranslations.referral_cumulative_rewards,
          })}
          value={totalEarned}
          showRefreshButton
          isLoading={isLoading}
          onRefresh={onRefresh}
        />
      }
      secondaryCards={
        <>
          <StatCard
            sourceCurrency={REFERRAL_USD_SOURCE_PROPS.sourceCurrency}
            title={intl.formatMessage({
              id: ETranslations.referral_undistributed,
            })}
            value={undistributed}
            subtitle={unpaidHint}
          />
          <StatCard
            sourceCurrency={REFERRAL_USD_SOURCE_PROPS.sourceCurrency}
            title={intl.formatMessage({
              id: ETranslations.referral_pending,
            })}
            value={pending}
            prefix={isPendingZero ? undefined : '~'}
            subtitle={pendingHint}
          />
        </>
      }
    />
  );
}
