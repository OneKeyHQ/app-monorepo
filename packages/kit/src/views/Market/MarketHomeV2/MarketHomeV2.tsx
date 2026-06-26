import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, useMedia } from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EJotaiContextStoreNames,
  useMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { LazyPageContainer } from '../../../components/LazyPageContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';
import {
  useSelectedNetworkIdAtom,
  useWatchListV2Actions,
} from '../../../states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '../hooks';
import { useMarketHomePageEnterAnalytics } from '../hooks/useMarketEnterAnalytics';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';
import { MarketTestIDs } from '../testIDs';

import { useNetworkAnalytics, useTabAnalytics } from './hooks';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';
import { isMarketStockCategory } from './utils';

import type { ITimeRangeSelectorValue } from './components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketCategoryItem } from './types';

function useRefreshWatchListV2OnFocus(isFocused: boolean) {
  const actions = useWatchListV2Actions();

  useEffect(() => {
    if (isFocused) {
      void actions.current.refreshWatchListV2();
    }
  }, [actions, isFocused]);
}

const useMarketHomeLayoutProps = () => {
  const intl = useIntl();
  const { md } = useMedia();

  // Load market basic config using the new hook
  const {
    formattedMinLiquidity,
    spotCategories: apiSpotCategories,
    isLoading: isMarketBasicConfigLoading,
  } = useMarketBasicConfig();
  const [selectedNetworkId, setSelectedNetworkId] = useSelectedNetworkIdAtom();
  const [
    { tab: selectedMarketTab, selectedSpotCategory, spotCategoryToSelect },
    setMarketSelectedTab,
  ] = useMarketSelectedTabAtom();

  // Track market entry analytics
  useMarketHomePageEnterAnalytics();

  // Market analytics hooks
  const { handleTabChange } = useTabAnalytics();
  const { handleNetworkChange } = useNetworkAnalytics(selectedNetworkId);

  // Initialize with "All Networks" as default (only when not yet initialized)
  useEffect(() => {
    // Only initialize if selectedNetworkId is empty (not yet set)
    if (!selectedNetworkId) {
      // Default to "All Networks"
      const allNetworkId = getNetworkIdsMap().onekeyall;
      setSelectedNetworkId(allNetworkId);
    }
  }, [selectedNetworkId, setSelectedNetworkId]);

  const [liquidityFilter, setLiquidityFilter] = useState<ILiquidityFilter>({
    min: '5K',
  });

  // Update liquidityFilter when config loads
  useEffect(() => {
    if (formattedMinLiquidity && liquidityFilter.min === '5K') {
      setLiquidityFilter({ min: formattedMinLiquidity });
    }
  }, [formattedMinLiquidity, liquidityFilter.min]);
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('1h');

  const [selectedCategory, setSelectedCategory] = useState(
    selectedSpotCategory || 'trending',
  );

  const categories: IMarketCategoryItem[] = useMemo(() => {
    if (apiSpotCategories.length > 0) {
      return apiSpotCategories.map((c) => {
        const category = {
          id: c.type,
          name: c.name,
        };

        return {
          ...category,
          isStockCategory: isMarketStockCategory(category),
        };
      });
    }

    // Fallback before API responds
    return [
      {
        id: 'trending',
        name: intl.formatMessage({ id: ETranslations.dexmarket_trending }),
      },
    ];
  }, [apiSpotCategories, intl]);

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

    const hasSelectedCategory = categories.some(
      (item) => item.id === selectedSpotCategory,
    );
    if (hasSelectedCategory) {
      if (selectedCategory !== selectedSpotCategory) {
        setSelectedCategory(selectedSpotCategory);
      }
      return;
    }

    if (isMarketBasicConfigLoading === false) {
      const nextSelectedCategory = categories[0]?.id ?? 'trending';
      if (selectedCategory !== nextSelectedCategory) {
        setSelectedCategory(nextSelectedCategory);
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

    const hasTargetCategory = categories.some(
      (item) => item.id === spotCategoryToSelect,
    );
    if (!hasTargetCategory) {
      if (isMarketBasicConfigLoading !== false) {
        return;
      }

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

    setSelectedCategory(spotCategoryToSelect);
    setMarketSelectedTab((prev) => ({
      ...prev,
      tab: 'trending',
      selectedSpotCategory: spotCategoryToSelect,
      spotCategoryToSelect: undefined,
    }));
  }, [
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
        onCategoryChange: setSelectedCategory,
      },
      selectedNetworkId,
      liquidityFilter,
      onTabChange: handleTabChange,
    }),
    [
      selectedNetworkId,
      timeRange,
      liquidityFilter,
      handleNetworkIdChange,
      handleTabChange,
      selectedCategory,
      categories,
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

function BaseMarketHomeLayout() {
  const { md, layoutProps, shouldWaitForSpotCategoryReady } =
    useMarketHomeLayoutProps();
  const isFocused = useRouteIsFocused();
  useRefreshWatchListV2OnFocus(isFocused);

  if (shouldWaitForSpotCategoryReady) {
    return <LazyPageContainer>{null}</LazyPageContainer>;
  }

  return (
    <LazyPageContainer>
      {md || platformEnv.isNative ? (
        <MobileLayout {...layoutProps} />
      ) : (
        <DesktopLayout {...layoutProps} />
      )}
    </LazyPageContainer>
  );
}

function BaseMarketHome() {
  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Market}
      />
      <Page.Body testID={MarketTestIDs.marketPage}>
        <BaseMarketHomeLayout />
      </Page.Body>
    </Page>
  );
}

export function MarketHomeV2() {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('MarketHomeV2 render');
  }
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <BaseMarketHome />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}

function BaseMarketHomeWithProvider({
  isFocused = true,
  tabsRef,
  nestedPager = false,
}: {
  isFocused?: boolean;
  tabsRef?: React.RefObject<ITabContainerRef | null>;
  nestedPager?: boolean;
}) {
  const { layoutProps, shouldWaitForSpotCategoryReady } =
    useMarketHomeLayoutProps();
  useRefreshWatchListV2OnFocus(isFocused);
  if (shouldWaitForSpotCategoryReady) {
    return null;
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
    />
  );
}

export function MarketHomeWithProvider({
  isFocused = true,
  tabsRef,
  nestedPager = false,
}: {
  isFocused?: boolean;
  tabsRef?: React.RefObject<ITabContainerRef | null>;
  nestedPager?: boolean;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <BaseMarketHomeWithProvider
          isFocused={isFocused}
          tabsRef={tabsRef}
          nestedPager={nestedPager}
        />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}
