import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

// Column width percentages for consistent alignment
const COLUMN_WIDTHS = {
  time: '30%',
  orderId: '20%',
  status: '20%',
  referralCode: '15%',
  rewards: '15%',
} as const;

interface IHardwareRecordTableProps {
  records: IHardwareRecordItem[];
}

interface ITableRowProps {
  item: IHardwareRecordItem;
}

function TableRow({ item }: ITableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const formattedDate = formatTimestamp(item.orderPlacedAt);
  const rewardColor =
    statusToRewardColor[item.status as IHardwareRecordStatus] || '$textSuccess';

  return (
    <>
      <XStack
        ai="center"
        px="$5"
        py="$2"
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={handleToggle}
      >
        {/* Time Column */}
        <XStack w={COLUMN_WIDTHS.time} ai="center" gap="$2" py="$1">
          <Stack
            w="$5"
            ai="center"
            jc="center"
            animation="quick"
            rotate={isExpanded ? '180deg' : '0deg'}
          >
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </Stack>
          <SizableText size="$bodyMdMedium" color="$text">
            {formattedDate}
          </SizableText>
        </XStack>

        {/* Order ID Column */}
        <XStack w={COLUMN_WIDTHS.orderId} ai="center" py="$1">
          <SizableText size="$bodyMdMedium" color="$text">
            {item.orderNumber}
          </SizableText>
        </XStack>

        {/* Status Column */}
        <XStack w={COLUMN_WIDTHS.status} ai="center" py="$1">
          <HardwareRecordStatusBadge
            status={item.status}
            statusLabel={item.statusLabel}
          />
        </XStack>

        {/* Referral Code Column */}
        <XStack w={COLUMN_WIDTHS.referralCode} ai="center" py="$1">
          <Badge badgeType="default" badgeSize="sm">
            {item.inviteCode}
          </Badge>
        </XStack>

        {/* Rewards Column */}
        <XStack w={COLUMN_WIDTHS.rewards} ai="center" jc="flex-end" py="$1">
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
      </XStack>

      {/* Expanded Content - Order History Timeline */}
      {isExpanded && item.history && item.history.length > 0 ? (
        <HardwareRecordTimeline history={item.history} />
      ) : null}
    </>
  );
}

export function HardwareRecordTable({ records }: IHardwareRecordTableProps) {
  const intl = useIntl();

  if (!records || records.length === 0) {
    return null;
  }

  return (
    <YStack
      bg="$bgApp"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
      py="$2"
    >
      {/* Table Header */}
      <XStack ai="center" px="$5" py="$2">
        <XStack w={COLUMN_WIDTHS.time} ai="center" gap="$2">
          {/* Spacer to align with chevron icon in rows */}
          <Stack w="$5" />
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({
              id: ETranslations.global_time,
            })}
          </SizableText>
        </XStack>
        <XStack w={COLUMN_WIDTHS.orderId}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({
              id: ETranslations.referral_order_id,
              defaultMessage: 'Order ID',
            })}
          </SizableText>
        </XStack>
        <XStack w={COLUMN_WIDTHS.status}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({
              id: ETranslations.global_status,
            })}
          </SizableText>
        </XStack>
        <XStack w={COLUMN_WIDTHS.referralCode}>
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({
              id: ETranslations.referral_referral_code,
              defaultMessage: 'Referral Code',
            })}
          </SizableText>
        </XStack>
        <XStack w={COLUMN_WIDTHS.rewards} jc="flex-end">
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({
              id: ETranslations.earn_rewards,
            })}
          </SizableText>
        </XStack>
      </XStack>

      {/* Table Rows */}
      {records.map((record) => (
        <TableRow key={record._id} item={record} />
      ))}
    </YStack>
  );
}
