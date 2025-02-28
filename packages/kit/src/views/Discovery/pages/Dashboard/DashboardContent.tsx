import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  RefreshControl,
  ScrollView,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useBannerData } from '../../hooks/useBannerData';
import { useDisplayHomePageFlag } from '../../hooks/useWebTabs';

import { DashboardBanner } from './Banner';
import { BookmarksSection } from './BookmarksSection';
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
  const { data: bannerData } = useBannerData(homePageData?.banners || []);
  const hasBannerData = bannerData && bannerData.length > 0;

  const content = useMemo(
    () => (
      <>
        <Welcome
          banner={
            hasBannerData ? (
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
          </Stack>
        )}
      </>
    ),
    [
      homePageData?.banners,
      hasBannerData,
      isLoading,
      handleOpenWebSite,
      gtMd,
      navigation,
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
