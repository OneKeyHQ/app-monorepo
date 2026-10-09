import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { YStack, useMedia } from '@onekeyhq/components';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import {
  RewardHeaderLayout,
  RewardSummaryCard,
  StatCard,
} from '@onekeyhq/kit/src/views/ReferFriends/components';
import { REFERRAL_USD_CURRENCY_PROPS } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared/getRewardSummary';
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
  const locale = useLocaleVariant();

  const distributed = cumulativeRewards.distributed || '0';
  const undistributed = cumulativeRewards.undistributed || '0';
  const pending = cumulativeRewards.pending || '0';
  const isPendingZero = BigNumber(pending).isZero();

  const totalEarned = BigNumber(distributed).plus(undistributed).toFixed();

  const formattedNextDistributionDate = useMemo(() => {
    const { nextDistribution } = cumulativeRewards;
    if (!nextDistribution) return '';

    const date =
      typeof nextDistribution === 'string'
        ? new Date(nextDistribution)
        : nextDistribution;

    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }, [cumulativeRewards, locale]);

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
            id: ETranslations.earn_referral_total_earned,
          })}
          value={totalEarned}
          fixedCurrency={REFERRAL_USD_CURRENCY_PROPS.targetCurrency}
          isLoading={isLoading}
          onRefresh={onRefresh}
          rows={[
            {
              label: intl.formatMessage({
                id: ETranslations.referral_undistributed,
              }),
              value: undistributed,
              fixedCurrency: REFERRAL_USD_CURRENCY_PROPS.targetCurrency,
              hint: unpaidHint,
            },
            {
              label: intl.formatMessage({ id: ETranslations.referral_pending }),
              value: pending,
              fixedCurrency: REFERRAL_USD_CURRENCY_PROPS.targetCurrency,
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
          fixedCurrency={REFERRAL_USD_CURRENCY_PROPS.targetCurrency}
          title={intl.formatMessage({
            id: ETranslations.earn_referral_total_earned,
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
            fixedCurrency={REFERRAL_USD_CURRENCY_PROPS.targetCurrency}
            title={intl.formatMessage({
              id: ETranslations.referral_undistributed,
            })}
            value={undistributed}
            subtitle={unpaidHint}
          />
          <StatCard
            fixedCurrency={REFERRAL_USD_CURRENCY_PROPS.targetCurrency}
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
