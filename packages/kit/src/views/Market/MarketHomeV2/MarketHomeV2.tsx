import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { type View, findNodeHandle } from 'react-native';

import {
  DelayedFreeze,
  Page,
  YStack,
  isLiquidGlassAvailable,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IWebCollapsiblePagerRef } from '@onekeyhq/kit/src/components/WebCollapsiblePagerContext';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EJotaiContextStoreNames,
  useMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IMarketCategoryToSelectResult } from '@onekeyhq/shared/src/logger/scopes/market/scenes/navigation';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { LazyPageContainer } from '../../../components/LazyPageContainer';
import { TabletHomeContainer } from '../../../components/TabletHomeContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { LegacyUniversalSearchInput } from '../../../components/TabPageHeader/LegacyUniversalSearchInput';
import { useWatchListV2Actions } from '../../../states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '../hooks';
import { resolveMarketHomeNetworkSelection } from '../hooks/marketNetworkUtils';
import { useMarketHomePageEnterAnalytics } from '../hooks/useMarketEnterAnalytics';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';
import { MarketTestIDs } from '../testIDs';
import { preloadMarketHomeTokenListSeed } from '../utils/marketHomeTokenListSeed';
import { markMarketPerf } from '../utils/marketPerf';
import { useMarketRenderCommitProbe } from '../utils/marketReactPerf';

import {
  MarketBannerProvider,
  useMarketBannerState,
} from './components/MarketBanner/MarketBannerList';
import { MarketHomeLoadingFallback } from './components/MarketHomeLoadingFallback';
import { useNetworkAnalytics, useTabAnalytics } from './hooks';
import { useMarketHomeSelection } from './hooks/useMarketHomeSelection';
import { DesktopLayout } from './layouts/DesktopLayout';
import { shouldRestoreSpotCategoryFromAtom } from './layouts/marketTabSelectionGuards';
import { MobileLayout } from './layouts/MobileLayout';
import {
  ensureMarketTopCoinsCategory,
  getMarketHomeFallbackSpotCategories,
  isMarketStockCategory,
} from './utils';

import type { ILiquidityFilter, IMarketCategoryItem } from './types';

markMarketPerf('market-home-module-eval');
preloadMarketHomeTokenListSeed();

function useRefreshWatchListV2OnFocus(isFocused: boolean) {
  const actions = useWatchListV2Actions();

  useEffect(() => {
    if (isFocused) {
      void actions.current.refreshWatchListV2();
    }
  }, [actions, isFocused]);
}

const useMarketHomeLayoutProps = () => {
  markMarketPerf('market-home-layout-props-render');
  const intl = useIntl();
  const { md } = useMedia();

  // Load market basic config using the new hook
  const {
    formattedMinLiquidity,
    spotCategories: apiSpotCategories,
    stockCategories: apiStockCategories,
    assetCategories: apiAssetCategories,
    networkList,
    isLoading: isMarketBasicConfigLoading,
  } = useMarketBasicConfig();
  const [savedNetworkId, setSelectedNetworkId] = useMarketHomeSelection(
    'selectedNetworkId',
    getNetworkIdsMap().onekeyall,
  );
  const selectedNetworkId = resolveMarketHomeNetworkSelection({
    selectedNetworkId: savedNetworkId,
    networkList,
    isConfigLoading: isMarketBasicConfigLoading,
  });
  useEffect(() => {
    if (savedNetworkId !== selectedNetworkId) {
      setSelectedNetworkId(selectedNetworkId);
    }
  }, [savedNetworkId, selectedNetworkId, setSelectedNetworkId]);
  const [
    { tab: selectedMarketTab, selectedSpotCategory, spotCategoryToSelect },
    setMarketSelectedTab,
  ] = useMarketSelectedTabAtom();

  // Track market entry analytics
  useMarketHomePageEnterAnalytics();

  // Market analytics hooks
  const { handleTabChange } = useTabAnalytics();
  const { handleNetworkChange } = useNetworkAnalytics(selectedNetworkId);

  const [liquidityFilter, setLiquidityFilter] = useState<ILiquidityFilter>({
    min: '5K',
  });

  // Update liquidityFilter when config loads
  useEffect(() => {
    if (formattedMinLiquidity && liquidityFilter.min === '5K') {
      setLiquidityFilter({ min: formattedMinLiquidity });
    }
  }, [formattedMinLiquidity, liquidityFilter.min]);
  const [timeRange, setTimeRange] = useMarketHomeSelection('timeRange', '1h');

  const [selectedCategory, setSelectedCategory] = useState(
    selectedSpotCategory || 'trending',
  );
  // The category most recently applied by an explicit intent (user tap or
  // deep link). The bg-synced atom echoes writes back asynchronously, so this
  // ref is the freshest truth; the atom may lag behind it.
  const pendingSpotCategoryRef = useRef<string | undefined>(undefined);
  const applySelectedCategory = useCallback((categoryId: string) => {
    pendingSpotCategoryRef.current = categoryId;
    setSelectedCategory(categoryId);
  }, []);

  const categories: IMarketCategoryItem[] = useMemo(() => {
    if (apiSpotCategories.length > 0) {
      const mappedCategories = apiSpotCategories.map((c) => {
        const category = {
          id: c.type,
          name: c.name,
        };

        return {
          ...category,
          isStockCategory: isMarketStockCategory(category),
        };
      });

      return ensureMarketTopCoinsCategory(
        mappedCategories,
        intl.formatMessage({ id: ETranslations.market_top_coins }),
      );
    }

    // Fallback before API responds: keep Stocks / Robinhood tab identities so
    // their list components still mount under a weak or offline config fetch.
    return ensureMarketTopCoinsCategory(
      getMarketHomeFallbackSpotCategories((descriptor) =>
        intl.formatMessage(descriptor),
      ),
      intl.formatMessage({ id: ETranslations.market_top_coins }),
    );
  }, [apiSpotCategories, intl]);

  const stockCategories: IMarketCategoryItem[] = useMemo(
    () =>
      apiStockCategories.map((category) => ({
        id: category.category,
        name: category.name,
      })),
    [apiStockCategories],
  );

  const topCoinsCategories: IMarketCategoryItem[] = useMemo(
    () =>
      apiAssetCategories.map((category) => ({
        id: category.category,
        name: category.name,
      })),
    [apiAssetCategories],
  );

  const spotCategoryToRestore = spotCategoryToSelect ?? selectedSpotCategory;
  const shouldWaitForSpotCategoryReady = Boolean(
    selectedMarketTab === 'trending' &&
    spotCategoryToRestore &&
    spotCategoryToRestore !== 'trending' &&
    isMarketBasicConfigLoading !== false &&
    !apiSpotCategories.some((item) => item.type === spotCategoryToRestore),
  );

  useEffect(() => {
    if (!selectedSpotCategory || spotCategoryToSelect) {
      return;
    }

    // The atom echoes UI writes back after a bg round-trip; until it carries
    // the latest locally-applied category, restoring from it would revert the
    // user's selection and make the pager jump back (OK-57367).
    if (
      !shouldRestoreSpotCategoryFromAtom({
        pendingSpotCategoryId: pendingSpotCategoryRef.current,
        atomSpotCategoryId: selectedSpotCategory,
      })
    ) {
      return;
    }

    const hasSelectedCategory = categories.some(
      (item) => item.id === selectedSpotCategory,
    );
    if (hasSelectedCategory) {
      if (selectedCategory !== selectedSpotCategory) {
        applySelectedCategory(selectedSpotCategory);
      }
      return;
    }

    if (isMarketBasicConfigLoading === false) {
      const nextSelectedCategory = categories[0]?.id ?? 'trending';
      defaultLogger.market.navigation.marketHomeResetSpotCategory({
        categoryId: selectedSpotCategory,
        nextCategoryId: nextSelectedCategory,
        categoryCount: categories.length,
      });
      if (selectedCategory !== nextSelectedCategory) {
        applySelectedCategory(nextSelectedCategory);
      }
      setMarketSelectedTab((prev) => {
        if (prev.selectedSpotCategory !== selectedSpotCategory) {
          return prev;
        }
        return {
          ...prev,
          selectedSpotCategory: undefined,
        };
      });
    }
  }, [
    applySelectedCategory,
    categories,
    isMarketBasicConfigLoading,
    selectedCategory,
    selectedSpotCategory,
    setMarketSelectedTab,
    spotCategoryToSelect,
  ]);

  useEffect(() => {
    if (!spotCategoryToSelect) {
      return;
    }

    const logResult = (result: IMarketCategoryToSelectResult) => {
      defaultLogger.market.navigation.marketHomeApplySpotCategory({
        categoryId: spotCategoryToSelect,
        result,
        categoryCount: categories.length,
      });
    };
    const hasTargetCategory = categories.some(
      (item) => item.id === spotCategoryToSelect,
    );
    if (!hasTargetCategory) {
      if (isMarketBasicConfigLoading !== false) {
        logResult('waitingForConfig');
        return;
      }

      logResult('unknownCategory');
      setMarketSelectedTab((prev) => ({
        ...prev,
        selectedSpotCategory:
          prev.selectedSpotCategory === spotCategoryToSelect
            ? undefined
            : prev.selectedSpotCategory,
        spotCategoryToSelect: undefined,
      }));
      return;
    }

    logResult('applied');
    applySelectedCategory(spotCategoryToSelect);
    setMarketSelectedTab((prev) => ({
      ...prev,
      tab: 'trending',
      selectedSpotCategory: spotCategoryToSelect,
      spotCategoryToSelect: undefined,
    }));
  }, [
    applySelectedCategory,
    categories,
    isMarketBasicConfigLoading,
    setMarketSelectedTab,
    spotCategoryToSelect,
  ]);

  const handleNetworkIdChange = useCallback(
    (networkId: string) => {
      handleNetworkChange(networkId, setSelectedNetworkId);
    },
    [handleNetworkChange, setSelectedNetworkId],
  );

  const layoutProps = useMemo(
    () => ({
      filterBarProps: {
        selectedNetworkId,
        timeRange,
        liquidityFilter,
        onNetworkIdChange: handleNetworkIdChange,
        onTimeRangeChange: setTimeRange,
        onLiquidityFilterChange: setLiquidityFilter,
        selectedCategory,
        categories,
        stockCategories,
        topCoinsCategories,
        isCategoryConfigLoading: isMarketBasicConfigLoading,
        onCategoryChange: applySelectedCategory,
      },
      selectedNetworkId,
      liquidityFilter,
      onTabChange: handleTabChange,
    }),
    [
      selectedNetworkId,
      timeRange,
      setTimeRange,
      liquidityFilter,
      handleNetworkIdChange,
      handleTabChange,
      selectedCategory,
      categories,
      stockCategories,
      topCoinsCategories,
      isMarketBasicConfigLoading,
      applySelectedCategory,
    ],
  );

  return useMemo(
    () => ({
      md,
      layoutProps,
      shouldWaitForSpotCategoryReady,
    }),
    [md, layoutProps, shouldWaitForSpotCategoryReady],
  );
};

function MarketHomeLayoutContent({
  externalTopOverlayTag,
  externalTopOverlayHeight,
}: {
  externalTopOverlayTag?: number;
  externalTopOverlayHeight?: number;
}) {
  const { isLoading: isBannerPending } = useMarketBannerState();
  markMarketPerf('market-home-base-layout-render');
  useMarketRenderCommitProbe('MarketHome.BaseLayout');
  const { md, layoutProps, shouldWaitForSpotCategoryReady } =
    useMarketHomeLayoutProps();
  const isFocused = useRouteIsFocused();
  useRefreshWatchListV2OnFocus(isFocused);

  if (
    shouldWaitForSpotCategoryReady ||
    (platformEnv.isNative && isBannerPending)
  ) {
    return (
      <LazyPageContainer eager={platformEnv.isWeb}>
        {md || platformEnv.isNative ? (
          <YStack flex={1} pt={externalTopOverlayHeight ?? 0}>
            <MarketHomeLoadingFallback />
          </YStack>
        ) : null}
      </LazyPageContainer>
    );
  }

  return (
    <LazyPageContainer eager={platformEnv.isWeb}>
      {md || platformEnv.isNative ? (
        <MobileLayout
          {...layoutProps}
          isFocused={isFocused}
          {...(platformEnv.isNativeIOS
            ? { externalTopOverlayTag, externalTopOverlayHeight }
            : {})}
        />
      ) : (
        <DesktopLayout {...layoutProps} />
      )}
    </LazyPageContainer>
  );
}

function BaseMarketHomeLayout({
  externalTopOverlayTag,
  externalTopOverlayHeight,
}: {
  externalTopOverlayTag?: number;
  externalTopOverlayHeight?: number;
}) {
  return (
    <MarketBannerProvider>
      <MarketHomeLayoutContent
        externalTopOverlayTag={externalTopOverlayTag}
        externalTopOverlayHeight={externalTopOverlayHeight}
      />
    </MarketBannerProvider>
  );
}

function BaseMarketHome() {
  const isFocused = useRouteIsFocused();
  const { top } = useSafeAreaInsets();
  const searchGlassActive = isLiquidGlassAvailable();
  const scrollEdgeHeaderEnabled = Boolean(
    platformEnv.isNativeIOS && searchGlassActive,
  );
  const headerRef = useRef<View>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [headerTag, setHeaderTag] = useState(0);
  const handleHeaderRef = useCallback((view: View | null) => {
    headerRef.current = view;
    if (view === null) {
      setHeaderTag(0);
      setHeaderHeight(0);
    }
  }, []);
  const headerReady =
    scrollEdgeHeaderEnabled && headerHeight > 0 && headerTag > 0;
  let searchTop = top;
  if (platformEnv.isNativeAndroid) {
    searchTop = top + 5;
  } else if (searchGlassActive) {
    searchTop = top + 6;
  }

  return (
    <Page fullPage={platformEnv.isNative}>
      {platformEnv.isNative ? (
        <>
          <Page.Header headerShown={false} />
          <YStack
            ref={handleHeaderRef}
            collapsable={false}
            onLayout={(event) => {
              if (!scrollEdgeHeaderEnabled) return;
              const tag = findNodeHandle(headerRef.current) ?? 0;
              if (
                tag <= 0 ||
                !('target' in event.nativeEvent) ||
                event.nativeEvent.target !== tag
              ) {
                return;
              }
              const height = event.nativeEvent.layout.height;
              if (height > 0 && height !== headerHeight) {
                setHeaderHeight(height);
              }
              if (tag > 0 && tag !== headerTag) {
                setHeaderTag(tag);
              }
            }}
            bg={headerReady ? undefined : '$bgApp'}
            position={headerReady ? 'absolute' : undefined}
            top={headerReady ? 0 : undefined}
            left={headerReady ? 0 : undefined}
            right={headerReady ? 0 : undefined}
            zIndex={headerReady ? 10 : undefined}
            pt={searchTop}
            pb="$2"
            px="$5"
            width="100%"
          >
            <LegacyUniversalSearchInput
              size="medium"
              glass
              initialTab="market"
              tabRoute={ETabRoutes.Market}
              containerProps={{
                width: '100%',
                $gtLg: undefined,
              }}
            />
          </YStack>
        </>
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.Market}
        />
      )}
      <Page.Body testID={MarketTestIDs.marketPage}>
        <DelayedFreeze freeze={!platformEnv.isNative && !isFocused}>
          <BaseMarketHomeLayout
            externalTopOverlayTag={headerReady ? headerTag : undefined}
            externalTopOverlayHeight={headerReady ? headerHeight : undefined}
          />
        </DelayedFreeze>
      </Page.Body>
    </Page>
  );
}

export function MarketHomeV2() {
  markMarketPerf('market-home-render');
  useMarketRenderCommitProbe('MarketHomeV2');
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('MarketHomeV2 render');
  }
  return (
    <TabletHomeContainer>
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
        enabledNum={[0]}
        waitForStorageReady={!platformEnv.isWeb}
      >
        <MarketWatchListProviderMirrorV2
          storeName={EJotaiContextStoreNames.marketWatchListV2}
        >
          <BaseMarketHome />
        </MarketWatchListProviderMirrorV2>
      </AccountSelectorProviderMirror>
    </TabletHomeContainer>
  );
}

function BaseMarketHomeWithProvider({
  isFocused = true,
  tabsRef,
  nestedPager = false,
  externalTopOverlayTag,
  externalTopOverlayHeight,
}: {
  isFocused?: boolean;
  tabsRef?: React.RefObject<IWebCollapsiblePagerRef | null>;
  nestedPager?: boolean;
  externalTopOverlayTag?: number;
  externalTopOverlayHeight?: number;
}) {
  const { layoutProps, shouldWaitForSpotCategoryReady } =
    useMarketHomeLayoutProps();
  useRefreshWatchListV2OnFocus(isFocused);
  const { isLoading: isBannerPending } = useMarketBannerState();
  if (
    shouldWaitForSpotCategoryReady ||
    (platformEnv.isNative && isBannerPending)
  ) {
    return platformEnv.isNative ? (
      <YStack flex={1} pt={externalTopOverlayHeight ?? 0}>
        <MarketHomeLoadingFallback />
      </YStack>
    ) : null;
  }
  // In nested outer pagers (Discovery: Market/Earn/Browser), keep Market mounted
  // and let Freeze control inactive-page performance. Unmounting here causes
  // visible flashes when the outer pager finishes settling.
  if (!isFocused && !nestedPager) {
    return null;
  }
  return (
    <MobileLayout
      {...layoutProps}
      isFocused={isFocused}
      tabsRef={tabsRef}
      nestedPager={nestedPager}
      {...(platformEnv.isNativeIOS
        ? { externalTopOverlayTag, externalTopOverlayHeight }
        : {})}
    />
  );
}

export function MarketHomeWithProvider({
  isFocused = true,
  tabsRef,
  nestedPager = false,
  externalTopOverlayTag,
  externalTopOverlayHeight,
}: {
  isFocused?: boolean;
  tabsRef?: React.RefObject<IWebCollapsiblePagerRef | null>;
  nestedPager?: boolean;
  externalTopOverlayTag?: number;
  externalTopOverlayHeight?: number;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
      waitForStorageReady={!platformEnv.isWeb}
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <MarketBannerProvider>
          <BaseMarketHomeWithProvider
            isFocused={isFocused}
            tabsRef={tabsRef}
            nestedPager={nestedPager}
            externalTopOverlayTag={externalTopOverlayTag}
            externalTopOverlayHeight={externalTopOverlayHeight}
          />
        </MarketBannerProvider>
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}
