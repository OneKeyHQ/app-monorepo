import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import pRetry from 'p-retry';
import { View } from 'react-native';

import { Page, RefreshControl, ScrollView, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { useBannerData } from '../../hooks/useBannerData';
import { useDisplayHomePageFlag } from '../../hooks/useWebTabs';
import { DiscoveryTestIDs } from '../../testIDs';

import { DashboardBanner } from './Banner';
import { BookmarksSection } from './BookmarksSection';
import { DiveInContent } from './DiveInContent';
import { TrendingSection } from './TrendingSection';
import { Welcome } from './Welcome';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

function DashboardContent({
  onScroll,
  tabId,
}: {
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  tabId?: string;
}) {
  const isFocused = useIsFocused();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    result: homePageData,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      try {
        return await pRetry(
          () =>
            backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData(),
          {
            retries: 3,
          },
        );
      } catch (error) {
        console.error(error);
        return undefined;
      } finally {
        setIsRefreshing(false);
      }
    },
    [],
    {
      watchLoading: true,
      checkIsFocused: false,
      revalidateOnReconnect: true,
      swrKey: swrKeys.discoveryHomePageData(),
    },
  );

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    void run();
  }, [run]);

  // Use the useBannerData hook to get processed banner data
  const { hasActiveBanners } = useBannerData(homePageData?.banners || []);

  // Add usePromiseResult hooks to get bookmark and trending data
  const { result: bookmarksData, run: refreshBookmarks } = usePromiseResult(
    async () => {
      const bookmarks =
        await backgroundApiProxy.serviceDiscovery.getBookmarkData({
          generateIcon: true,
          sliceCount: 14,
        });

      return bookmarks;
    },
    [],
    {
      watchLoading: true,
      swrKey: swrKeys.discoveryHomeBookmarks(),
    },
  );

  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    if (isFocus) {
      // Execute the `usePromiseResult` in the nextTick because the focus state may not have been updated.
      setTimeout(() => {
        void refreshBookmarks();
      });
    }
  });

  const { displayHomePage } = useDisplayHomePageFlag();
  useEffect(() => {
    if (displayHomePage && platformEnv.isNative) {
      void refreshBookmarks();
    }
  }, [displayHomePage, refreshBookmarks]);

  // Check if both bookmarks and trending have no data
  const hasBookmarks = bookmarksData && bookmarksData.length > 0;
  const hasTrending =
    homePageData?.trending && homePageData.trending.length > 0;
  const showDiveInDescription = !hasBookmarks && !hasTrending;
  const isInitialLoading = Boolean(
    (isLoading && !homePageData) || bookmarksData === undefined,
  );

  const content = useMemo(
    () => (
      <>
        <Welcome
          tabId={tabId}
          banner={
            hasActiveBanners ? (
              <View
                style={{ width: '100%' }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <DashboardBanner
                  key="Banner"
                  banners={homePageData?.banners || []}
                  isLoading={isInitialLoading}
                />
              </View>
            ) : null
          }
          discoveryData={homePageData}
        />

        <Stack alignItems="center">
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
      hasActiveBanners,
      homePageData,
      isInitialLoading,
      showDiveInDescription,
      refresh,
      hasBookmarks,
      tabId,
    ],
  );

  if (platformEnv.isNative) {
    return (
      <ScrollView
        testID={DiscoveryTestIDs.dashboardPage}
        height="100%"
        onScroll={isFocused ? (onScroll as any) : undefined}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
        }
      >
        {content}
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
