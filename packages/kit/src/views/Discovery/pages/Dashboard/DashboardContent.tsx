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

import { useBannerData } from '../../hooks/useBannerData';
import { useDisplayHomePageFlag } from '../../hooks/useWebTabs';

import { DashboardBanner } from './Banner';
import { BookmarksSection } from './BookmarksSection';
import { DiveInContent } from './DiveInContent';
import { TrendingSection } from './TrendingSection';
import { Welcome } from './Welcome';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

function DashboardContent({
  onScroll,
}: {
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
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
        const result = await pRetry(
          () =>
            backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData(),
          {
            retries: 3,
          },
        );
        return result;
      } catch (error) {
        console.error(error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [],
    {
      watchLoading: true,
      checkIsFocused: false,
      revalidateOnReconnect: true,
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

  const content = useMemo(
    () => (
      <>
        <Welcome
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
                  isLoading={isLoading}
                />
              </View>
            ) : null
          }
          discoveryData={homePageData}
        />

        <Stack alignItems="center">
          {!isLoading && showDiveInDescription ? (
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
                    isLoading={!!isLoading}
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
      isLoading,
      showDiveInDescription,
      refresh,
      hasBookmarks,
    ],
  );

  if (platformEnv.isNative) {
    return (
      <ScrollView
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
    <ScrollView>
      <Page.Container padded={false}>{content}</Page.Container>
    </ScrollView>
  );
}

export default memo(DashboardContent);
