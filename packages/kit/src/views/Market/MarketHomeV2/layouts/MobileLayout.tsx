import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Dimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useDebouncedCallback } from 'use-debounce';

import {
  Carousel,
  Tabs,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { ICarouselInstance } from '@onekeyhq/components';
import {
  useMarketWatchListV2Atom,
  useSelectedMarketTabAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketTokenList } from '../components/MarketTokenList';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from '../types';

interface IMobileLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    liquidityFilter: ILiquidityFilter;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
    onLiquidityFilterChange: (filter: ILiquidityFilter) => void;
  };
  selectedNetworkId: string;
  liquidityFilter: ILiquidityFilter;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

export function MobileLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  onTabChange,
}: IMobileLayoutProps) {
  const intl = useIntl();
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlist = useMemo(
    () => watchlistState.data || [],
    [watchlistState.data],
  );
  const [selectedTab, setSelectedTab] = useSelectedMarketTabAtom();

  const watchlistTabName = intl.formatMessage({
    id: ETranslations.global_watchlist,
  });
  const trendingTabName = intl.formatMessage({
    id: ETranslations.market_trending,
  });

  const carouselRef = useRef<ICarouselInstance>(null);
  const tabNames = useMemo(() => {
    return [watchlistTabName, trendingTabName];
  }, [watchlistTabName, trendingTabName]);

  const focusedTab = useSharedValue(tabNames[0]);

  const handleTabChange = useDebouncedCallback((tabName: string) => {
    setSelectedTab(tabName as IMarketHomeTabValue);
    onTabChange(tabName as IMarketHomeTabValue);
    focusedTab.value = tabName;
    carouselRef.current?.scrollTo({ index: tabNames.indexOf(tabName) });
  }, 100);

  const { top, bottom } = useSafeAreaInsets();
  const height = useMemo(() => {
    return platformEnv.isNative
      ? Dimensions.get('window').height - top - bottom - 188
      : 'calc(100vh - 140px)';
  }, [bottom, top]);

  const onPageChanged = useCallback(
    (index: number) => {
      focusedTab.value = tabNames[index];
    },
    [focusedTab, tabNames],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      if (item === watchlistTabName) {
        return (
          <YStack flex={1} height={height}>
            <MarketTokenList
              networkId={selectedNetworkId}
              liquidityFilter={liquidityFilter}
              showWatchlistOnly
              watchlist={watchlist}
            />
          </YStack>
        );
      }
      return (
        <YStack flex={1} height={height}>
          <MarketFilterBarSmall {...filterBarProps} />
          <MarketTokenList
            networkId={selectedNetworkId}
            liquidityFilter={liquidityFilter}
            showWatchlistOnly={false}
            watchlist={watchlist}
          />
        </YStack>
      );
    },
    [
      filterBarProps,
      height,
      liquidityFilter,
      selectedNetworkId,
      watchlist,
      watchlistTabName,
    ],
  );

  return (
    <YStack>
      <Tabs.TabBar
        divider={false}
        onTabPress={handleTabChange}
        tabNames={tabNames}
        focusedTab={focusedTab}
      />
      <Carousel
        pagerProps={{
          scrollSensitivity: 5,
        }}
        containerStyle={{ height }}
        ref={carouselRef as any}
        onPageChanged={onPageChanged}
        loop={false}
        showPagination={false}
        data={tabNames}
        renderItem={renderItem}
      />
    </YStack>
  );
}
