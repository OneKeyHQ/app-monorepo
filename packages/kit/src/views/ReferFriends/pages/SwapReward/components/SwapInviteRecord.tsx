import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Icon,
  NumberSizeableText,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { InfoIcon } from '@onekeyhq/kit/src/components/InfoIcon';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ISwapInviteItem,
  ISwapRecordItem,
  ISwapRecordsParams,
  ISwapRecordsResponse,
} from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { useSwapRecordDetails } from '../hooks/useSwapRecordDetails';
import {
  SWAP_INVITE_DESKTOP_COLUMN_WIDTHS,
  SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS,
  buildSwapRecordKey,
  groupSwapRecords,
} from '../utils';

import { SwapRewardStatusBadge } from './SwapRewardStatusBadge';

import type { ISwapInviteColumnWidths } from './useSwapTableColumns';
import type { ISwapRecordQuery } from '../types';

interface ISwapInviteRecordProps {
  item: ISwapInviteItem;
  query: ISwapRecordQuery;
  status: ISwapRecordsParams['status'];
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

function TokenAmount({ item }: { item: ISwapRecordItem }) {
  return (
    <XStack gap="$1" ai="baseline">
      <NumberSizeableText
        formatter="value"
        size="$bodySm"
        color="$textSubdued"
        formatterOptions={{ tokenSymbol: item.token.symbol }}
      >
        {item.amount || '0'}
      </NumberSizeableText>
    </XStack>
  );
}

function InviteCodeValue({ item }: { item: ISwapInviteItem }) {
  return (
    <YStack gap="$0.5" ai="flex-start" minWidth={0}>
      <Badge badgeType="default" badgeSize="sm">
        {item.inviteCode}
      </Badge>
      {item.inviteCodeRemark ? (
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {item.inviteCodeRemark}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function TransactionLink({ item }: { item: ISwapRecordItem }) {
  if (!item.distributedTx) {
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        -
      </SizableText>
    );
  }

  return (
    <SizableText
      size="$bodyMd"
      color="$textInfo"
      numberOfLines={1}
      cursor="pointer"
      hoverStyle={{ opacity: 0.8 }}
      onPress={() => {
        void openTransactionDetailsUrl({
          networkId: item.token.networkId,
          txid: item.distributedTx ?? undefined,
        });
      }}
    >
      {item.distributedTx}
    </SizableText>
  );
}

function DesktopMonthlyRecords({ items }: { items: ISwapRecordItem[] }) {
  const intl = useIntl();
  const groups = groupSwapRecords(items);

  return (
    <YStack>
      <XStack px="$4" py="$2.5" bg="$bgStrong">
        <XStack
          w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.period}
          minWidth={0}
        >
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({ id: ETranslations.earn_period })}
          </SizableText>
        </XStack>
        <XStack
          w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.volume}
          minWidth={0}
        >
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({
              id: ETranslations.referral_perps_volume,
            })}
          </SizableText>
        </XStack>
        <XStack
          w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.rewards}
          minWidth={0}
        >
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({ id: ETranslations.earn_rewards })}
          </SizableText>
        </XStack>
        <XStack
          w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.status}
          minWidth={0}
        >
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({ id: ETranslations.global_status })}
          </SizableText>
        </XStack>
        <XStack
          w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.transactionHash}
          minWidth={0}
        >
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({ id: ETranslations.global_transaction_id })}
          </SizableText>
        </XStack>
      </XStack>
      {groups.map((group) => (
        <YStack
          key={group.key}
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$borderSubdued"
        >
          {group.items.map((record, index) => (
            <XStack
              key={buildSwapRecordKey(record, index)}
              px="$4"
              py="$3"
              ai="center"
              borderTopWidth={index === 0 ? 0 : StyleSheet.hairlineWidth}
              borderTopColor="$borderSubdued"
            >
              <XStack
                w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.period}
                minWidth={0}
              >
                <SizableText size="$bodyMd">
                  {index === 0 ? group.period : ''}
                </SizableText>
              </XStack>
              <XStack
                w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.volume}
                minWidth={0}
              >
                <FiatValue value={record.tradingVolumeFiatValue} />
              </XStack>
              <XStack
                w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.rewards}
                minWidth={0}
              >
                <YStack gap="$0.5">
                  <FiatValue
                    value={record.amountFiatValue}
                    color="$textSuccess"
                  />
                  <TokenAmount item={record} />
                </YStack>
              </XStack>
              <XStack
                w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.status}
                minWidth={0}
              >
                <SwapRewardStatusBadge intl={intl} status={record.status} />
              </XStack>
              <XStack
                w={SWAP_MONTHLY_RECORD_DESKTOP_COLUMN_WIDTHS.transactionHash}
                minWidth={0}
              >
                <TransactionLink item={record} />
              </XStack>
            </XStack>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

function MobileMonthlyRecords({ items }: { items: ISwapRecordItem[] }) {
  const intl = useIntl();
  const groups = groupSwapRecords(items);

  return (
    <YStack gap="$4" px="$4" pb="$4">
      {groups.map((group) => (
        <YStack key={group.key} gap="$3">
          {group.items.map((record, index) => (
            <YStack
              key={buildSwapRecordKey(record, index)}
              gap="$3"
              pt={index === 0 ? undefined : '$3'}
              borderTopWidth={index === 0 ? 0 : StyleSheet.hairlineWidth}
              borderTopColor="$borderSubdued"
            >
              <XStack jc="space-between" ai="center" gap="$3">
                <SizableText size="$bodyMdMedium" flex={1} minWidth={0}>
                  {index === 0 ? group.period : ''}
                </SizableText>
                <SwapRewardStatusBadge intl={intl} status={record.status} />
              </XStack>
              <XStack gap="$4" ai="flex-start">
                <YStack flex={1} minWidth={0} gap="$1">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.referral_perps_volume,
                    })}
                  </SizableText>
                  <FiatValue value={record.tradingVolumeFiatValue} />
                </YStack>
                <YStack flex={1} minWidth={0} gap="$1" ai="flex-end">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({ id: ETranslations.earn_rewards })}
                  </SizableText>
                  <FiatValue
                    value={record.amountFiatValue}
                    color="$textSuccess"
                  />
                  <TokenAmount item={record} />
                </YStack>
              </XStack>
              <YStack gap="$1">
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.global_transaction_id,
                  })}
                </SizableText>
                <TransactionLink item={record} />
              </YStack>
            </YStack>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

function ExpandedRecords({
  error,
  isLoading,
  records,
  retry,
  variant,
}: {
  error: boolean;
  isLoading: boolean;
  records: ISwapRecordsResponse | undefined;
  retry: () => void;
  variant: ISwapInviteRecordProps['variant'];
}) {
  const intl = useIntl();

  if (isLoading) {
    return (
      <YStack py="$6" ai="center">
        <Spinner size="small" />
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack py="$5" gap="$3" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_failed })}
        </SizableText>
        <Button
          testID="swap-reward-records-retry"
          size="small"
          variant="secondary"
          onPress={retry}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      </YStack>
    );
  }

  if (!records?.items.length) {
    return (
      <YStack py="$5" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </YStack>
    );
  }

  return variant === 'desktop' ? (
    <DesktopMonthlyRecords items={records.items} />
  ) : (
    <MobileMonthlyRecords items={records.items} />
  );
}

export function SwapInviteRecord({
  columnWidths = SWAP_INVITE_DESKTOP_COLUMN_WIDTHS,
  item,
  isCompact = false,
  query,
  showFixedDivider = false,
  status,
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
  const { hasError, isLoading, records, retry } = useSwapRecordDetails({
    enabled: isExpanded,
    inviteeId: item._id,
    query,
    status,
  });

  const handleToggle = useCallback(() => {
    setIsExpanded((value) => !value);
  }, []);

  const chevron = (
    <Stack
      animation="quick"
      animateOnly={ANIMATE_ONLY_TRANSFORM}
      rotate={isExpanded ? '0deg' : '-90deg'}
    >
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </Stack>
  );

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
              <InviteCodeValue item={item} />
            </XStack>
            {chevron}
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
                <XStack ai="center" gap="$1">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.referral_perps_onekey_fee,
                    })}
                  </SizableText>
                  <InfoIcon
                    size="$4"
                    tooltip={intl.formatMessage({
                      id: ETranslations.referral_perps_onekey_fee_exclusion_notice,
                    })}
                  />
                </XStack>
                <SummaryFiatValue
                  isZeroData={isZeroData}
                  value={item.feeFiatValue}
                />
              </YStack>
            </XStack>
          ) : null}
        </YStack>
        {isExpanded ? (
          <YStack
            bg="$bgSubdued"
            borderTopWidth={StyleSheet.hairlineWidth}
            borderTopColor="$borderSubdued"
            pt="$4"
          >
            <ExpandedRecords
              error={hasError}
              isLoading={isLoading}
              records={records}
              retry={retry}
              variant={variant}
            />
          </YStack>
        ) : null}
      </YStack>
    );
  }

  return (
    <YStack>
      <XStack
        pl={isCompact ? 0 : '$5'}
        pr="$5"
        py="$3"
        ai="center"
        cursor="pointer"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$borderSubdued"
        bg="$bgApp"
        onPress={handleToggle}
      >
        <XStack
          w={columnWidths.address}
          gap="$2"
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
          {chevron}
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
          <InviteCodeValue item={item} />
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
      {isExpanded ? (
        <YStack bg="$bgSubdued" pl="$12" pr="$5" py="$3">
          <YStack
            bg="$bgApp"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$2"
            overflow="hidden"
          >
            <ExpandedRecords
              error={hasError}
              isLoading={isLoading}
              records={records}
              retry={retry}
              variant={variant}
            />
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  );
}
