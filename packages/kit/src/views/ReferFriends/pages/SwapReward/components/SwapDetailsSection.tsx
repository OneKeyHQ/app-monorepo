import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Icon,
  ScrollView,
  SizableText,
  Spinner,
  Switch,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useFixedColumnShadow } from '@onekeyhq/kit/src/hooks/useFixedColumnShadow';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ISwapInviteItem,
  ISwapInvitesSortBy,
  ISwapInvitesSortOrder,
  ISwapRecordsParams,
} from '@onekeyhq/shared/src/referralCode/type';

import { getSwapRecordsStatusByTab } from '../utils';

import { SwapEmptyData } from './SwapEmptyData';
import { SwapInviteRecord } from './SwapInviteRecord';
import { useSwapTableColumns } from './useSwapTableColumns';

import type { ISwapInviteColumnWidths } from './useSwapTableColumns';
import type { ISwapRecordQuery, ISwapRecordsTab } from '../types';

const SCROLL_CONTENT_STYLE = { flexGrow: 1 };

interface ISwapDetailsSectionProps {
  records: ISwapInviteItem[];
  recordQuery: ISwapRecordQuery;
  activeTab: ISwapRecordsTab;
  onTabChange: (tab: ISwapRecordsTab) => void;
  undistributedCount?: number;
  totalCount?: number;
  hideZeroVolume: boolean;
  onHideZeroVolumeChange: (value: boolean) => void;
  sortBy: ISwapInvitesSortBy;
  sortOrder: ISwapInvitesSortOrder;
  onSort: (field: ISwapInvitesSortBy) => void;
  hasUserSorted: boolean;
  isLoadingMore: boolean;
  isTabLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

function SwapTabButton({
  count,
  isActive,
  label,
  onPress,
}: {
  count?: number;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <XStack
      px="$2"
      py="$1"
      borderRadius="$2"
      bg={isActive ? '$bgApp' : 'transparent'}
      onPress={onPress}
      cursor="pointer"
      ai="center"
      gap="$1"
    >
      <SizableText
        size="$bodyMdMedium"
        color={isActive ? '$text' : '$textSubdued'}
      >
        {label}
      </SizableText>
      <XStack
        bg="$bgStrong"
        px="$2"
        py="$0.5"
        borderRadius="$2.5"
        ai="center"
        jc="center"
        minWidth="$4"
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {count ?? '--'}
        </SizableText>
      </XStack>
    </XStack>
  );
}

function TabSwitcher({
  activeTab,
  onTabChange,
  totalCount,
  undistributedCount,
}: Pick<
  ISwapDetailsSectionProps,
  'activeTab' | 'onTabChange' | 'totalCount' | 'undistributedCount'
>) {
  const intl = useIntl();

  return (
    <XStack bg="$neutral5" p="$0.5" borderRadius="$2.5" gap="$0.5">
      <SwapTabButton
        label={intl.formatMessage({
          id: ETranslations.referral_undistributed,
        })}
        count={undistributedCount}
        isActive={activeTab === 'undistributed'}
        onPress={() => onTabChange('undistributed')}
      />
      <SwapTabButton
        label={intl.formatMessage({
          id: ETranslations.referral_perps_total,
        })}
        count={totalCount}
        isActive={activeTab === 'total'}
        onPress={() => onTabChange('total')}
      />
    </XStack>
  );
}

function HideZeroVolumeSwitch({
  hideZeroVolume,
  onHideZeroVolumeChange,
}: Pick<
  ISwapDetailsSectionProps,
  'hideZeroVolume' | 'onHideZeroVolumeChange'
>) {
  const intl = useIntl();

  return (
    <XStack gap="$2.5" ai="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_perps_hide_inactive,
        })}
      </SizableText>
      <Switch
        testID="swap-reward-hide-zero-volume"
        size="small"
        value={hideZeroVolume}
        onChange={onHideZeroVolumeChange}
      />
    </XStack>
  );
}

function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }
  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      ai="center"
      jc="center"
      bg="$bgApp"
      opacity={0.7}
      zIndex={1}
    >
      <Spinner size="small" />
    </YStack>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const intl = useIntl();
  return (
    <YStack py="$8" gap="$3" ai="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_failed })}
      </SizableText>
      <Button
        testID="swap-reward-list-retry"
        size="small"
        variant="secondary"
        onPress={onRetry}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </YStack>
  );
}

function SortableHeader({
  field,
  hasUserSorted,
  label,
  onSort,
  sortBy,
  sortOrder,
  width,
  justifyContent = 'flex-start',
}: {
  field: ISwapInvitesSortBy;
  hasUserSorted: boolean;
  label: string;
  onSort: (field: ISwapInvitesSortBy) => void;
  sortBy: ISwapInvitesSortBy;
  sortOrder: ISwapInvitesSortOrder;
  width: string | number;
  justifyContent?: 'flex-start' | 'flex-end';
}) {
  const isActive = hasUserSorted && sortBy === field;

  return (
    <XStack
      w={width}
      minWidth={0}
      gap="$1"
      ai="center"
      jc={justifyContent}
      cursor="pointer"
      hoverStyle={{ opacity: 0.75 }}
      onPress={() => onSort(field)}
    >
      <SizableText
        size="$headingXs"
        color={isActive ? '$text' : '$textSubdued'}
        textTransform="uppercase"
      >
        {label}
      </SizableText>
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
  );
}

function DesktopRecordsTable({
  columnWidths,
  isCompact,
  recordStatus,
  showFixedDivider,
  tableMinWidth,
  ...props
}: ISwapDetailsSectionProps & {
  columnWidths: ISwapInviteColumnWidths;
  isCompact: boolean;
  recordStatus: ISwapRecordsParams['status'];
  showFixedDivider: boolean;
  tableMinWidth: number;
}) {
  const intl = useIntl();
  const { recordQuery, records } = props;

  return (
    <YStack w={isCompact ? tableMinWidth : '100%'}>
      <XStack pl={isCompact ? 0 : '$5'} pr="$5" py="$2.5" bg="$bgStrong">
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
          <XStack w="$5" />
          <SizableText
            size="$headingXs"
            color="$textSubdued"
            textTransform="uppercase"
          >
            {intl.formatMessage({ id: ETranslations.global_address })}
          </SizableText>
        </XStack>
        <SortableHeader
          field="invitationTime"
          width={columnWidths.invitedAt}
          label={intl.formatMessage({
            id: ETranslations.referral_perps_invited_at,
          })}
          {...props}
        />
        <XStack w={columnWidths.referralCode} minWidth={0}>
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
          field="firstTradeTime"
          width={columnWidths.firstTrade}
          label={intl.formatMessage({
            id: ETranslations.referral_perps_first_trade,
          })}
          {...props}
        />
        <SortableHeader
          field="volume"
          width={columnWidths.volume}
          label={intl.formatMessage({
            id: ETranslations.referral_perps_volume,
          })}
          {...props}
        />
        <SortableHeader
          field="fee"
          width={columnWidths.fee}
          label={intl.formatMessage({
            id: ETranslations.referral_perps_onekey_fee,
          })}
          {...props}
        />
        <SortableHeader
          field="reward"
          width={columnWidths.rewards}
          justifyContent="flex-end"
          label={intl.formatMessage({ id: ETranslations.earn_rewards })}
          {...props}
        />
      </XStack>
      {records.map((item, index) => (
        <SwapInviteRecord
          key={`${index}:${item._id}`}
          item={item}
          query={recordQuery}
          status={recordStatus}
          variant="desktop"
          columnWidths={columnWidths}
          isCompact={isCompact}
          showFixedDivider={showFixedDivider}
        />
      ))}
    </YStack>
  );
}

function DesktopSection(props: ISwapDetailsSectionProps) {
  const intl = useIntl();
  const media = useMedia();
  const isCompact = media.xl;
  const { columnWidths, tableMinWidth } = useSwapTableColumns(isCompact);
  const {
    showShadow: showFixedShadow,
    scrollViewRef,
    handleNativeScroll,
    handleWebScroll,
  } = useFixedColumnShadow({ position: 'left', enabled: isCompact });
  const showFixedDivider = showFixedShadow && !platformEnv.isNative;
  const { activeTab, hasError, isLoadingMore, isTabLoading, onRetry, records } =
    props;
  const hasData = records.length > 0;
  const recordStatus = getSwapRecordsStatusByTab(activeTab);

  return (
    <YStack px="$5">
      <YStack
        bg="$bgSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        overflow="hidden"
      >
        <XStack
          px="$5"
          py="$3"
          jc="space-between"
          ai="center"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderSubdued"
        >
          <SizableText size="$headingMd">
            {intl.formatMessage({ id: ETranslations.global_details })}
          </SizableText>
          <XStack gap="$3" ai="center">
            {activeTab === 'total' ? <HideZeroVolumeSwitch {...props} /> : null}
            <TabSwitcher {...props} />
          </XStack>
        </XStack>

        <YStack bg="$bgApp" position="relative" minHeight={200}>
          <LoadingOverlay visible={isTabLoading} />
          {hasError ? <ErrorState onRetry={onRetry} /> : null}
          {!hasError && !hasData && !isTabLoading ? <SwapEmptyData /> : null}
          {!hasError && hasData ? (
            <>
              {isCompact ? (
                <ScrollView
                  ref={scrollViewRef}
                  horizontal
                  showsHorizontalScrollIndicator
                  bounces={false}
                  onScroll={
                    platformEnv.isNative ? handleNativeScroll : handleWebScroll
                  }
                  scrollEventThrottle={16}
                  contentContainerStyle={SCROLL_CONTENT_STYLE}
                >
                  <DesktopRecordsTable
                    {...props}
                    columnWidths={columnWidths}
                    isCompact
                    recordStatus={recordStatus}
                    showFixedDivider={showFixedDivider}
                    tableMinWidth={tableMinWidth}
                  />
                </ScrollView>
              ) : (
                <DesktopRecordsTable
                  {...props}
                  columnWidths={columnWidths}
                  isCompact={false}
                  recordStatus={recordStatus}
                  showFixedDivider={false}
                  tableMinWidth={tableMinWidth}
                />
              )}
              {isLoadingMore ? (
                <YStack py="$4" ai="center">
                  <Spinner size="small" />
                </YStack>
              ) : null}
            </>
          ) : null}
        </YStack>
      </YStack>
    </YStack>
  );
}

function MobileSection(props: ISwapDetailsSectionProps) {
  const intl = useIntl();
  const {
    activeTab,
    hasError,
    isLoadingMore,
    isTabLoading,
    onRetry,
    recordQuery,
    records,
  } = props;
  const hasData = records.length > 0;
  const recordStatus = getSwapRecordsStatusByTab(activeTab);

  return (
    <YStack px="$5" gap="$4">
      <XStack jc="space-between" ai="center">
        <SizableText size="$headingMd">
          {intl.formatMessage({ id: ETranslations.global_details })}
        </SizableText>
        <TabSwitcher {...props} />
      </XStack>
      {activeTab === 'total' ? (
        <XStack
          bg="$bgStrong"
          px="$2"
          py="$1"
          borderRadius="$2"
          jc="space-between"
          ai="center"
        >
          <HideZeroVolumeSwitch {...props} />
        </XStack>
      ) : null}
      <YStack position="relative" minHeight={200}>
        <LoadingOverlay visible={isTabLoading} />
        {hasError ? <ErrorState onRetry={onRetry} /> : null}
        {!hasError && !hasData && !isTabLoading ? <SwapEmptyData /> : null}
        {!hasError && hasData ? (
          <YStack gap="$4">
            {records.map((item, index) => (
              <SwapInviteRecord
                key={`${index}:${item._id}`}
                item={item}
                query={recordQuery}
                status={recordStatus}
                variant="mobile"
              />
            ))}
            {isLoadingMore ? (
              <YStack py="$4" ai="center">
                <Spinner size="small" />
              </YStack>
            ) : null}
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}

export function SwapDetailsSection(props: ISwapDetailsSectionProps) {
  const { md } = useMedia();

  return md ? <MobileSection {...props} /> : <DesktopSection {...props} />;
}
