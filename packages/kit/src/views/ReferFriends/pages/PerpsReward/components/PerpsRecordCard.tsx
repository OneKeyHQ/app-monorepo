import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IPerpsInviteItem } from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

interface IPerpsRecordCardProps {
  item: IPerpsInviteItem;
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return formatDate(dateString, { hideSeconds: true });
}

function isZeroValue(value: string | null | undefined): boolean {
  if (!value) return true;
  return Number(value) === 0;
}

function DetailItem({
  label,
  value,
  valueColor,
  showTooltip,
  tooltipContent,
}: {
  label: string;
  value: string;
  valueColor?: string;
  showTooltip?: boolean;
  tooltipContent?: string;
}) {
  return (
    <YStack gap="$1.5">
      <XStack ai="center" gap="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {label}
        </SizableText>
        {showTooltip && tooltipContent ? (
          <Popover.Tooltip
            title={label}
            tooltip={tooltipContent}
            placement="bottom"
            iconSize="$4"
          />
        ) : null}
      </XStack>
      <SizableText size="$bodyMdMedium" color={valueColor ?? '$text'}>
        {value}
      </SizableText>
    </YStack>
  );
}

export function PerpsRecordCard({ item }: IPerpsRecordCardProps) {
  const intl = useIntl();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const isZeroData =
    isZeroValue(item.volumeFiatValue) &&
    isZeroValue(item.feeFiatValue) &&
    isZeroValue(item.rewardFiatValue);

  return (
    <YStack
      bg="$bgApp"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      {/* Collapsed Content */}
      <YStack
        p="$4"
        gap="$3"
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={handleToggle}
      >
        {/* Header - Address and Reward */}
        <XStack jc="space-between" ai="center">
          <SizableText size="$bodyLgMedium" color="$text">
            {item.address}
          </SizableText>
          {isZeroData ? (
            <SizableText size="$bodyLgMedium" color="$textSubdued">
              --
            </SizableText>
          ) : (
            <Currency
              color="$textSuccess"
              formatter="value"
              size="$bodyLgMedium"
              formatterOptions={{
                showPlusMinusSigns: true,
              }}
            >
              {item.rewardFiatValue}
            </Currency>
          )}
        </XStack>

        {/* Volume, Badge, and Expand Icon */}
        <XStack jc="space-between" ai="center">
          <XStack gap="$3" ai="center" flex={1}>
            {/* Volume */}
            <XStack gap="$2" ai="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                Vol.
              </SizableText>
              {isZeroData ? (
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  --
                </SizableText>
              ) : (
                <Currency formatter="value" size="$bodyMdMedium" color="$text">
                  {item.volumeFiatValue}
                </Currency>
              )}
            </XStack>

            {/* Invite Code Badge */}
            <Badge badgeType="default" badgeSize="sm">
              {item.inviteCode}
            </Badge>
          </XStack>

          {/* Expand Icon */}
          <Stack animation="quick" rotate={isExpanded ? '0deg' : '-90deg'}>
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </Stack>
        </XStack>
      </YStack>

      {/* Expanded Content */}
      {isExpanded ? (
        <YStack
          bg="$bgSubdued"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$neutral2"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$neutral2"
          pt="$2"
          pb="$4"
        >
          <XStack px="$5" gap="$4">
            {/* Left Column */}
            <YStack flex={1} gap="$4">
              <DetailItem
                label={intl.formatMessage({
                  id: ETranslations.referral_perps_invited_at,
                })}
                value={formatDateTime(item.invitationTime)}
              />
              <DetailItem
                label={intl.formatMessage({
                  id: ETranslations.referral_perps_first_trade,
                })}
                value={
                  isZeroData && !item.firstTradeTime
                    ? '--'
                    : formatDateTime(item.firstTradeTime)
                }
                valueColor={
                  isZeroData && !item.firstTradeTime
                    ? '$textSubdued'
                    : undefined
                }
              />
            </YStack>

            {/* Right Column */}
            <YStack flex={1} gap="$4">
              <DetailItem
                label={intl.formatMessage({
                  id: ETranslations.referral_perps_onekey_fee,
                })}
                value={isZeroData ? '--' : `$${item.feeFiatValue}`}
                valueColor={isZeroData ? '$textSubdued' : undefined}
                showTooltip
                tooltipContent={intl.formatMessage({
                  id: ETranslations.referral_perps_onekey_fee_exclusion_notice,
                })}
              />
            </YStack>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  );
}
