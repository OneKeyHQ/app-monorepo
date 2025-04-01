import { memo, useCallback, useMemo, useState } from 'react';

import pRetry from 'p-retry';

import { RefreshControl, ScrollView, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useBannerData } from '../../hooks/useBannerData';

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
  const { result: bookmarksData } = usePromiseResult(
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

  // Check if both bookmarks and trending have no data
  const hasBookmarks = (bookmarksData && bookmarksData.length > 0) || false;
  const hasTrending =
    (homePageData?.trending && homePageData.trending.length > 0) || false;
  const showDiveInDescription = !hasBookmarks && !hasTrending;

  const content = useMemo(
    () => (
      <>
        <Welcome
          banner={
            hasActiveBanners ? (
              <DashboardBanner
                key="Banner"
                banners={homePageData?.banners || []}
                isLoading={isLoading}
              />
            ) : null
          }
          discoveryData={{ hot: homePageData?.trending }}
          isLoading={!!isLoading}
        />

        <Stack alignItems="center">
          {!isLoading && showDiveInDescription ? (
            <DiveInContent onReload={refresh} />
          ) : (
            <>
              {hasBookmarks ? (
                <Stack px="$5" width="100%" $gtXl={{ width: 960 }}>
                  <BookmarksSection key="BookmarksSection" />
                </Stack>
              ) : null}

              {hasTrending ? (
                <Stack px="$5" width="100%" $gtXl={{ width: 960 }} mt="$6">
                  <TrendingSection
                    data={homePageData?.trending || []}
                    isLoading={!!isLoading}
                  />
                </Stack>
              ) : null}
            </>
          )}
        </Stack>
      </>
    ),
    [
      hasActiveBanners,
      hasBookmarks,
      hasTrending,
      homePageData?.banners,
      homePageData?.trending,
      isLoading,
      showDiveInDescription,
      refresh,
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
      <Stack maxWidth={1280} width="100%" alignSelf="center">
        {content}
      </Stack>
    </ScrollView>
  );
}

export default memo(DashboardContent);
