import { memo, useCallback, useMemo, useState } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  RefreshControl,
  ScrollView,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const { gtMd } = useMedia();
  const { height: screenHeight } = useWindowDimensions();
  const { handleOpenWebSite } = useBrowserAction().current;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    result: homePageData,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const homePageResponse =
        await backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData();
      setIsRefreshing(false);
      return homePageResponse;
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

  const { result: trendingData } = usePromiseResult<any[]>(
    async () => {
      const data =
        await backgroundApiProxy.serviceDiscovery.fetchDiscoveryHomePageData();
      return data.trending || [];
    },
    [],
    {
      watchLoading: true,
    },
  );

  // Check if both bookmarks and trending have no data
  const hasBookmarks = (bookmarksData && bookmarksData.length > 0) || false;
  const hasTrending = (trendingData && trendingData.length > 0) || false;
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
                handleOpenWebSite={({ webSite, useSystemBrowser }) => {
                  if (useSystemBrowser && webSite?.url) {
                    openUrlExternal(webSite.url);
                  } else if (webSite?.url) {
                    handleOpenWebSite({
                      switchToMultiTabBrowser: gtMd,
                      webSite,
                      navigation,
                      shouldPopNavigation: false,
                    });
                  }
                  defaultLogger.discovery.dapp.enterDapp({
                    dappDomain: webSite?.url || '',
                    dappName: webSite?.title || '',
                    enterMethod: EEnterMethod.banner,
                  });
                }}
                isLoading={isLoading}
              />
            ) : null
          }
        />

        {platformEnv.isExtension || platformEnv.isWeb ? null : (
          <Stack alignItems="center">
            {showDiveInDescription ? (
              <DiveInContent />
            ) : (
              <>
                <Stack px="$5" width="100%" $gtXl={{ width: 960 }}>
                  <BookmarksSection
                    key="BookmarksSection"
                    handleOpenWebSite={({ webSite }) => {
                      handleOpenWebSite({
                        switchToMultiTabBrowser: gtMd,
                        webSite,
                        navigation,
                        shouldPopNavigation: false,
                      });
                      defaultLogger.discovery.dapp.enterDapp({
                        dappDomain: webSite?.url || '',
                        dappName: webSite?.title || '',
                        enterMethod: EEnterMethod.dashboard,
                      });
                    }}
                  />
                </Stack>

                {/* here is trending */}
                <Stack px="$5" width="100%" $gtXl={{ width: 960 }} mt="$6">
                  <TrendingSection
                    handleOpenWebSite={({ webSite }) => {
                      handleOpenWebSite({
                        switchToMultiTabBrowser: gtMd,
                        webSite,
                        navigation,
                        shouldPopNavigation: false,
                      });
                      defaultLogger.discovery.dapp.enterDapp({
                        dappDomain: webSite?.url || '',
                        dappName: webSite?.title || '',
                        enterMethod: EEnterMethod.dashboard,
                      });
                    }}
                  />
                </Stack>
              </>
            )}
          </Stack>
        )}
      </>
    ),
    [
      homePageData?.banners,
      hasActiveBanners,
      isLoading,
      handleOpenWebSite,
      gtMd,
      navigation,
      showDiveInDescription,
    ],
  );

  if (platformEnv.isNative) {
    return (
      <ScrollView
        onScroll={isFocused ? (onScroll as any) : undefined}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
        }
      >
        <Stack minHeight={screenHeight}>{content}</Stack>
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
