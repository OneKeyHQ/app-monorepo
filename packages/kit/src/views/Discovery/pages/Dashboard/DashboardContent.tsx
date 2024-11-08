import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  RefreshControl,
  ScrollView,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useDisplayHomePageFlag } from '../../hooks/useWebTabs';

import { DashboardBanner } from './Banner';
import { BookmarksAndHistoriesSection } from './BookmarksAndHistoriesSection';
import { SuggestedAndExploreSection } from './SuggestAndExploreSection';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

function DashboardContent({
  onScroll,
}: {
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const { displayHomePage } = useDisplayHomePageFlag();
  const { gtMd } = useMedia();
  const { handleOpenWebSite } = useBrowserAction().current;
  const { result: [bookmarksData, historiesData] = [], run: refreshLocalData } =
    usePromiseResult(
      async () => {
        const bookmarks = backgroundApiProxy.serviceDiscovery.getBookmarkData({
          generateIcon: true,
          sliceCount: 8,
        });
        const histories = backgroundApiProxy.serviceDiscovery.getHistoryData({
          generateIcon: true,
          sliceCount: 8,
        });
        return Promise.all([bookmarks, histories]);
      },
      [],
      {
        watchLoading: true,
      },
    );

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

  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    if (isFocus) {
      // Execute the `usePromiseResult` in the nextTick because the focus state may not have been updated.
      setTimeout(() => {
        void refreshLocalData();
      });
    }
  });

  useEffect(() => {
    if (displayHomePage && platformEnv.isNative) {
      void refreshLocalData();
    }
  }, [displayHomePage, refreshLocalData]);

  const onPressMore = useCallback(
    (isHistoriesView: boolean) => {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: isHistoriesView
          ? EDiscoveryModalRoutes.HistoryListModal
          : EDiscoveryModalRoutes.BookmarkListModal,
      });
    },
    [navigation],
  );

  const content = useMemo(() => {
    const isShowBanner =
      Array.isArray(homePageData?.banners) && homePageData.banners.length > 0;
    return (
      <>
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
        {platformEnv.isExtension || platformEnv.isWeb ? null : (
          <BookmarksAndHistoriesSection
            showSectionHeaderBorder={isShowBanner}
            key="BookmarksAndHistoriesSection"
            bookmarksData={bookmarksData}
            historiesData={historiesData}
            onPressMore={onPressMore}
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
        )}
        <ReviewControl>
          <SuggestedAndExploreSection
            key="SuggestedAndExploreSection"
            suggestedData={
              Array.isArray(homePageData?.categories)
                ? homePageData.categories
                : []
            }
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
            isLoading={isLoading}
          />
        </ReviewControl>
      </>
    );
  }, [
    homePageData?.banners,
    homePageData?.categories,
    isLoading,
    bookmarksData,
    historiesData,
    onPressMore,
    handleOpenWebSite,
    gtMd,
    navigation,
  ]);

  if (platformEnv.isNative) {
    return (
      <ScrollView
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
