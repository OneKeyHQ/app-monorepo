import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapInviteItem } from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { SWAP_INVITE_DESKTOP_COLUMN_WIDTHS } from '../utils';

import type { ISwapInviteColumnWidths } from './useSwapTableColumns';

interface ISwapInviteRecordProps {
  item: ISwapInviteItem;
  variant: 'desktop' | 'mobile';
  columnWidths?: ISwapInviteColumnWidths;
  isCompact?: boolean;
  showFixedDivider?: boolean;
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }
  return formatDate(dateString, { hideSeconds: true });
}

function isZeroValue(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }
  return Number(value) === 0;
}

function FiatValue({
  value,
  color = '$text',
}: {
  value: string;
  color?: '$text' | '$textSuccess';
}) {
  return (
    <Currency formatter="value" size="$bodyMd" color={color}>
      {value || '0'}
    </Currency>
  );
}

function SummaryFiatValue({
  isZeroData,
  value,
  color,
}: {
  isZeroData: boolean;
  value: string;
  color?: '$text' | '$textSuccess';
}) {
  if (isZeroData) {
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        --
      </SizableText>
    );
  }

  return <FiatValue value={value} color={color} />;
}

export function SwapInviteRecord({
  columnWidths = SWAP_INVITE_DESKTOP_COLUMN_WIDTHS,
  item,
  isCompact = false,
  showFixedDivider = false,
  variant,
}: ISwapInviteRecordProps) {
  const intl = useIntl();
  const [isExpanded, setIsExpanded] = useState(false);
  const isZeroData =
    isZeroValue(item.volumeFiatValue) &&
    isZeroValue(item.feeFiatValue) &&
    isZeroValue(item.rewardFiatValue);
  const firstTradeTime =
    isZeroData && !item.firstTradeTime
      ? '--'
      : formatDateTime(item.firstTradeTime);
  const firstTradeTimeColor =
    isZeroData && !item.firstTradeTime ? '$textSubdued' : '$text';

  const handleToggle = useCallback(() => {
    setIsExpanded((value) => !value);
  }, []);

  if (variant === 'mobile') {
    return (
      <YStack
        bg="$bgApp"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        overflow="hidden"
      >
        <YStack
          p="$4"
          gap="$3"
          cursor="pointer"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={handleToggle}
        >
          <XStack jc="space-between" ai="center" gap="$3">
            <SizableText size="$bodyLgMedium" flex={1}>
              {item.address}
            </SizableText>
            <SummaryFiatValue
              isZeroData={isZeroData}
              value={item.rewardFiatValue}
              color="$textSuccess"
            />
          </XStack>
          <XStack jc="space-between" ai="center">
            <XStack gap="$3" ai="center" flex={1}>
              <XStack gap="$1.5" ai="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_perps_volume,
                  })}
                </SizableText>
                <SummaryFiatValue
                  isZeroData={isZeroData}
                  value={item.volumeFiatValue}
                />
              </XStack>
              <Badge badgeType="default" badgeSize="sm">
                {item.inviteCode}
              </Badge>
            </XStack>
            <Stack
              transition="quick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
              rotate={isExpanded ? '0deg' : '-90deg'}
            >
              <Icon
                name="ChevronDownSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            </Stack>
          </XStack>
          {isExpanded ? (
            <XStack gap="$5" ai="flex-start">
              <YStack flex={1} gap="$3">
                <YStack gap="$1">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.referral_perps_invited_at,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMd">
                    {formatDateTime(item.invitationTime)}
                  </SizableText>
                </YStack>
                <YStack gap="$1">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.referral_perps_first_trade,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMd" color={firstTradeTimeColor}>
                    {firstTradeTime}
                  </SizableText>
                </YStack>
              </YStack>
              <YStack flex={1} gap="$1">
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_perps_onekey_fee,
                  })}
                </SizableText>
                <SummaryFiatValue
                  isZeroData={isZeroData}
                  value={item.feeFiatValue}
                />
              </YStack>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    );
  }

  return (
    <XStack
      pl={isCompact ? 0 : '$5'}
      pr="$5"
      py="$3"
      ai="center"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      bg="$bgApp"
    >
      <XStack
        w={columnWidths.address}
        ai="center"
        minWidth={0}
        pl={isCompact ? '$5' : undefined}
        borderRightWidth={
          showFixedDivider ? StyleSheet.hairlineWidth : undefined
        }
        borderRightColor="$borderSubdued"
        $platform-web={
          isCompact
            ? {
                position: 'sticky' as any,
                left: 0,
                zIndex: 2,
                backgroundColor: 'inherit',
              }
            : undefined
        }
      >
        <SizableText flex={1} size="$bodyMd" numberOfLines={1}>
          {item.address}
        </SizableText>
      </XStack>
      <XStack w={columnWidths.invitedAt} minWidth={0}>
        <SizableText size="$bodyMd">
          {formatDateTime(item.invitationTime)}
        </SizableText>
      </XStack>
      <XStack w={columnWidths.referralCode} minWidth={0}>
        <Badge badgeType="default" badgeSize="sm">
          {item.inviteCode}
        </Badge>
      </XStack>
      <XStack w={columnWidths.firstTrade} minWidth={0}>
        <SizableText size="$bodyMd" color={firstTradeTimeColor}>
          {firstTradeTime}
        </SizableText>
      </XStack>
      <XStack w={columnWidths.volume} minWidth={0}>
        <SummaryFiatValue
          isZeroData={isZeroData}
          value={item.volumeFiatValue}
        />
      </XStack>
      <XStack w={columnWidths.fee} minWidth={0}>
        <SummaryFiatValue isZeroData={isZeroData} value={item.feeFiatValue} />
      </XStack>
      <XStack w={columnWidths.rewards} minWidth={0} jc="flex-end">
        <SummaryFiatValue
          isZeroData={isZeroData}
          value={item.rewardFiatValue}
          color="$textSuccess"
        />
      </XStack>
    </XStack>
  );
}
