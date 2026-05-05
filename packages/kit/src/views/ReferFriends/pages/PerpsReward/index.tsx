import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  DatePicker,
  Page,
  RefreshControl,
  ScrollView,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDateRange } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EExportSubject,
  EExportTimeRange,
  type IPerpsCumulativeRewardsResponse,
  type IPerpsInvitesResponse,
  type IPerpsInvitesSortBy,
  type IPerpsInvitesSortOrder,
} from '@onekeyhq/shared/src/referralCode/type';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  ExportButton,
  FilterButton,
  ReferFriendsDetailHeader,
  ReferFriendsPageContainer,
} from '../../components';
import { useDatePresets } from '../../hooks/useDatePresets';
import { useRewardFilter } from '../../hooks/useRewardFilter';

import { PerpsDetailsSection } from './components/PerpsDetailsSection';
import { PerpsRewardHeader } from './components/PerpsRewardHeader';

type IERecordsTabValue = 'undistributed' | 'total';

function PerpsRewardPageWrapper() {
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();

  const [isLoading, setIsLoading] = useState(false);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [cumulativeRewards, setCumulativeRewards] = useState<
    IPerpsCumulativeRewardsResponse | undefined
  >();
  const [currentInvites, setCurrentInvites] = useState<
    IPerpsInvitesResponse | undefined
  >();
  const [undistributedCount, setUndistributedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] =
    useState<IERecordsTabValue>('undistributed');
  const [hideZeroVolume, setHideZeroVolume] = useState(true);
  const [sortBy, setSortBy] = useState<IPerpsInvitesSortBy>('volume');
  const [sortOrder, setSortOrder] = useState<IPerpsInvitesSortOrder>('desc');
  // Track whether user has explicitly clicked a sort header
  const [hasUserSorted, setHasUserSorted] = useState(false);

  // Pagination state
  const [cursor, setCursor] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleSort = useCallback(
    (field: IPerpsInvitesSortBy) => {
      setHasUserSorted(true);
      if (sortBy === field) {
        // Toggle order if same field
        setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      } else {
        // New field, default to desc
        setSortBy(field);
        setSortOrder('desc');
      }
    },
    [sortBy],
  );

  const {
    filterState,
    updateFilter,
    setCustomDateRange,
    clearCustomDateRange,
    datePickerValue,
  } = useRewardFilter({
    startTime: new Date('2024-01-01T00:00:00.000').getTime(),
    endTime: (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    })(),
  });

  // Intermediate state for date range selection (before both dates are selected)
  const [intermediateDateRange, setIntermediateDateRange] =
    useState<IDateRange | null>(null);

  // Handle date range change from DatePicker
  const handleDateRangeChange = useCallback(
    (range: IDateRange) => {
      if (range.start && range.end) {
        // Both dates selected - set custom date range and trigger API call
        const startTime = new Date(range.start);
        startTime.setHours(0, 0, 0, 0);
        const endTime = new Date(range.end);
        endTime.setHours(23, 59, 59, 999);
        setCustomDateRange(startTime.getTime(), endTime.getTime());
        // Clear intermediate state
        setIntermediateDateRange(null);
      } else if (range.start) {
        // Only start date selected - update intermediate state
        setIntermediateDateRange(range);
      } else {
        // No dates selected - clear both intermediate and filter state
        setIntermediateDateRange(null);
        clearCustomDateRange();
      }
    },
    [setCustomDateRange, clearCustomDateRange],
  );

  // Use intermediate state if available, otherwise use confirmed datePickerValue
  const currentDatePickerValue = intermediateDateRange ?? datePickerValue;

  // Clear intermediate state when switching to preset time range
  useEffect(() => {
    if (filterState.timeRange !== EExportTimeRange.Custom) {
      setIntermediateDateRange(null);
    }
  }, [filterState.timeRange]);

  // Get the effective timeRange for API calls
  // When using custom date range (startTime/endTime), don't pass timeRange
  const effectiveTimeRange =
    filterState.startTime && filterState.endTime
      ? undefined
      : filterState.timeRange;

  // Fetch counts for both tabs
  const fetchCounts = useCallback(async () => {
    const [undistributedResult, totalResult] = await Promise.allSettled([
      backgroundApiProxy.serviceReferralCode.getPerpsInvites({
        tab: 'undistributed',
        timeRange: effectiveTimeRange,
        startTime: filterState.startTime,
        endTime: filterState.endTime,
        inviteCode: filterState.inviteCode,
      }),
      backgroundApiProxy.serviceReferralCode.getPerpsInvites({
        tab: 'total',
        timeRange: effectiveTimeRange,
        startTime: filterState.startTime,
        endTime: filterState.endTime,
        inviteCode: filterState.inviteCode,
      }),
    ]);

    if (undistributedResult.status === 'fulfilled') {
      setUndistributedCount(undistributedResult.value.total);
    }
    if (totalResult.status === 'fulfilled') {
      setTotalCount(totalResult.value.total);
    }
  }, [
    effectiveTimeRange,
    filterState.startTime,
    filterState.endTime,
    filterState.inviteCode,
  ]);

  // Fetch current tab data (resets pagination)
  const fetchCurrentTab = useCallback(async () => {
    const result = await backgroundApiProxy.serviceReferralCode.getPerpsInvites(
      {
        tab: activeTab,
        timeRange: effectiveTimeRange,
        startTime: filterState.startTime,
        endTime: filterState.endTime,
        inviteCode: filterState.inviteCode,
        hideZeroVolume: activeTab === 'total' ? hideZeroVolume : undefined,
        sortBy,
        sortOrder,
      },
    );
    setCurrentInvites(result);

    // Update cursor for pagination - trust API's cursor
    setCursor(result.cursor ?? undefined);

    // Update the count for current tab
    if (activeTab === 'undistributed') {
      setUndistributedCount(result.total);
    } else {
      setTotalCount(result.total);
    }
  }, [
    activeTab,
    effectiveTimeRange,
    filterState.startTime,
    filterState.endTime,
    filterState.inviteCode,
    hideZeroVolume,
    sortBy,
    sortOrder,
  ]);

  // Load more data for pagination
  const onLoadMore = useCallback(async () => {
    if (!cursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const result =
        await backgroundApiProxy.serviceReferralCode.getPerpsInvites({
          tab: activeTab,
          timeRange: effectiveTimeRange,
          startTime: filterState.startTime,
          endTime: filterState.endTime,
          inviteCode: filterState.inviteCode,
          hideZeroVolume: activeTab === 'total' ? hideZeroVolume : undefined,
          sortBy,
          sortOrder,
          cursor,
        });

      // Append new items to existing list
      setCurrentInvites((prev) => ({
        ...result,
        items: [...(prev?.items ?? []), ...(result.items ?? [])],
      }));

      // Update cursor - trust API's cursor
      setCursor(result.cursor ?? undefined);
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    cursor,
    isLoadingMore,
    activeTab,
    effectiveTimeRange,
    filterState.startTime,
    filterState.endTime,
    filterState.inviteCode,
    hideZeroVolume,
    sortBy,
    sortOrder,
  ]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const paddingToBottom = 100;
      const isCloseToBottom =
        contentOffset.y + layoutMeasurement.height >=
        contentSize.height - paddingToBottom;

      if (isCloseToBottom && cursor && !isLoadingMore) {
        void onLoadMore();
      }
    },
    [cursor, isLoadingMore, onLoadMore],
  );

  const onRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        backgroundApiProxy.serviceReferralCode
          .getPerpsCumulativeRewards({
            timeRange: effectiveTimeRange,
            startTime: filterState.startTime,
            endTime: filterState.endTime,
            inviteCode: filterState.inviteCode,
          })
          .then(setCumulativeRewards),
        fetchCounts(),
        fetchCurrentTab(),
      ]);
    } catch (error) {
      console.error('Failed to fetch perps data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    effectiveTimeRange,
    filterState.startTime,
    filterState.endTime,
    filterState.inviteCode,
    fetchCounts,
    fetchCurrentTab,
  ]);

  // Initial load
  useEffect(() => {
    void onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveTimeRange,
    filterState.startTime,
    filterState.endTime,
    filterState.inviteCode,
  ]);

  // Fetch data when tab changes
  useEffect(() => {
    setIsTabLoading(true);
    fetchCurrentTab()
      .catch((error) => console.error('Failed to fetch tab data:', error))
      .finally(() => setIsTabLoading(false));
  }, [fetchCurrentTab]);

  // Client-side sorting as a fallback in case the API doesn't sort correctly
  const sortedRecords = useMemo(() => {
    const items = currentInvites?.items ?? [];
    if (items.length === 0) return items;

    return items.toSorted((a, b) => {
      let valA: number;
      let valB: number;

      switch (sortBy) {
        case 'volume':
          valA = Number(a.volumeFiatValue) || 0;
          valB = Number(b.volumeFiatValue) || 0;
          break;
        case 'fee':
          valA = Number(a.feeFiatValue) || 0;
          valB = Number(b.feeFiatValue) || 0;
          break;
        case 'reward':
          valA = Number(a.rewardFiatValue) || 0;
          valB = Number(b.rewardFiatValue) || 0;
          break;
        case 'invitationTime':
          valA = a.invitationTime ? new Date(a.invitationTime).getTime() : 0;
          valB = b.invitationTime ? new Date(b.invitationTime).getTime() : 0;
          break;
        case 'firstTradeTime':
          valA = a.firstTradeTime ? new Date(a.firstTradeTime).getTime() : 0;
          valB = b.firstTradeTime ? new Date(b.firstTradeTime).getTime() : 0;
          break;
        default:
          return 0;
      }

      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [currentInvites?.items, sortBy, sortOrder]);

  // Max date for DatePicker (today)
  const maxDate = useMemo(() => new Date(), []);
  const presets = useDatePresets();

  const toolbar = useMemo(
    () => (
      <>
        <YStack width={240}>
          <DatePicker.Range
            value={currentDatePickerValue}
            onChange={handleDateRangeChange}
            maxDate={maxDate}
            showPreviousMonth
            presets={presets}
          />
        </YStack>
        <XStack gap="$3">
          <FilterButton
            filterState={filterState}
            onFilterChange={updateFilter}
          />
          <ExportButton
            subject={EExportSubject.Perp}
            timeRange={effectiveTimeRange}
            inviteCode={filterState.inviteCode}
            startTime={filterState.startTime}
            endTime={filterState.endTime}
          />
        </XStack>
      </>
    ),
    [
      currentDatePickerValue,
      handleDateRangeChange,
      maxDate,
      presets,
      filterState,
      updateFilter,
      effectiveTimeRange,
    ],
  );

  return (
    <Page>
      <ReferFriendsDetailHeader
        title={intl.formatMessage({ id: ETranslations.global_perp })}
        toolbar={toolbar}
      />
      <Page.Body>
        <ReferFriendsPageContainer flex={1} position="relative">
          {cumulativeRewards === undefined && isLoading ? (
            <YStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              ai="center"
              jc="center"
              flex={1}
            >
              <Spinner size="large" />
            </YStack>
          ) : (
            <ScrollView
              flex={1}
              refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ pb: '$5' }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {/* Perps Reward Header - Stats Cards */}
              <PerpsRewardHeader
                data={cumulativeRewards}
                isLoading={isLoading}
                onRefresh={onRefresh}
              />

              {/* Details Section */}
              <PerpsDetailsSection
                records={sortedRecords}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                undistributedCount={undistributedCount}
                totalCount={totalCount}
                hideZeroVolume={hideZeroVolume}
                onHideZeroVolumeChange={setHideZeroVolume}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                isLoadingMore={isLoadingMore}
                isTabLoading={isTabLoading}
                hasUserSorted={hasUserSorted}
              />
            </ScrollView>
          )}
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function PerpsReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <PerpsRewardPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
