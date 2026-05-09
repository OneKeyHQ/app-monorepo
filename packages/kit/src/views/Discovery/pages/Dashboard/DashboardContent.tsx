import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import pRetry from 'p-retry';
import { View } from 'react-native';

import {
  Empty,
  Page,
  RefreshControl,
  ScrollView,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { useBannerData } from '../../hooks/useBannerData';
import { useDisplayHomePageFlag } from '../../hooks/useWebTabs';

import { DashboardBanner } from './Banner';
import { BookmarksSection } from './BookmarksSection';
import { BrowserHomeModulesEditButton } from './BrowserHomeModulesEditButton';
import { normalizeBrowserHomeModules } from './browserHomeModuleUtils';
import { DiveInContent } from './DiveInContent';
import { OpenBrowserTabsSection } from './OpenBrowserTabsSection';
import { RecentlyClosedTabsSection } from './RecentlyClosedTabsSection';
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

  const hasBookmarks = Boolean(bookmarksData?.length);
  const hasTrending = Boolean(homePageData?.trending?.length);
  const [{ browserHomeModules }] = useSettingsPersistAtom();
  const visibleBrowserHomeModules = useMemo(
    () =>
      normalizeBrowserHomeModules(browserHomeModules).filter(
        (module) => module.visible,
      ),
    [browserHomeModules],
  );
  const visibleDiveInModules = useMemo(
    () =>
      visibleBrowserHomeModules.filter(
        (module) => module.id === 'bookmarks' || module.id === 'trending',
      ),
    [visibleBrowserHomeModules],
  );
  const hasVisibleDiveInModuleContent = visibleDiveInModules.some((module) =>
    module.id === 'bookmarks' ? hasBookmarks : hasTrending,
  );
  const shouldShowDiveInDescription =
    !isLoading &&
    visibleDiveInModules.length > 0 &&
    !hasVisibleDiveInModuleContent;
  const shouldShowNoVisibleModulesEmpty =
    visibleBrowserHomeModules.length === 0;

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
          {visibleBrowserHomeModules.map((module) => {
            switch (module.id) {
              case 'openTabs':
                return <OpenBrowserTabsSection key={module.id} />;
              case 'bookmarks':
                return hasBookmarks ? (
                  <Stack key={module.id} width="100%" mt="$3">
                    <BookmarksSection />
                  </Stack>
                ) : null;
              case 'trending':
                return shouldShowDiveInDescription ? null : (
                  <Stack key={module.id} width="100%" mt="$3">
                    <ReviewControl>
                      <TrendingSection
                        data={homePageData?.trending || []}
                        isLoading={!!isLoading}
                      />
                    </ReviewControl>
                  </Stack>
                );
              case 'recentlyClosed':
                return <RecentlyClosedTabsSection key={module.id} />;
              default:
                return null;
            }
          })}

          {shouldShowNoVisibleModulesEmpty ? (
            <Empty illustration="TwoBlocks" width="100%" py="$8" />
          ) : null}

          {shouldShowDiveInDescription ? (
            <DiveInContent onReload={refresh} />
          ) : null}

          <BrowserHomeModulesEditButton />
        </Stack>
      </>
    ),
    [
      hasActiveBanners,
      homePageData,
      isLoading,
      shouldShowNoVisibleModulesEmpty,
      shouldShowDiveInDescription,
      refresh,
      hasBookmarks,
      visibleBrowserHomeModules,
    ],
  );

  if (platformEnv.isNative) {
    return (
      <ScrollView
        height="100%"
        contentContainerStyle={{ pb: '$28' }}
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
    <ScrollView contentContainerStyle={{ pb: '$16' }}>
      <Page.Container padded={false}>{content}</Page.Container>
    </ScrollView>
  );
}

export default memo(DashboardContent);
