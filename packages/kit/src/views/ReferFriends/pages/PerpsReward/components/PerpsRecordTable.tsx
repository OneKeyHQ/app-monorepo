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
import { FixedColumnShadowOverlay } from '@onekeyhq/kit/src/components/FixedColumnShadowOverlay';
import {
  SHADOW_CONSTANTS,
  getWebClipPath,
  getWebShadowStyle,
  useFixedColumnShadow,
} from '@onekeyhq/kit/src/hooks/useFixedColumnShadow';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  hasUserSorted?: boolean;
}

interface ICellContentProps {
  item: IPerpsInviteItem;
  columnWidths: IColumnWidths;
}

interface IHeaderContentProps {
  columnWidths: IColumnWidths;
  sortBy: IPerpsInvitesSortBy;
  sortOrder: IPerpsInvitesSortOrder;
  onSort: (field: IPerpsInvitesSortBy) => void;
  hasUserSorted?: boolean;
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
  hasUserSorted?: boolean;
}

// Module-level constants to avoid re-creating on every render
const SCROLL_CONTENT_STYLE = { flexGrow: 1 };
const REWARD_FORMATTER_OPTIONS = { showPlusMinusSigns: true };
const HOVER_OPACITY_STYLE = { opacity: 0.7 };
const HOVER_BG_STYLE = { bg: '$bgHover' };
// Consistent row height for compact mode to prevent drift between
// the fixed address column and the scrollable columns (Badge vs SizableText).
const COMPACT_ROW_MIN_HEIGHT = '$10';

function SortableHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onSort,
  width,
  jc = 'flex-start',
  tooltipContent,
  hasUserSorted,
}: ISortableHeaderProps) {
  // Only show active styling when user has explicitly clicked a sort header
  const isActive = hasUserSorted && sortBy === field;

  return (
    <XStack w={width} ai="center" jc={jc} gap="$1">
      <XStack
        ai="center"
        gap="$1"
        onPress={() => onSort(field)}
        cursor="pointer"
        hoverStyle={HOVER_OPACITY_STYLE}
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
          placement="bottom"
          iconSize="$3.5"
          renderContent={
            <YStack p="$5">
              <SizableText size="$bodySm">{tooltipContent}</SizableText>
            </YStack>
          }
        />
      ) : null}
      <XStack
        ai="center"
        onPress={() => onSort(field)}
        cursor="pointer"
        hoverStyle={HOVER_OPACITY_STYLE}
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

function isZeroValue(value: string | null | undefined): boolean {
  if (!value) return true;
  return Number(value) === 0;
}

/* --- Shared cell content components (no row wrapper) --- */

function AddressCellContent({ item, columnWidths }: ICellContentProps) {
  return (
    <XStack w={columnWidths.address} ai="center" py="$1">
      <SizableText size="$bodyMd" color="$text">
        {item.address}
      </SizableText>
    </XStack>
  );
}

function ScrollableCellsContent({ item, columnWidths }: ICellContentProps) {
  const isZeroData =
    isZeroValue(item.volumeFiatValue) &&
    isZeroValue(item.feeFiatValue) &&
    isZeroValue(item.rewardFiatValue);

  return (
    <>
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
        <SizableText
          size="$bodyMd"
          color={isZeroData && !item.firstTradeTime ? '$textSubdued' : '$text'}
        >
          {isZeroData && !item.firstTradeTime
            ? '--'
            : formatDateTime(item.firstTradeTime)}
        </SizableText>
      </XStack>

      <XStack w={columnWidths.volume} ai="center" py="$1">
        {isZeroData ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            --
          </SizableText>
        ) : (
          <Currency formatter="value" size="$bodyMd" color="$text">
            {item.volumeFiatValue}
          </Currency>
        )}
      </XStack>

      <XStack w={columnWidths.fee} ai="center" py="$1">
        {isZeroData ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            --
          </SizableText>
        ) : (
          <Currency formatter="value" size="$bodyMd" color="$text">
            {item.feeFiatValue}
          </Currency>
        )}
      </XStack>

      <XStack w={columnWidths.reward} ai="center" jc="flex-end" py="$1">
        {isZeroData ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            --
          </SizableText>
        ) : (
          <Currency
            color="$textSuccess"
            formatter="value"
            size="$bodyMd"
            formatterOptions={REWARD_FORMATTER_OPTIONS}
          >
            {item.rewardFiatValue}
          </Currency>
        )}
      </XStack>
    </>
  );
}

/* --- Shared header content components (no row wrapper) --- */

function AddressHeaderContent({
  columnWidths,
}: {
  columnWidths: IColumnWidths;
}) {
  const intl = useIntl();

  return (
    <XStack w={columnWidths.address}>
      <SizableText
        size="$headingXs"
        color="$textSubdued"
        textTransform="uppercase"
      >
        {intl.formatMessage({ id: ETranslations.global_address })}
      </SizableText>
    </XStack>
  );
}

function ScrollableHeaderContent({
  columnWidths,
  sortBy,
  sortOrder,
  onSort,
  hasUserSorted,
}: IHeaderContentProps) {
  const intl = useIntl();

  return (
    <>
      <SortableHeader
        label={intl.formatMessage({
          id: ETranslations.referral_perps_invited_at,
        })}
        field="invitationTime"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        width={columnWidths.invitedAt}
        hasUserSorted={hasUserSorted}
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
        hasUserSorted={hasUserSorted}
      />

      <SortableHeader
        label={intl.formatMessage({
          id: ETranslations.referral_perps_volume,
        })}
        field="volume"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        width={columnWidths.volume}
        hasUserSorted={hasUserSorted}
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
        hasUserSorted={hasUserSorted}
      />

      <SortableHeader
        label={intl.formatMessage({ id: ETranslations.earn_rewards })}
        field="reward"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        width={columnWidths.reward}
        jc="flex-end"
        hasUserSorted={hasUserSorted}
      />
    </>
  );
}

export function PerpsRecordTable({
  records,
  sortBy,
  sortOrder,
  onSort,
  isLoadingMore,
  hasUserSorted,
}: IPerpsRecordTableProps) {
  const media = useMedia();
  const isCompact = media.xl;
  const { columnWidths } = usePerpsTableColumns(isCompact);
  const themeVariant = useThemeVariant();
  const isDark = themeVariant === 'dark';

  // Fixed column shadow management
  const {
    showShadow: showFixedShadow,
    scrollViewRef,
    handleNativeScroll,
    handleWebScroll,
  } = useFixedColumnShadow({
    position: 'left',
    enabled: isCompact,
  });

  if (!records || records.length === 0) {
    return null;
  }

  if (isCompact) {
    // Fixed address column + horizontally scrollable rest columns
    return (
      <YStack py="$2">
        <XStack flex={1} position="relative">
          {/* Fixed address column */}
          <YStack
            bg="$bgApp"
            zIndex={1}
            $platform-web={{
              boxShadow: showFixedShadow
                ? getWebShadowStyle('left', isDark)
                : 'none',
              clipPath: getWebClipPath('left'),
              transition: `box-shadow ${SHADOW_CONSTANTS.TRANSITION_DURATION} ease-in-out`,
            }}
          >
            <XStack
              ai="center"
              px="$5"
              py="$2"
              minHeight={COMPACT_ROW_MIN_HEIGHT}
            >
              <AddressHeaderContent columnWidths={columnWidths} />
            </XStack>
            {records.map((record) => (
              <XStack
                key={record._id}
                ai="center"
                px="$5"
                py="$2"
                minHeight={COMPACT_ROW_MIN_HEIGHT}
              >
                <AddressCellContent item={record} columnWidths={columnWidths} />
              </XStack>
            ))}
            <FixedColumnShadowOverlay
              position="left"
              visible={showFixedShadow}
              isDark={isDark}
            />
          </YStack>

          {/* Scrollable columns */}
          <ScrollView
            ref={scrollViewRef}
            flex={1}
            horizontal
            showsHorizontalScrollIndicator
            bounces={false}
            onScroll={
              platformEnv.isNative ? handleNativeScroll : handleWebScroll
            }
            scrollEventThrottle={16}
            contentContainerStyle={SCROLL_CONTENT_STYLE}
          >
            <YStack>
              <XStack
                ai="center"
                py="$2"
                pr="$5"
                minHeight={COMPACT_ROW_MIN_HEIGHT}
              >
                <ScrollableHeaderContent
                  columnWidths={columnWidths}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                  hasUserSorted={hasUserSorted}
                />
              </XStack>
              {records.map((record) => (
                <XStack
                  key={record._id}
                  ai="center"
                  py="$2"
                  pr="$5"
                  minHeight={COMPACT_ROW_MIN_HEIGHT}
                >
                  <ScrollableCellsContent
                    item={record}
                    columnWidths={columnWidths}
                  />
                </XStack>
              ))}
            </YStack>
          </ScrollView>
        </XStack>
        {isLoadingMore ? (
          <YStack ai="center" py="$4">
            <Spinner size="small" />
          </YStack>
        ) : null}
      </YStack>
    );
  }

  // Desktop: full-width layout, all columns in one row
  return (
    <YStack py="$2">
      <XStack ai="center" px="$5" py="$2">
        <AddressHeaderContent columnWidths={columnWidths} />
        <ScrollableHeaderContent
          columnWidths={columnWidths}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          hasUserSorted={hasUserSorted}
        />
      </XStack>
      {records.map((record) => (
        <XStack
          key={record._id}
          ai="center"
          px="$5"
          py="$2"
          hoverStyle={HOVER_BG_STYLE}
        >
          <AddressCellContent item={record} columnWidths={columnWidths} />
          <ScrollableCellsContent item={record} columnWidths={columnWidths} />
        </XStack>
      ))}
      {isLoadingMore ? (
        <YStack ai="center" py="$4">
          <Spinner size="small" />
        </YStack>
      ) : null}
    </YStack>
  );
}
