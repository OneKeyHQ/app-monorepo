import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import pRetry from 'p-retry';
import { View } from 'react-native';

import {
  DelayedFreeze,
  Page,
  RefreshControl,
  ScrollView,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  ReviewControl,
  useReviewControl,
} from '@onekeyhq/kit/src/components/ReviewControl';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { useBannerData } from '../../hooks/useBannerData';
import {
  DashboardVisibilityProbe,
  getDiagnosticsErrorMessage,
  isDiscoveryHomeDiagnosticsEnabled,
  nextDiscoveryHomeRequestSeq,
  useDashboardFocusGateLog,
  useDiagnosticsLayoutLogger,
  useDiagnosticsLifecycleLog,
  useDiagnosticsLogOnChange,
  useDiscoveryHomeDiagnosticsId,
} from '../../hooks/useDiscoveryHomeDiagnostics';
import { useDisplayHomePageFlag } from '../../hooks/useWebTabs';
import { DiscoveryTestIDs } from '../../testIDs';

import { DashboardBanner } from './Banner';
import { BookmarksSection } from './BookmarksSection';
import { DiveInContent } from './DiveInContent';
import { TrendingSection } from './TrendingSection';
import { Welcome } from './Welcome';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

function DashboardContent({
  isActive = true,
  onScroll,
  tabId,
}: {
  isActive?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  tabId?: string;
}) {
  const isFocused = useIsFocused();
  const isContentActive = isFocused && isActive;

  const diagId = useDiscoveryHomeDiagnosticsId();
  useDiagnosticsLifecycleLog(diagId, (params) =>
    defaultLogger.discovery.homeDiagnostics.dashboardLifecycle(params),
  );
  // The bookmarks request below is gated by the same route focus, so this
  // records whether a focus-triggered refresh could actually start.
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    result: homePageData,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const seq = nextDiscoveryHomeRequestSeq();
      const startedAt = Date.now();
      if (isDiscoveryHomeDiagnosticsEnabled) {
        defaultLogger.discovery.homeDiagnostics.dashboardRequest({
          id: diagId,
          request: 'homePageData',
          phase: 'start',
          seq,
        });
      }
      try {
        const data = await pRetry(
          () =>
            backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData(),
          {
            retries: 3,
            onFailedAttempt: (error) => {
              if (isDiscoveryHomeDiagnosticsEnabled) {
                defaultLogger.discovery.homeDiagnostics.dashboardRequest({
                  id: diagId,
                  request: 'homePageData',
                  phase: 'retry',
                  seq,
                  attempt: error.attemptNumber,
                  error: getDiagnosticsErrorMessage(error),
                });
              }
            },
          },
        );
        if (isDiscoveryHomeDiagnosticsEnabled) {
          defaultLogger.discovery.homeDiagnostics.dashboardRequest({
            id: diagId,
            request: 'homePageData',
            phase: 'success',
            seq,
            durationMs: Date.now() - startedAt,
            bannerCount: data?.banners?.length ?? 0,
            trendingCount: data?.trending?.length ?? 0,
            hotCount: data?.hot?.length ?? 0,
            categoryCount: data?.categories?.length ?? 0,
          });
        }
        return data;
      } catch (error) {
        if (isDiscoveryHomeDiagnosticsEnabled) {
          defaultLogger.discovery.homeDiagnostics.dashboardRequest({
            id: diagId,
            request: 'homePageData',
            phase: 'error',
            seq,
            durationMs: Date.now() - startedAt,
            error: getDiagnosticsErrorMessage(error),
          });
        }
        console.error(error);
        return undefined;
      } finally {
        setIsRefreshing(false);
      }
    },
    [diagId],
    {
      watchLoading: true,
      checkIsFocused: false,
      revalidateOnReconnect: true,
      swrKey: swrKeys.discoveryHomePageData(),
    },
  );

  const refresh = useCallback(() => {
    if (isDiscoveryHomeDiagnosticsEnabled) {
      defaultLogger.discovery.homeDiagnostics.dashboardRequest({
        id: diagId,
        request: 'homePageData',
        phase: 'requested',
        trigger: 'reload',
      });
    }
    setIsRefreshing(true);
    void run();
  }, [diagId, run]);

  const isTravelMode =
    travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
    'travel-mode';
  // Use the useBannerData hook to get processed banner data
  const { hasActiveBanners, data: activeBanners } = useBannerData(
    homePageData?.banners || [],
  );
  const showBanners = hasActiveBanners && !isTravelMode;

  // Add usePromiseResult hooks to get bookmark and trending data
  const { result: bookmarksData, run: refreshBookmarks } = usePromiseResult(
    async () => {
      const seq = nextDiscoveryHomeRequestSeq();
      const startedAt = Date.now();
      if (isDiscoveryHomeDiagnosticsEnabled) {
        defaultLogger.discovery.homeDiagnostics.dashboardRequest({
          id: diagId,
          request: 'bookmarks',
          phase: 'start',
          seq,
        });
      }
      try {
        const bookmarks =
          await backgroundApiProxy.serviceDiscovery.getBookmarkData({
            generateIcon: true,
            sliceCount: 14,
          });
        if (isDiscoveryHomeDiagnosticsEnabled) {
          defaultLogger.discovery.homeDiagnostics.dashboardRequest({
            id: diagId,
            request: 'bookmarks',
            phase: 'success',
            seq,
            durationMs: Date.now() - startedAt,
            count: bookmarks.length,
          });
        }
        return bookmarks;
      } catch (error) {
        if (isDiscoveryHomeDiagnosticsEnabled) {
          defaultLogger.discovery.homeDiagnostics.dashboardRequest({
            id: diagId,
            request: 'bookmarks',
            phase: 'error',
            seq,
            durationMs: Date.now() - startedAt,
            error: getDiagnosticsErrorMessage(error),
          });
        }
        throw error;
      }
    },
    [diagId],
    {
      watchLoading: true,
      swrKey: swrKeys.discoveryHomeBookmarks(),
    },
  );

  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    if (isFocus) {
      // Execute the `usePromiseResult` in the nextTick because the focus state may not have been updated.
      setTimeout(() => {
        if (isDiscoveryHomeDiagnosticsEnabled) {
          defaultLogger.discovery.homeDiagnostics.dashboardRequest({
            id: diagId,
            request: 'bookmarks',
            phase: 'requested',
            trigger: 'tabFocus',
            gateOpen: isFocusedRef.current,
          });
        }
        void refreshBookmarks();
      });
    }
  });

  const { displayHomePage } = useDisplayHomePageFlag();
  useEffect(() => {
    if (displayHomePage && platformEnv.isNative) {
      if (isDiscoveryHomeDiagnosticsEnabled) {
        defaultLogger.discovery.homeDiagnostics.dashboardRequest({
          id: diagId,
          request: 'bookmarks',
          phase: 'requested',
          trigger: 'displayHomePage',
          gateOpen: isFocusedRef.current,
        });
      }
      void refreshBookmarks();
    }
  }, [diagId, displayHomePage, refreshBookmarks]);

  useDashboardFocusGateLog({
    id: diagId,
    routeFocused: isFocused,
    isActive,
    contentActive: isContentActive,
    displayHomePage,
  });

  // Check if both bookmarks and trending have no data
  const hasBookmarks = bookmarksData && bookmarksData.length > 0;
  const hasTrending =
    homePageData?.trending && homePageData.trending.length > 0;
  const showDiveInDescription = !hasBookmarks && !hasTrending;
  const isInitialLoading = Boolean(
    (isLoading && !homePageData) || bookmarksData === undefined,
  );

  const reviewControlShow = useReviewControl();
  const showDiveIn = !isInitialLoading && showDiveInDescription;
  useDiagnosticsLogOnChange(
    {
      id: diagId,
      homeDataLoaded: !!homePageData,
      homeDataLoading: isLoading,
      bannerCount: homePageData?.banners?.length ?? 0,
      activeBannerCount: activeBanners.length,
      showBanners,
      travelMode: isTravelMode,
      trendingCount: homePageData?.trending?.length ?? 0,
      hotCount: homePageData?.hot?.length ?? 0,
      bookmarksLoaded: bookmarksData !== undefined,
      bookmarkCount: bookmarksData?.length ?? 0,
      initialLoading: isInitialLoading,
      showDiveIn,
      showBookmarks: !showDiveIn && !!hasBookmarks,
      showTrending: !showDiveIn,
      reviewControlShow,
    },
    (value) =>
      defaultLogger.discovery.homeDiagnostics.dashboardRenderPlan(value),
  );

  const handleSectionsLayout = useDiagnosticsLayoutLogger(
    diagId,
    'dashboardSections',
  );
  const handleScrollLayout = useDiagnosticsLayoutLogger(
    diagId,
    'dashboardScroll',
  );
  const lastContentSizeRef = useRef('');
  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      if (!isDiscoveryHomeDiagnosticsEnabled) {
        return;
      }
      const size = { width: Math.round(width), height: Math.round(height) };
      const key = `${size.width},${size.height}`;
      if (lastContentSizeRef.current === key) {
        return;
      }
      lastContentSizeRef.current = key;
      defaultLogger.discovery.homeDiagnostics.dashboardScroll({
        id: diagId,
        event: 'contentSize',
        ...size,
      });
    },
    [diagId],
  );
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isDiscoveryHomeDiagnosticsEnabled) {
        return;
      }
      defaultLogger.discovery.homeDiagnostics.dashboardScroll({
        id: diagId,
        event: 'scrollEnd',
        offsetY: Math.round(event.nativeEvent.contentOffset.y),
      });
    },
    [diagId],
  );

  const content = useMemo(
    () => (
      <>
        <Welcome
          tabId={tabId}
          banner={
            showBanners ? (
              <View
                style={{ width: '100%', alignItems: 'center' }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <DashboardBanner
                  key="Banner"
                  banners={homePageData?.banners || []}
                  isLoading={isInitialLoading}
                  autoplayEnabled={isContentActive}
                />
              </View>
            ) : null
          }
          discoveryData={homePageData}
        />

        <Stack alignItems="center" onLayout={handleSectionsLayout}>
          {!isInitialLoading && showDiveInDescription ? (
            <DiveInContent onReload={refresh} />
          ) : (
            <>
              {hasBookmarks ? (
                <Stack px="$pagePadding" width="100%">
                  <BookmarksSection key="BookmarksSection" />
                </Stack>
              ) : null}

              <Stack px="$pagePadding" width="100%" mt="$4">
                <ReviewControl>
                  <TrendingSection
                    data={homePageData?.trending || []}
                    isLoading={isInitialLoading}
                  />
                </ReviewControl>
              </Stack>
            </>
          )}
        </Stack>
      </>
    ),
    [
      showBanners,
      homePageData,
      isInitialLoading,
      showDiveInDescription,
      refresh,
      hasBookmarks,
      isContentActive,
      tabId,
      handleSectionsLayout,
    ],
  );

  if (platformEnv.isNative) {
    return (
      <ScrollView
        testID={DiscoveryTestIDs.dashboardPage}
        height="100%"
        onScroll={isContentActive ? (onScroll as any) : undefined}
        scrollEventThrottle={16}
        onLayout={handleScrollLayout}
        onContentSizeChange={handleContentSizeChange}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
        }
      >
        <DelayedFreeze freeze={!isContentActive}>
          <DashboardVisibilityProbe id={diagId} />
          {content}
        </DelayedFreeze>
      </ScrollView>
    );
  }

  return (
    <ScrollView testID={DiscoveryTestIDs.dashboardPage}>
      <Page.Container padded={false}>{content}</Page.Container>
    </ScrollView>
  );
}

export default memo(DashboardContent);
