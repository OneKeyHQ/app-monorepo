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

interface ISwapDashboardQuerySnapshot {
  activeTab: ISwapRecordsTab;
  hideZeroVolume: boolean;
  inviteQuery: ISwapInvitesParams;
  listDatasetSignature: string;
  listQuerySignature: string;
  overviewQuerySignature: string;
  recordQuery: ISwapRecordQuery;
  totalCountQuerySignature: string;
}

interface ILoadingMoreRequest {
  cursor: string;
  listGeneration: number;
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
  const listGenerationRef = useRef(0);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadingMoreRequestRef = useRef<ILoadingMoreRequest | undefined>(
    undefined,
  );
  const hasOverviewDataRef = useRef(false);
  const displayedInviteQueryRef = useRef<ISwapInvitesParams | undefined>(
    undefined,
  );
  const displayedListDatasetSignatureRef = useRef<string | undefined>(
    undefined,
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

  const overviewQuerySignature = useMemo(
    () => getSwapQuerySignature(recordQuery),
    [recordQuery],
  );

  const listQuerySignature = useMemo(
    () => getSwapQuerySignature(inviteQuery),
    [inviteQuery],
  );

  const listDatasetSignature = useMemo(() => {
    // Sorting can retain current rows on failure; tab and filter changes cannot.
    return getSwapQuerySignature({
      ...recordQuery,
      tab: activeTab,
      hideZeroVolume: activeTab === 'total' ? hideZeroVolume : undefined,
    });
  }, [activeTab, hideZeroVolume, recordQuery]);

  const totalCountQuerySignature = useMemo(
    () =>
      getSwapQuerySignature({
        ...recordQuery,
        hideZeroVolume,
      }),
    [hideZeroVolume, recordQuery],
  );

  const listControlSignature = useMemo(
    () =>
      getSwapQuerySignature({
        activeTab,
        hideZeroVolume: activeTab === 'total' ? hideZeroVolume : undefined,
        sortBy,
        sortOrder,
      }),
    [activeTab, hideZeroVolume, sortBy, sortOrder],
  );

  const dashboardQuerySnapshot: ISwapDashboardQuerySnapshot = {
    activeTab,
    hideZeroVolume,
    inviteQuery,
    listDatasetSignature,
    listQuerySignature,
    overviewQuerySignature,
    recordQuery,
    totalCountQuerySignature,
  };
  const dashboardQuerySnapshotRef = useRef(dashboardQuerySnapshot);
  dashboardQuerySnapshotRef.current = dashboardQuerySnapshot;
  const previousListControlSignatureRef = useRef(listControlSignature);

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

  const isLatestListRequest = useCallback(
    (generation: number, querySignature: string) =>
      listGenerationRef.current === generation &&
      dashboardQuerySnapshotRef.current.listQuerySignature === querySignature,
    [],
  );

  const commitListResult = useCallback(
    ({
      inviteQuery: resultInviteQuery,
      listDatasetSignature: resultListDatasetSignature,
      result,
    }: {
      inviteQuery: ISwapInvitesParams;
      listDatasetSignature: string;
      result: ISwapInvitesResponse;
    }) => {
      displayedInviteQueryRef.current = resultInviteQuery;
      displayedListDatasetSignatureRef.current = resultListDatasetSignature;
      setHasListError(false);
      setCurrentInvites(result);
      updateCursor(result.cursor ?? undefined);
    },
    [updateCursor],
  );

  useEffect(() => {
    refreshRequestIdRef.current += 1;
    listGenerationRef.current += 1;
    loadingMoreRequestRef.current = undefined;
    updateCursor(undefined);
    hasOverviewDataRef.current = false;
    displayedInviteQueryRef.current = undefined;
    displayedListDatasetSignatureRef.current = undefined;
    setCurrentInvites(undefined);
    setHasListError(false);
  }, [overviewQuerySignature, updateCursor]);

  useEffect(() => {
    const hasReusableListData =
      displayedListDatasetSignatureRef.current === listDatasetSignature;
    listGenerationRef.current += 1;
    loadingMoreRequestRef.current = undefined;
    if (!hasReusableListData) {
      updateCursor(undefined);
    }
    setHasListError(false);
  }, [listControlSignature, listDatasetSignature, updateCursor]);

  const refreshDashboard = useCallback(async () => {
    const querySnapshot = dashboardQuerySnapshotRef.current;
    const {
      activeTab: requestActiveTab,
      hideZeroVolume: requestHideZeroVolume,
      inviteQuery: requestInviteQuery,
      listDatasetSignature: requestListDatasetSignature,
      listQuerySignature: requestListQuerySignature,
      overviewQuerySignature: requestOverviewQuerySignature,
      recordQuery: requestRecordQuery,
      totalCountQuerySignature: requestTotalCountQuerySignature,
    } = querySnapshot;
    refreshRequestIdRef.current += 1;
    listGenerationRef.current += 1;
    const requestId = refreshRequestIdRef.current;
    const listGeneration = listGenerationRef.current;
    loadingMoreRequestRef.current = undefined;
    setIsLoadingMore(false);
    setIsLoading(true);
    setIsTabLoading(true);

    const inactiveTab: ISwapRecordsTab =
      requestActiveTab === 'undistributed' ? 'total' : 'undistributed';
    const hadReusableListData =
      displayedListDatasetSignatureRef.current === requestListDatasetSignature;
    const hadDisplayedData = hadReusableListData || hasOverviewDataRef.current;
    const [cumulativeResult, listResult, inactiveCountResult] =
      await Promise.allSettled([
        backgroundApiProxy.serviceReferralCode.getSwapCumulativeRewards(
          requestRecordQuery,
        ),
        backgroundApiProxy.serviceReferralCode.getSwapInvites({
          ...requestInviteQuery,
          disableAutoToast: true,
        }),
        backgroundApiProxy.serviceReferralCode.getSwapInvites({
          ...requestRecordQuery,
          tab: inactiveTab,
          disableAutoToast: true,
          hideZeroVolume:
            inactiveTab === 'total' ? requestHideZeroVolume : undefined,
          limit: 1,
        }),
      ]);

    const latestQuerySnapshot = dashboardQuerySnapshotRef.current;
    const isLatestRequest =
      refreshRequestIdRef.current === requestId &&
      latestQuerySnapshot.overviewQuerySignature ===
        requestOverviewQuerySignature;
    const isLatestList = isLatestListRequest(
      listGeneration,
      requestListQuerySignature,
    );

    if (isLatestRequest) {
      const canApplyTotalCount =
        latestQuerySnapshot.totalCountQuerySignature ===
        requestTotalCountQuerySignature;
      if (
        cumulativeResult.status === 'fulfilled' ||
        inactiveCountResult.status === 'fulfilled'
      ) {
        hasOverviewDataRef.current = true;
      }
      setOverviewState((previous) => {
        const previousOverview =
          previous?.overviewQuerySignature === requestOverviewQuerySignature
            ? previous
            : undefined;
        const previousTotalCount =
          canApplyTotalCount &&
          previous?.totalCountQuerySignature === requestTotalCountQuerySignature
            ? previous.totalCount
            : undefined;
        let nextUndistributedCount = previousOverview?.undistributedCount;
        let nextTotalCount = canApplyTotalCount
          ? previousTotalCount
          : previous?.totalCount;
        const nextTotalCountQuerySignature = canApplyTotalCount
          ? requestTotalCountQuerySignature
          : (previous?.totalCountQuerySignature ??
            requestTotalCountQuerySignature);

        if (inactiveCountResult.status === 'fulfilled') {
          if (inactiveTab === 'undistributed') {
            nextUndistributedCount = inactiveCountResult.value.total;
          } else if (canApplyTotalCount) {
            nextTotalCount = inactiveCountResult.value.total;
          }
        }
        if (isLatestList && listResult.status === 'fulfilled') {
          if (requestActiveTab === 'undistributed') {
            nextUndistributedCount = listResult.value.total;
          } else if (canApplyTotalCount) {
            nextTotalCount = listResult.value.total;
          }
        }

        return {
          overviewQuerySignature: requestOverviewQuerySignature,
          totalCountQuerySignature: nextTotalCountQuerySignature,
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
        commitListResult({
          inviteQuery: requestInviteQuery,
          listDatasetSignature: requestListDatasetSignature,
          result: listResult.value,
        });
      } else if (!hadReusableListData) {
        setHasListError(true);
      }
    }

    // Keep current-query data visible after partial refresh failures. Every
    // request here has its auto error toast muted, so surface the failure once.
    if (
      isLatestRequest &&
      ((hadDisplayedData &&
        (cumulativeResult.status === 'rejected' ||
          inactiveCountResult.status === 'rejected')) ||
        (isLatestList &&
          hadReusableListData &&
          listResult.status === 'rejected'))
    ) {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.global_failed }),
      });
    }

    if (isLatestRequest) {
      setIsLoading(false);
    }
    if (isLatestList) {
      setIsTabLoading(false);
    }
  }, [commitListResult, intl, isLatestListRequest]);

  const refreshCurrentList = useCallback(async () => {
    const querySnapshot = dashboardQuerySnapshotRef.current;
    const {
      activeTab: requestActiveTab,
      inviteQuery: requestInviteQuery,
      listDatasetSignature: requestListDatasetSignature,
      listQuerySignature: requestListQuerySignature,
      overviewQuerySignature: requestOverviewQuerySignature,
      totalCountQuerySignature: requestTotalCountQuerySignature,
    } = querySnapshot;
    listGenerationRef.current += 1;
    const listGeneration = listGenerationRef.current;
    const hadReusableListData =
      displayedListDatasetSignatureRef.current === requestListDatasetSignature;
    loadingMoreRequestRef.current = undefined;
    if (!hadReusableListData) {
      updateCursor(undefined);
    }
    setIsLoadingMore(false);
    setHasListError(false);
    setIsTabLoading(true);

    try {
      const result =
        await backgroundApiProxy.serviceReferralCode.getSwapInvites({
          ...requestInviteQuery,
          disableAutoToast: true,
        });

      if (!isLatestListRequest(listGeneration, requestListQuerySignature)) {
        return;
      }

      commitListResult({
        inviteQuery: requestInviteQuery,
        listDatasetSignature: requestListDatasetSignature,
        result,
      });
      setOverviewState((previous) => {
        const previousOverview =
          previous?.overviewQuerySignature === requestOverviewQuerySignature
            ? previous
            : undefined;
        const previousTotalCount =
          previous?.totalCountQuerySignature === requestTotalCountQuerySignature
            ? previous.totalCount
            : undefined;

        return {
          overviewQuerySignature: requestOverviewQuerySignature,
          totalCountQuerySignature: requestTotalCountQuerySignature,
          cumulativeRewards: previousOverview?.cumulativeRewards,
          undistributedCount:
            requestActiveTab === 'undistributed'
              ? result.total
              : previousOverview?.undistributedCount,
          totalCount:
            requestActiveTab === 'total' ? result.total : previousTotalCount,
          hasCumulativeError: previousOverview?.hasCumulativeError ?? false,
        };
      });
    } catch {
      if (!isLatestListRequest(listGeneration, requestListQuerySignature)) {
        return;
      }
      if (hadReusableListData) {
        Toast.error({
          title: intl.formatMessage({ id: ETranslations.global_failed }),
        });
      } else {
        setHasListError(true);
      }
    } finally {
      if (isLatestListRequest(listGeneration, requestListQuerySignature)) {
        setIsTabLoading(false);
      }
    }
  }, [commitListResult, intl, isLatestListRequest, updateCursor]);

  useEffect(() => {
    if (!isRouteFocused) {
      return undefined;
    }

    void refreshDashboard();

    return () => {
      refreshRequestIdRef.current += 1;
      listGenerationRef.current += 1;
    };
  }, [isRouteFocused, overviewQuerySignature, refreshDashboard]);

  useEffect(() => {
    if (!isRouteFocused) {
      previousListControlSignatureRef.current = listControlSignature;
      return;
    }
    if (previousListControlSignatureRef.current === listControlSignature) {
      return;
    }

    previousListControlSignatureRef.current = listControlSignature;
    void refreshCurrentList();
  }, [isRouteFocused, listControlSignature, refreshCurrentList]);

  const onLoadMore = useCallback(async () => {
    const requestedCursor = cursorRef.current;
    const requestedInviteQuery = displayedInviteQueryRef.current;
    if (
      !requestedCursor ||
      !requestedInviteQuery ||
      loadingMoreRequestRef.current
    ) {
      return;
    }

    const loadingMoreRequest: ILoadingMoreRequest = {
      cursor: requestedCursor,
      listGeneration: listGenerationRef.current,
    };
    loadingMoreRequestRef.current = loadingMoreRequest;
    setIsLoadingMore(true);
    try {
      const result =
        await backgroundApiProxy.serviceReferralCode.getSwapInvites({
          ...requestedInviteQuery,
          disableAutoToast: true,
          cursor: requestedCursor,
        });

      if (
        listGenerationRef.current !== loadingMoreRequest.listGeneration ||
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
      if (loadingMoreRequestRef.current === loadingMoreRequest) {
        loadingMoreRequestRef.current = undefined;
        setIsLoadingMore(false);
      }
    }
  }, [updateCursor]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const isCloseToBottom =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;

      if (isCloseToBottom && cursor && !isLoadingMore && !isTabLoading) {
        void onLoadMore();
      }
    },
    [cursor, isLoadingMore, isTabLoading, onLoadMore],
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
          id: ETranslations.global_trade,
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
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={refreshDashboard}
                />
              }
              contentContainerStyle={{ pb: '$5' }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <SwapRewardHeader
                data={cumulativeRewards}
                hasError={hasCumulativeError}
                isLoading={isLoading}
                onRefresh={refreshDashboard}
              />
              <SwapDetailsSection
                records={currentInvites?.items ?? []}
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
                onRetry={refreshCurrentList}
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
