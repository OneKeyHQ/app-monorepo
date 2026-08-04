import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, YStack, useMedia } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import {
  ResponsiveFourColumnLayout,
  RewardHeaderLayout,
  StatCard,
} from '@onekeyhq/kit/src/views/ReferFriends/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapCumulativeRewardsResponse } from '@onekeyhq/shared/src/referralCode/type';

interface ISwapRewardHeaderProps {
  data: ISwapCumulativeRewardsResponse | undefined;
  hasError?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
}

function formatFiatSubtitle({
  currencySymbol,
  label,
  value,
}: {
  currencySymbol: string;
  label: string;
  value: string;
}): string {
  return `${label}: ${currencySymbol}${new BigNumber(value || 0).toFixed(2)}`;
}

export function SwapRewardHeader({
  data,
  hasError,
  isLoading,
  onRefresh,
}: ISwapRewardHeaderProps) {
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { format } = useFormatDate();
  const { lg, md } = useMedia();
  const isWideScreen = !lg;

  const formattedNextDistributionDate = useMemo(() => {
    const value = data?.nextDistribution;
    if (!value) {
      return '';
    }

    const formattedDate = format(value, 'MMM d');
    return formattedDate === '-' ? value : formattedDate;
  }, [data?.nextDistribution, format]);

  if (!data) {
    if (hasError && onRefresh) {
      return (
        <YStack py="$8" gap="$3" ai="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_failed })}
          </SizableText>
          <Button
            testID="swap-reward-overview-retry"
            size="small"
            variant="secondary"
            onPress={onRefresh}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </YStack>
      );
    }
    return null;
  }

  const invitedAddresses = data.invitedAddresses || 0;
  const walletCount = data.walletCount || 0;
  const primarySubtitle = [
    formatFiatSubtitle({
      currencySymbol: currencyInfo.symbol,
      label: intl.formatMessage({
        id: ETranslations.referral_perps_total,
      }),
      value: data.totalRewardFiatValue,
    }),
    md
      ? formatFiatSubtitle({
          currencySymbol: currencyInfo.symbol,
          label: intl.formatMessage({
            id: ETranslations.referral_pending,
          }),
          value: data.pendingRewardFiatValue,
        })
      : undefined,
    formattedNextDistributionDate
      ? `${intl.formatMessage({
          id: ETranslations.referral_next_distribution,
        })}: ${formattedNextDistributionDate}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const undistributedCard = (
    <StatCard
      icon="CoinOutline"
      iconBgColor="$bgSuccess"
      iconColor="$iconSuccess"
      title={intl.formatMessage({
        id: ETranslations.referral_undistributed,
      })}
      value={data.undistributedRewardFiatValue || '0'}
      valueColor="$textSuccess"
      subtitle={primarySubtitle}
      showRefreshButton
      isLoading={isLoading}
      onRefresh={onRefresh}
      isWide={isWideScreen}
      fullWidth={!isWideScreen}
    />
  );

  const volumeCard = (
    <StatCard
      icon="ChartLineOutline"
      iconBgColor="$bgStrong"
      iconColor="$icon"
      title={intl.formatMessage({
        id: ETranslations.referral_perps_volume,
      })}
      value={data.totalVolumeFiatValue || '0'}
      subtitle={formatFiatSubtitle({
        currencySymbol: currencyInfo.symbol,
        label: intl.formatMessage({
          id: ETranslations.referral_perps_onekey_fee,
        }),
        value: data.totalFeeFiatValue,
      })}
      isWide={isWideScreen}
      fullWidth={!isWideScreen && !md}
    />
  );

  const invitedAddressesCard = (
    <StatCard
      icon="WalletOutline"
      iconBgColor="$bgStrong"
      iconColor="$icon"
      title={intl.formatMessage({
        id: ETranslations.referral_perps_invited_addresses,
      })}
      value={String(invitedAddresses)}
      isCurrency={false}
      subtitle={intl.formatMessage(
        { id: ETranslations.referral_perps_from_wallets },
        { number: walletCount },
      )}
      isWide={isWideScreen}
      fullWidth={!isWideScreen && !md}
    />
  );

  if (md) {
    return (
      <RewardHeaderLayout
        primaryCard={undistributedCard}
        secondaryCards={
          <>
            {volumeCard}
            {invitedAddressesCard}
          </>
        }
      />
    );
  }

  return (
    <ResponsiveFourColumnLayout
      gap="$3"
      pb="$8"
      px="$5"
      firstColumn={undistributedCard}
      secondColumn={
        <StatCard
          icon="ClockTimeHistoryOutline"
          iconBgColor="$bgStrong"
          iconColor="$icon"
          title={intl.formatMessage({
            id: ETranslations.referral_pending,
          })}
          value={data.pendingRewardFiatValue || '0'}
          isWide={isWideScreen}
          fullWidth={!isWideScreen}
        />
      }
      thirdColumn={volumeCard}
      fourthColumn={invitedAddressesCard}
    />
  );
}
