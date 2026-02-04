import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  RefreshControl,
  ScrollView,
  Spinner,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EExportSubject,
  type IPerpsCumulativeRewardsResponse,
  type IPerpsInvitesResponse,
  type IPerpsInvitesSortBy,
  type IPerpsInvitesSortOrder,
} from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  BreadcrumbSection,
  ExportButton,
  FilterButton,
  ReferFriendsPageContainer,
} from '../../components';
import { useRewardFilter } from '../../hooks/useRewardFilter';

import { PerpsDetailsSection } from './components/PerpsDetailsSection';
import { PerpsRewardHeader } from './components/PerpsRewardHeader';

type IERecordsTabValue = 'undistributed' | 'total';

function PerpsRewardPageWrapper() {
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const { md } = useMedia();

  const [isLoading, setIsLoading] = useState(false);
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

  // Pagination state
  const [cursor, setCursor] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleSort = useCallback(
    (field: IPerpsInvitesSortBy) => {
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

  const { filterState, updateFilter } = useRewardFilter();

  const headerRight = useMemo(
    () => (
      <XStack gap="$2">
        <FilterButton filterState={filterState} onFilterChange={updateFilter} />
        <ExportButton
          subject={EExportSubject.Perp}
          timeRange={filterState.timeRange}
          inviteCode={filterState.inviteCode}
        />
      </XStack>
    ),
    [filterState, updateFilter],
  );

  // Fetch counts for both tabs
  const fetchCounts = useCallback(async () => {
    const [undistributedResult, totalResult] = await Promise.allSettled([
      backgroundApiProxy.serviceReferralCode.getPerpsInvites({
        tab: 'undistributed',
        timeRange: filterState.timeRange || 'all',
        inviteCode: filterState.inviteCode,
      }),
      backgroundApiProxy.serviceReferralCode.getPerpsInvites({
        tab: 'total',
        timeRange: filterState.timeRange || 'all',
        inviteCode: filterState.inviteCode,
      }),
    ]);

    if (undistributedResult.status === 'fulfilled') {
      setUndistributedCount(undistributedResult.value.total);
    }
    if (totalResult.status === 'fulfilled') {
      setTotalCount(totalResult.value.total);
    }
  }, [filterState.timeRange, filterState.inviteCode]);

  // Fetch current tab data (resets pagination)
  const fetchCurrentTab = useCallback(async () => {
    const result = await backgroundApiProxy.serviceReferralCode.getPerpsInvites(
      {
        tab: activeTab,
        timeRange: filterState.timeRange || 'all',
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
    filterState.timeRange,
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
          timeRange: filterState.timeRange || 'all',
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
    filterState.timeRange,
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
            timeRange: filterState.timeRange,
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
    filterState.timeRange,
    filterState.inviteCode,
    fetchCounts,
    fetchCurrentTab,
  ]);

  // Initial load
  useEffect(() => {
    void onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.timeRange, filterState.inviteCode]);

  // Fetch data when tab changes
  useEffect(() => {
    setIsLoading(true);
    fetchCurrentTab()
      .catch((error) => console.error('Failed to fetch tab data:', error))
      .finally(() => setIsLoading(false));
  }, [fetchCurrentTab]);

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({ id: ETranslations.global_perp })}
          headerRight={() => headerRight}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
        />
      )}
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
              {/* Breadcrumb for desktop */}
              {!platformEnv.isNative && !md ? (
                <XStack px="$5" py="$5" jc="space-between" ai="center">
                  <BreadcrumbSection
                    secondItemLabel={intl.formatMessage({
                      id: ETranslations.global_perp,
                    })}
                  />
                  {headerRight}
                </XStack>
              ) : null}

              {/* Perps Reward Header - Stats Cards */}
              <PerpsRewardHeader
                data={cumulativeRewards}
                isLoading={isLoading}
                onRefresh={onRefresh}
              />

              {/* Details Section */}
              <PerpsDetailsSection
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
                isLoadingMore={isLoadingMore}
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
