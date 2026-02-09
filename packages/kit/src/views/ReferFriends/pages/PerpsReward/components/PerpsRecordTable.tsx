import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Popover,
  ScrollView,
  SizableText,
  Spinner,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IPerpsInviteItem,
  IPerpsInvitesSortBy,
  IPerpsInvitesSortOrder,
} from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import {
  type IColumnWidths,
  usePerpsTableColumns,
} from './usePerpsTableColumns';

interface IPerpsRecordTableProps {
  records: IPerpsInviteItem[];
  sortBy: IPerpsInvitesSortBy;
  sortOrder: IPerpsInvitesSortOrder;
  onSort: (field: IPerpsInvitesSortBy) => void;
  isLoadingMore?: boolean;
}

interface ITableRowProps {
  item: IPerpsInviteItem;
  columnWidths: IColumnWidths;
}

interface ISortableHeaderProps {
  label: string;
  field: IPerpsInvitesSortBy;
  sortBy: IPerpsInvitesSortBy;
  sortOrder: IPerpsInvitesSortOrder;
  onSort: (field: IPerpsInvitesSortBy) => void;
  width: string | number;
  jc?: 'flex-start' | 'flex-end';
  tooltipContent?: string;
}

function SortableHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onSort,
  width,
  jc = 'flex-start',
  tooltipContent,
}: ISortableHeaderProps) {
  const isActive = sortBy === field;

  return (
    <XStack w={width} ai="center" jc={jc} gap="$1">
      <XStack
        ai="center"
        gap="$1"
        onPress={() => onSort(field)}
        cursor="pointer"
        hoverStyle={{ opacity: 0.7 }}
      >
        <SizableText
          size="$headingXs"
          color={isActive ? '$text' : '$textSubdued'}
          textTransform="uppercase"
        >
          {label}
        </SizableText>
      </XStack>
      {tooltipContent ? (
        <Popover.Tooltip
          title={label}
          tooltip={tooltipContent}
          placement="bottom"
          iconSize="$3.5"
        />
      ) : null}
      <XStack
        ai="center"
        onPress={() => onSort(field)}
        cursor="pointer"
        hoverStyle={{ opacity: 0.7 }}
      >
        <Icon
          name={
            isActive && sortOrder === 'asc'
              ? 'ChevronTopSmallOutline'
              : 'ChevronDownSmallOutline'
          }
          size="$4"
          color={isActive ? '$icon' : '$iconSubdued'}
        />
      </XStack>
    </XStack>
  );
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return formatDate(dateString, { hideSeconds: true });
}

function TableRow({ item, columnWidths }: ITableRowProps) {
  return (
    <XStack ai="center" px="$5" py="$2" hoverStyle={{ bg: '$bgHover' }}>
      <XStack w={columnWidths.address} ai="center" py="$1">
        <SizableText size="$bodyMd" color="$text">
          {item.address}
        </SizableText>
      </XStack>

      <XStack w={columnWidths.invitedAt} ai="center" py="$1">
        <SizableText size="$bodyMd" color="$text">
          {formatDateTime(item.invitationTime)}
        </SizableText>
      </XStack>

      <XStack w={columnWidths.referralCode} ai="center" py="$1">
        <Badge badgeType="default" badgeSize="sm">
          {item.inviteCode}
        </Badge>
      </XStack>

      <XStack w={columnWidths.firstTrade} ai="center" py="$1">
        <SizableText size="$bodyMd" color="$text">
          {formatDateTime(item.firstTradeTime)}
        </SizableText>
      </XStack>

      <XStack w={columnWidths.volume} ai="center" py="$1">
        <Currency formatter="value" size="$bodyMd" color="$text">
          {item.volumeFiatValue}
        </Currency>
      </XStack>

      <XStack w={columnWidths.fee} ai="center" py="$1">
        <Currency formatter="value" size="$bodyMd" color="$text">
          {item.feeFiatValue}
        </Currency>
      </XStack>

      <XStack w={columnWidths.reward} ai="center" jc="flex-end" py="$1">
        <Currency
          color="$textSuccess"
          formatter="value"
          size="$bodyMd"
          formatterOptions={{
            showPlusMinusSigns: true,
          }}
        >
          {item.rewardFiatValue}
        </Currency>
      </XStack>
    </XStack>
  );
}

function TableHeader({
  columnWidths,
  sortBy,
  sortOrder,
  onSort,
}: {
  columnWidths: IColumnWidths;
  sortBy: IPerpsInvitesSortBy;
  sortOrder: IPerpsInvitesSortOrder;
  onSort: (field: IPerpsInvitesSortBy) => void;
}) {
  const intl = useIntl();

  return (
    <XStack ai="center" px="$5" py="$2">
      <XStack w={columnWidths.address}>
        <SizableText
          size="$headingXs"
          color="$textSubdued"
          textTransform="uppercase"
        >
          {intl.formatMessage({ id: ETranslations.global_address })}
        </SizableText>
      </XStack>

      <SortableHeader
        label={intl.formatMessage({
          id: ETranslations.referral_perps_invited_at,
        })}
        field="invitationTime"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        width={columnWidths.invitedAt}
      />

      <XStack w={columnWidths.referralCode}>
        <SizableText
          size="$headingXs"
          color="$textSubdued"
          textTransform="uppercase"
        >
          {intl.formatMessage({
            id: ETranslations.referral_perps_referral_code,
          })}
        </SizableText>
      </XStack>

      <SortableHeader
        label={intl.formatMessage({
          id: ETranslations.referral_perps_first_trade,
        })}
        field="firstTradeTime"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        width={columnWidths.firstTrade}
      />

      <SortableHeader
        label={intl.formatMessage({ id: ETranslations.referral_perps_volume })}
        field="volume"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        width={columnWidths.volume}
      />

      <SortableHeader
        label={intl.formatMessage({
          id: ETranslations.referral_perps_onekey_fee,
        })}
        field="fee"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        width={columnWidths.fee}
        tooltipContent={intl.formatMessage({
          id: ETranslations.referral_perps_onekey_fee_exclusion_notice,
        })}
      />

      <SortableHeader
        label={intl.formatMessage({ id: ETranslations.earn_rewards })}
        field="reward"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        width={columnWidths.reward}
        jc="flex-end"
      />
    </XStack>
  );
}

export function PerpsRecordTable({
  records,
  sortBy,
  sortOrder,
  onSort,
  isLoadingMore,
}: IPerpsRecordTableProps) {
  const media = useMedia();
  const isCompact = media.lg;
  const { columnWidths, tableMinWidth } = usePerpsTableColumns(isCompact);

  if (!records || records.length === 0) {
    return null;
  }

  const tableContent = (
    <YStack minWidth={isCompact ? tableMinWidth : undefined}>
      <TableHeader
        columnWidths={columnWidths}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
      />
      {records.map((record) => (
        <TableRow key={record._id} item={record} columnWidths={columnWidths} />
      ))}
    </YStack>
  );

  return (
    <YStack py="$2">
      {isCompact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tableContent}
        </ScrollView>
      ) : (
        tableContent
      )}
      {isLoadingMore ? (
        <YStack ai="center" py="$4">
          <Spinner size="small" />
        </YStack>
      ) : null}
    </YStack>
  );
}
