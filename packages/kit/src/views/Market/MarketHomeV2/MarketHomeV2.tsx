import { useCallback, useEffect, useMemo, useState } from 'react';

import { Page, useMedia } from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { LazyPageContainer } from '../../../components/LazyPageContainer';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { useSelectedNetworkIdAtom } from '../../../states/jotai/contexts/marketV2';
import { useMarketBasicConfig } from '../hooks';
import { useMarketHomePageEnterAnalytics } from '../hooks/useMarketEnterAnalytics';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import { useNetworkAnalytics, useTabAnalytics } from './hooks';
import { DesktopLayout } from './layouts/DesktopLayout';
import { MobileLayout } from './layouts/MobileLayout';

import type { ITimeRangeSelectorValue } from './components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketCategoryItem } from './types';

const useMarketHomeLayoutProps = () => {
  const { md } = useMedia();

  // Load market basic config using the new hook
  const { formattedMinLiquidity, spotCategories: apiSpotCategories } =
    useMarketBasicConfig();
  const [selectedNetworkId, setSelectedNetworkId] = useSelectedNetworkIdAtom();

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
  const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('24h');

  const [selectedCategory, setSelectedCategory] = useState('trending');

  const categories: IMarketCategoryItem[] = useMemo(() => {
    if (apiSpotCategories.length > 0) {
      return apiSpotCategories.map((c) => ({
        id: c.type,
        name: c.name,
      }));
    }
    // Fallback before API responds
    return [
      { id: 'trending', name: 'Trending' },
      { id: 'x_mentioned', name: 'X Mentioned' },
    ];
  }, [apiSpotCategories]);

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
    }),
    [md, layoutProps],
  );
};

function BaseMarketHomeLayout() {
  const { md, layoutProps } = useMarketHomeLayoutProps();

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
      <Page.Body>
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
  const { layoutProps } = useMarketHomeLayoutProps();
  // In nested outer pagers (Discovery: Market/Earn/Browser), keep Market mounted
  // and let Freeze control inactive-page performance. Unmounting here causes
  // visible flashes when the outer pager finishes settling.
  if (!isFocused && !nestedPager) {
    return null;
  }
  return (
    <MobileLayout
      {...layoutProps}
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
