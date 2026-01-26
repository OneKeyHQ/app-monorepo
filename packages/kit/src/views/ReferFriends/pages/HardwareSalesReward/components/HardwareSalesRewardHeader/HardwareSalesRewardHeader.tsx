import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { XStack, YStack, useMedia } from '@onekeyhq/components';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHardwareCumulativeRewards } from '@onekeyhq/shared/src/referralCode/type';

import { StatCard } from './StatCard';

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

  const isWideScreen = !md;

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

  const renderSecondaryCards = (isWide: boolean) => (
    <>
      <StatCard
        icon="ClockTimeHistoryOutline"
        iconBgColor="$bgStrong"
        iconColor="$icon"
        title={intl.formatMessage({
          id: ETranslations.referral_undistributed,
        })}
        amount={undistributed}
        subtitle={intl.formatMessage(
          { id: ETranslations.referral_expected_by_date },
          {
            date: formattedNextDistributionDate,
          },
        )}
        isWide={isWide}
      />
      <StatCard
        icon="HourglassOutline"
        iconBgColor="$bgStrong"
        iconColor="$icon"
        title={intl.formatMessage({
          id: ETranslations.referral_pending,
        })}
        amount={pending}
        prefix={isPendingZero ? undefined : '~'}
        subtitle={intl.formatMessage({
          id: ETranslations.referral_days_to_confirm,
        })}
        isWide={isWide}
      />
    </>
  );

  // Wide screen layout: 3 cards in a row
  if (isWideScreen) {
    return (
      <XStack gap="$3" pb="$8" px="$5">
        <StatCard
          icon="CoinOutline"
          iconBgColor="$bgSuccess"
          iconColor="$iconSuccess"
          title={intl.formatMessage({
            id: ETranslations.referral_total_reward,
          })}
          amount={totalEarned}
          showRefreshButton
          isLoading={isLoading}
          onRefresh={onRefresh}
          isWide
        />
        {renderSecondaryCards(true)}
      </XStack>
    );
  }

  // Narrow screen layout: 1 card on top, 2 cards below
  return (
    <YStack gap="$3" pb="$8" px="$5">
      <StatCard
        icon="CoinOutline"
        iconBgColor="$bgSuccess"
        iconColor="$iconSuccess"
        title={intl.formatMessage({
          id: ETranslations.earn_referral_total_earned,
        })}
        amount={totalEarned}
        showRefreshButton
        isLoading={isLoading}
        onRefresh={onRefresh}
        isWide={false}
        fullWidth
      />
      <XStack gap="$3">{renderSecondaryCards(false)}</XStack>
    </YStack>
  );
}
