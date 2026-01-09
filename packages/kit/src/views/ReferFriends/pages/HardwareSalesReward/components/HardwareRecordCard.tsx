import { useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IColorTokens } from '@onekeyhq/components';
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

type IHardwareRecordStatus =
  | 'Completed'
  | 'Pending'
  | 'Undistributed'
  | 'Refunded';

const statusToRewardColor: Record<IHardwareRecordStatus, IColorTokens> = {
  Completed: '$textSuccess',
  Undistributed: '$textInfo',
  Refunded: '$textSubdued',
  Pending: '$textCaution',
};

interface IHardwareRecordCardProps {
  item: IHardwareRecordItem;
}

export function HardwareRecordCard({ item }: IHardwareRecordCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const formattedDate = formatTimestamp(item.orderPlacedAt);

  const rewardColor =
    statusToRewardColor[item.status as IHardwareRecordStatus] || '$textSuccess';

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
            color={rewardColor}
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
            {/* Date */}
            {formattedDate ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {formattedDate}
              </SizableText>
            ) : null}

            {/* Invite Code */}
            <Badge badgeType="default" badgeSize="sm">
              {item.inviteCode}
            </Badge>
          </XStack>
          <Stack animation="quick" rotate={isExpanded ? '-180deg' : '-90deg'}>
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
