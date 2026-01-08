import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IStackStyle } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IHardwareCumulativeRewards } from '@onekeyhq/shared/src/referralCode/type';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';

interface IHardwareSalesRewardHeaderProps {
  cumulativeRewards: IHardwareCumulativeRewards;
  isLoading?: boolean;
  onRefresh?: () => void;
}

function StatCard({
  icon,
  iconBgColor,
  iconColor,
  title,
  amount,
  prefix,
  subtitle,
  showRefreshButton,
  isLoading,
  onRefresh,
  isWide,
}: {
  icon: 'CoinOutline' | 'ClockTimeHistoryOutline' | 'HourglassOutline';
  iconBgColor: IStackStyle['bg'];
  iconColor: ColorTokens;
  title: string;
  amount: string;
  prefix?: string;
  subtitle?: string;
  showRefreshButton?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  isWide: boolean;
}) {
  return (
    <YStack
      flex={1}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      p={isWide ? '$5' : '$4'}
      gap={isWide ? '$5' : '$4'}
    >
      <XStack jc="space-between" ai="center">
        <Stack bg={iconBgColor} p="$2" borderRadius="$2">
          <Icon name={icon} size="$5" color={iconColor} />
        </Stack>
        {showRefreshButton ? (
          <IconButton
            icon="RefreshCcwOutline"
            variant="tertiary"
            size="small"
            loading={isLoading}
            onPress={onRefresh}
          />
        ) : null}
      </XStack>

      <YStack gap={subtitle ? '$2.5' : undefined}>
        <YStack>
          <SizableText
            size={isWide ? '$bodyLgMedium' : '$bodyMdMedium'}
            color="$textSubdued"
          >
            {title}
          </SizableText>
          <XStack ai="baseline">
            {prefix ? (
              <SizableText
                size={isWide ? '$heading5xl' : '$headingXl'}
                color="$text"
              >
                {prefix}
              </SizableText>
            ) : null}
            <Currency
              size={isWide ? '$heading5xl' : '$headingXl'}
              color="$text"
              formatter="value"
            >
              {amount}
            </Currency>
          </XStack>
        </YStack>
        {subtitle ? (
          <SizableText
            size={isWide ? '$bodyMd' : '$bodySm'}
            color="$textSubdued"
          >
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
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
      {/* Total earned card - full width */}
      <YStack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        p="$4"
        gap="$4"
      >
        <XStack jc="space-between" ai="center">
          <Stack bg="$bgSuccess" p="$2" borderRadius="$2">
            <Icon name="CoinOutline" size="$5" color="$iconSuccess" />
          </Stack>
          <IconButton
            icon="RefreshCcwOutline"
            variant="tertiary"
            size="small"
            loading={isLoading}
            onPress={handleRefresh}
          />
        </XStack>

        <YStack>
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.earn_referral_total_earned,
            })}
          </SizableText>
          <Currency size="$heading4xl" color="$text" formatter="value">
            {totalEarned}
          </Currency>
        </YStack>
      </YStack>

      {/* Two cards side by side */}
      <XStack gap="$3">{renderSecondaryCards(false)}</XStack>
    </YStack>
  );
}
