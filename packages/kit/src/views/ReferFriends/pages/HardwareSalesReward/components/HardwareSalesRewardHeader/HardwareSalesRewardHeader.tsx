import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { XStack, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHardwareCumulativeRewards } from '@onekeyhq/shared/src/referralCode/type';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';

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

  const isWideScreen = !md;

  const distributed = cumulativeRewards.distributed || '0';
  const undistributed = cumulativeRewards.undistributed || '0';
  const pending = cumulativeRewards.pending || '0';
  const isPendingZero = BigNumber(pending).isZero();

  const totalEarned = BigNumber(distributed).plus(undistributed).toFixed();

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

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
            date: formatDateFns(cumulativeRewards.nextDistribution, 'MMMM d'),
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
          onRefresh={handleRefresh}
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
        onRefresh={handleRefresh}
        isWide={false}
        fullWidth
      />
      <XStack gap="$3">{renderSecondaryCards(false)}</XStack>
    </YStack>
  );
}
