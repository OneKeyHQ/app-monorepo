import { useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import type { IHardwareRecordItem } from '@onekeyhq/shared/src/referralCode/type';

import { HardwareRecordStatusBadge } from './HardwareRecordStatusBadge';
import {
  HardwareRecordTimeline,
  formatTimestamp,
} from './HardwareRecordTimeline';

interface IHardwareRecordCardProps {
  item: IHardwareRecordItem;
}

export function HardwareRecordCard({ item }: IHardwareRecordCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const formattedDate = formatTimestamp(item.orderPlacedAt);

  const isPositiveAmount = Number(item.rebateAmountFiatValue) >= 0;

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
        {/* Header - Status Badge and Amount */}
        <XStack jc="space-between" ai="center">
          <HardwareRecordStatusBadge
            status={item.status}
            statusLabel={item.statusLabel}
          />
          <Currency
            color={isPositiveAmount ? '$textSuccess' : '$textCritical'}
            formatter="value"
            size="$bodyMdMedium"
            formatterOptions={{
              showPlusMinusSigns: true,
            }}
          >
            {item.rebateAmountFiatValue}
          </Currency>
        </XStack>

        {/* Order Number */}
        <SizableText size="$bodyLgMedium" color="$text">
          {item.orderNumber}
        </SizableText>

        {/* Date, Invite Code, and Expand Icon */}
        <XStack jc="space-between" ai="center">
          <XStack gap="$3" ai="center" flex={1}>
            <SizableText size="$bodyMd" color="$textSubdued">
              {formattedDate}
            </SizableText>
            <Badge badgeType="default" badgeSize="sm">
              {item.inviteCode}
            </Badge>
          </XStack>
          <Stack animation="quick" rotate={isExpanded ? '180deg' : '0deg'}>
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </Stack>
        </XStack>
      </YStack>

      {/* Expanded Content - Order History Timeline */}
      {isExpanded && item.history && item.history.length > 0 ? (
        <HardwareRecordTimeline history={item.history} />
      ) : null}
    </YStack>
  );
}
