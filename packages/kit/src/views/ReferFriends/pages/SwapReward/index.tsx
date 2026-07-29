import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  DatePicker,
  Page,
  RefreshControl,
  ScrollView,
  Spinner,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDateRange } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EExportSubject,
  EExportTab,
  EExportTimeRange,
  type ISwapCumulativeRewardsResponse,
  type ISwapInvitesParams,
  type ISwapInvitesResponse,
  type ISwapInvitesSortBy,
  type ISwapInvitesSortOrder,
  type ISwapRebateTimeRange,
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

import { SwapDetailsSection } from './components/SwapDetailsSection';
import { SwapRewardHeader } from './components/SwapRewardHeader';
import {
  appendSwapInvitePage,
  getNextSwapCursor,
  getSwapQuerySignature,
} from './utils';

import type { ISwapRecordQuery, ISwapRecordsTab } from './types';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface ISwapOverviewState {
  overviewQuerySignature: string;
  totalCountQuerySignature: string;
  cumulativeRewards?: ISwapCumulativeRewardsResponse;
  undistributedCount?: number;
  totalCount?: number;
  hasCumulativeError: boolean;
}

const PAGE_SIZE = 20;

function SwapRewardPageWrapper() {
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const isRouteFocused = useRouteIsFocused();
  const [isLoading, setIsLoading] = useState(false);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasListError, setHasListError] = useState(false);
  const [overviewState, setOverviewState] = useState<ISwapOverviewState>();
  const [currentInvites, setCurrentInvites] = useState<ISwapInvitesResponse>();
  const [activeTab, setActiveTab] = useState<ISwapRecordsTab>('undistributed');
  const [hideZeroVolume, setHideZeroVolume] = useState(true);
  const [sortBy, setSortBy] = useState<ISwapInvitesSortBy>('volume');
  const [sortOrder, setSortOrder] = useState<ISwapInvitesSortOrder>('desc');
  const [hasUserSorted, setHasUserSorted] = useState(false);
  const [cursor, setCursor] = useState<string>();

  const refreshRequestIdRef = useRef(0);
  const loadingRequestIdRef = useRef(0);
  const listGenerationRef = useRef(0);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadingMoreCursorRef = useRef<string | undefined>(undefined);
  const hasListDataRef = useRef(false);

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

  const [intermediateDateRange, setIntermediateDateRange] =
    useState<IDateRange | null>(null);

  const handleDateRangeChange = useCallback(
    (range: IDateRange) => {
      if (range.start && range.end) {
        const startTime = new Date(range.start);
        startTime.setHours(0, 0, 0, 0);
        const endTime = new Date(range.end);
        endTime.setHours(23, 59, 59, 999);
        setCustomDateRange(startTime.getTime(), endTime.getTime());
        setIntermediateDateRange(null);
      } else if (range.start) {
        setIntermediateDateRange(range);
      } else {
        setIntermediateDateRange(null);
        clearCustomDateRange();
      }
    },
    [clearCustomDateRange, setCustomDateRange],
  );

  useEffect(() => {
    if (filterState.timeRange !== EExportTimeRange.Custom) {
      setIntermediateDateRange(null);
    }
  }, [filterState.timeRange]);

  let effectiveTimeRange: ISwapRebateTimeRange | undefined;
  const hasCustomDateRange =
    filterState.startTime !== undefined && filterState.endTime !== undefined;
  if (
    !hasCustomDateRange &&
    filterState.timeRange !== EExportTimeRange.Custom
  ) {
    effectiveTimeRange = filterState.timeRange;
  }

  const recordQuery = useMemo<ISwapRecordQuery>(
    () => ({
      timeRange: effectiveTimeRange,
      startTime: filterState.startTime,
      endTime: filterState.endTime,
      inviteCode: filterState.inviteCode,
    }),
    [
      effectiveTimeRange,
      filterState.endTime,
      filterState.inviteCode,
      filterState.startTime,
    ],
  );

  const inviteQuery = useMemo<ISwapInvitesParams>(
    () => ({
      ...recordQuery,
      tab: activeTab,
      hideZeroVolume: activeTab === 'total' ? hideZeroVolume : undefined,
      sortBy,
      sortOrder,
      limit: PAGE_SIZE,
    }),
    [activeTab, hideZeroVolume, recordQuery, sortBy, sortOrder],
  );

  const querySignature = useMemo(
    () => getSwapQuerySignature(inviteQuery),
    [inviteQuery],
  );

  const overviewQuerySignature = useMemo(
    () => getSwapQuerySignature(recordQuery),
    [recordQuery],
  );

  const totalCountQuerySignature = useMemo(
    () =>
      getSwapQuerySignature({
        ...recordQuery,
        hideZeroVolume,
      }),
    [hideZeroVolume, recordQuery],
  );

  const hasCurrentOverview =
    overviewState?.overviewQuerySignature === overviewQuerySignature;
  const hasCurrentTotalCount =
    overviewState?.totalCountQuerySignature === totalCountQuerySignature;
  const cumulativeRewards = hasCurrentOverview
    ? overviewState.cumulativeRewards
    : undefined;
  const undistributedCount = hasCurrentOverview
    ? overviewState.undistributedCount
    : undefined;
  const hasCumulativeError =
    hasCurrentOverview && overviewState.hasCumulativeError;
  const totalCount = hasCurrentTotalCount
    ? overviewState.totalCount
    : undefined;

  const updateCursor = useCallback((nextCursor: string | undefined) => {
    cursorRef.current = nextCursor;
    setCursor(nextCursor);
  }, []);

  useEffect(() => {
    refreshRequestIdRef.current += 1;
    listGenerationRef.current += 1;
    loadingMoreCursorRef.current = undefined;
    updateCursor(undefined);
    hasListDataRef.current = false;
    setCurrentInvites(undefined);
    setHasListError(false);
  }, [querySignature, updateCursor]);

  const refreshDashboard = useCallback(
    async ({ showLoading }: { showLoading: boolean }) => {
      refreshRequestIdRef.current += 1;
      listGenerationRef.current += 1;
      const requestId = refreshRequestIdRef.current;
      const listGeneration = listGenerationRef.current;
      loadingMoreCursorRef.current = undefined;
      loadingRequestIdRef.current = requestId;
      setIsLoadingMore(false);

      if (showLoading) {
        setIsLoading(true);
        setIsTabLoading(true);
      }

      const inactiveTab: ISwapRecordsTab =
        activeTab === 'undistributed' ? 'total' : 'undistributed';
      const hadLoadedListData = hasListDataRef.current;
      const [cumulativeResult, listResult, inactiveCountResult] =
        await Promise.allSettled([
          backgroundApiProxy.serviceReferralCode.getSwapCumulativeRewards(
            recordQuery,
          ),
          backgroundApiProxy.serviceReferralCode.getSwapInvites({
            ...inviteQuery,
            disableAutoToast: true,
          }),
          backgroundApiProxy.serviceReferralCode.getSwapInvites({
            ...recordQuery,
            tab: inactiveTab,
            disableAutoToast: true,
            hideZeroVolume:
              inactiveTab === 'total' ? hideZeroVolume : undefined,
            limit: 1,
          }),
        ]);

      const isLatestRequest = refreshRequestIdRef.current === requestId;
      const isLatestList =
        isLatestRequest && listGenerationRef.current === listGeneration;

      if (isLatestRequest) {
        setOverviewState((previous) => {
          const previousOverview =
            previous?.overviewQuerySignature === overviewQuerySignature
              ? previous
              : undefined;
          const previousTotalCount =
            previous?.totalCountQuerySignature === totalCountQuerySignature
              ? previous.totalCount
              : undefined;
          let nextUndistributedCount = previousOverview?.undistributedCount;
          let nextTotalCount = previousTotalCount;

          if (inactiveCountResult.status === 'fulfilled') {
            if (inactiveTab === 'undistributed') {
              nextUndistributedCount = inactiveCountResult.value.total;
            } else {
              nextTotalCount = inactiveCountResult.value.total;
            }
          }
          if (isLatestList && listResult.status === 'fulfilled') {
            if (activeTab === 'undistributed') {
              nextUndistributedCount = listResult.value.total;
            } else {
              nextTotalCount = listResult.value.total;
            }
          }

          return {
            overviewQuerySignature,
            totalCountQuerySignature,
            cumulativeRewards:
              cumulativeResult.status === 'fulfilled'
                ? cumulativeResult.value
                : previousOverview?.cumulativeRewards,
            undistributedCount: nextUndistributedCount,
            totalCount: nextTotalCount,
            hasCumulativeError: cumulativeResult.status === 'rejected',
          };
        });
      }
      if (isLatestList) {
        if (listResult.status === 'fulfilled') {
          hasListDataRef.current = true;
          setHasListError(false);
          setCurrentInvites(listResult.value);
          updateCursor(listResult.value.cursor ?? undefined);
        } else if (!hasListDataRef.current) {
          setHasListError(true);
        }
      }

      // Once data is on screen, a failed refresh keeps the stale list/overview
      // visible and every request here has its auto error toast muted, so this
      // toast is the only signal that the refresh did not go through.
      if (
        isLatestRequest &&
        hadLoadedListData &&
        (cumulativeResult.status === 'rejected' ||
          listResult.status === 'rejected' ||
          inactiveCountResult.status === 'rejected')
      ) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_failed }),
        });
      }

      if (isLatestRequest && loadingRequestIdRef.current === requestId) {
        setIsLoading(false);
        setIsTabLoading(false);
      }
    },
    [
      activeTab,
      hideZeroVolume,
      intl,
      inviteQuery,
      overviewQuerySignature,
      recordQuery,
      totalCountQuerySignature,
      updateCursor,
    ],
  );

  useEffect(() => {
    if (!isRouteFocused) {
      return undefined;
    }

    void refreshDashboard({ showLoading: true });

    return () => {
      refreshRequestIdRef.current += 1;
      listGenerationRef.current += 1;
    };
  }, [isRouteFocused, refreshDashboard]);

  const onRefresh = useCallback(
    () => refreshDashboard({ showLoading: true }),
    [refreshDashboard],
  );

  const onLoadMore = useCallback(async () => {
    const requestedCursor = cursorRef.current;
    if (!requestedCursor || loadingMoreCursorRef.current === requestedCursor) {
      return;
    }

    const listGeneration = listGenerationRef.current;
    loadingMoreCursorRef.current = requestedCursor;
    setIsLoadingMore(true);
    try {
      const result =
        await backgroundApiProxy.serviceReferralCode.getSwapInvites({
          ...inviteQuery,
          disableAutoToast: true,
          cursor: requestedCursor,
        });

      if (
        listGenerationRef.current !== listGeneration ||
        cursorRef.current !== requestedCursor
      ) {
        return;
      }

      setCurrentInvites((previous) =>
        appendSwapInvitePage({
          current: previous,
          next: result,
        }),
      );

      // A repeated cursor cannot advance the list and must not be requested
      // again. Otherwise, preserve the server cursor byte-for-byte.
      updateCursor(
        getNextSwapCursor({
          requestedCursor,
          responseCursor: result.cursor,
        }),
      );
    } catch {
      // Keep the current page visible; the next scroll can retry this cursor.
    } finally {
      if (loadingMoreCursorRef.current === requestedCursor) {
        loadingMoreCursorRef.current = undefined;
        setIsLoadingMore(false);
      }
    }
  }, [inviteQuery, updateCursor]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const isCloseToBottom =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;

      if (isCloseToBottom && cursor && !isLoadingMore) {
        void onLoadMore();
      }
    },
    [cursor, isLoadingMore, onLoadMore],
  );

  const handleSort = useCallback(
    (field: ISwapInvitesSortBy) => {
      setHasUserSorted(true);
      if (sortBy === field) {
        setSortOrder((order) => (order === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortBy(field);
        setSortOrder('desc');
      }
    },
    [sortBy],
  );

  const maxDate = useMemo(() => new Date(), []);
  const presets = useDatePresets();
  const currentDatePickerValue = intermediateDateRange ?? datePickerValue;

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
            subject={EExportSubject.Onchain}
            tab={EExportTab.Swap}
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
      effectiveTimeRange,
      filterState,
      handleDateRangeChange,
      maxDate,
      presets,
      updateFilter,
    ],
  );

  const isFirstLoading =
    cumulativeRewards === undefined &&
    currentInvites === undefined &&
    !hasListError;

  return (
    <Page>
      <ReferFriendsDetailHeader
        title={intl.formatMessage({
          id: ETranslations.global_swap,
        })}
        toolbar={toolbar}
      />
      <Page.Body>
        <ReferFriendsPageContainer flex={1} position="relative">
          {isFirstLoading ? (
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
              <SwapRewardHeader
                data={cumulativeRewards}
                hasError={hasCumulativeError}
                isLoading={isLoading}
                onRefresh={onRefresh}
              />
              <SwapDetailsSection
                records={currentInvites?.items ?? []}
                recordQuery={recordQuery}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                undistributedCount={undistributedCount}
                totalCount={totalCount}
                hideZeroVolume={hideZeroVolume}
                onHideZeroVolumeChange={setHideZeroVolume}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                hasUserSorted={hasUserSorted}
                isLoadingMore={isLoadingMore}
                isTabLoading={isTabLoading}
                hasError={hasListError}
                onRetry={onRefresh}
              />
            </ScrollView>
          )}
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function SwapReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <SwapRewardPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
