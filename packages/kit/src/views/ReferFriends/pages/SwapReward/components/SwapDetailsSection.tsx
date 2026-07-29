import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Icon,
  SizableText,
  Spinner,
  Switch,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ISwapInviteItem,
  ISwapInvitesSortBy,
  ISwapInvitesSortOrder,
} from '@onekeyhq/shared/src/referralCode/type';

import { getSwapRecordsStatusByTab } from '../utils';

import { SwapEmptyData } from './SwapEmptyData';
import { SwapInviteRecord } from './SwapInviteRecord';

import type { ISwapRecordQuery, ISwapRecordsTab } from '../types';

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
  flex,
  hasUserSorted,
  label,
  onSort,
  sortBy,
  sortOrder,
  justifyContent = 'flex-start',
}: {
  field: ISwapInvitesSortBy;
  flex: number;
  hasUserSorted: boolean;
  label: string;
  onSort: (field: ISwapInvitesSortBy) => void;
  sortBy: ISwapInvitesSortBy;
  sortOrder: ISwapInvitesSortOrder;
  justifyContent?: 'flex-start' | 'flex-end';
}) {
  const isActive = hasUserSorted && sortBy === field;

  return (
    <XStack
      flex={flex}
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

function DesktopSection(props: ISwapDetailsSectionProps) {
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
          {!isTabLoading ? (
            <>
              {hasError ? <ErrorState onRetry={onRetry} /> : null}
              {!hasError && !hasData ? <SwapEmptyData /> : null}
              {!hasError && hasData ? (
                <>
                  <XStack px="$5" py="$2.5" gap="$3" bg="$bgStrong">
                    <SizableText
                      flex={1.2}
                      size="$headingXs"
                      color="$textSubdued"
                      textTransform="uppercase"
                    >
                      {intl.formatMessage({
                        id: ETranslations.global_address,
                      })}
                    </SizableText>
                    <SortableHeader
                      field="invitationTime"
                      flex={1.1}
                      label={intl.formatMessage({
                        id: ETranslations.referral_perps_invited_at,
                      })}
                      {...props}
                    />
                    <SizableText
                      flex={0.9}
                      size="$headingXs"
                      color="$textSubdued"
                      textTransform="uppercase"
                    >
                      {intl.formatMessage({
                        id: ETranslations.referral_perps_referral_code,
                      })}
                    </SizableText>
                    <SortableHeader
                      field="firstTradeTime"
                      flex={1.1}
                      label={intl.formatMessage({
                        id: ETranslations.referral_perps_first_trade,
                      })}
                      {...props}
                    />
                    <SortableHeader
                      field="volume"
                      flex={1}
                      label={intl.formatMessage({
                        id: ETranslations.referral_perps_volume,
                      })}
                      {...props}
                    />
                    <SortableHeader
                      field="fee"
                      flex={1}
                      label={intl.formatMessage({
                        id: ETranslations.referral_perps_onekey_fee,
                      })}
                      {...props}
                    />
                    <SortableHeader
                      field="reward"
                      flex={1}
                      justifyContent="flex-end"
                      label={intl.formatMessage({
                        id: ETranslations.earn_rewards,
                      })}
                      {...props}
                    />
                    <XStack w="$5" />
                  </XStack>
                  {records.map((item, index) => (
                    <SwapInviteRecord
                      key={`${index}:${item._id}`}
                      item={item}
                      query={recordQuery}
                      status={recordStatus}
                      variant="desktop"
                    />
                  ))}
                  {isLoadingMore ? (
                    <YStack py="$4" ai="center">
                      <Spinner size="small" />
                    </YStack>
                  ) : null}
                </>
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
        {!isTabLoading ? (
          <>
            {hasError ? <ErrorState onRetry={onRetry} /> : null}
            {!hasError && !hasData ? <SwapEmptyData /> : null}
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
          </>
        ) : null}
      </YStack>
    </YStack>
  );
}

export function SwapDetailsSection(props: ISwapDetailsSectionProps) {
  const { md } = useMedia();

  return md ? <MobileSection {...props} /> : <DesktopSection {...props} />;
}
