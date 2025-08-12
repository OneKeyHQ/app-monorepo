import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import { Carousel, ICarouselInstance, Stack, Tabs, YStack } from '@onekeyhq/components';
import {
  useMarketWatchListV2Atom,
  useSelectedMarketTabAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketTokenList } from '../components/MarketTokenList';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { ILiquidityFilter, IMarketHomeTabValue } from '../types';

interface IDesktopLayoutProps {
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

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  liquidityFilter,
  onTabChange,
}: IDesktopLayoutProps) {
  const intl = useIntl();
  const [watchlistState] = useMarketWatchListV2Atom();
  const watchlist = watchlistState.data || [];
  const [selectedTab, setSelectedTab] = useSelectedMarketTabAtom();

  const watchlistTabName = intl.formatMessage({
    id: ETranslations.global_watchlist,
  });
  const trendingTabName = intl.formatMessage({
    id: ETranslations.market_trending,
  });

  // return (
  //   <Stack flex={1} height="100%">
  //     <Tabs.Container
  //       initialTabName={
  //         selectedTab === 'watchlist' ? watchlistTabName : trendingTabName
  //       }
  //       headerContainerStyle={{
  //         borderBottomWidth: 0,
  //         width: '100%',
  //         shadowColor: 'transparent',
  //       }}
  //       onTabChange={(data: { tabName: string }) => {
  //         const tabValue =
  //           data.tabName === watchlistTabName ? 'watchlist' : 'trending';
  //         setSelectedTab(tabValue);
  //         onTabChange(tabValue);
  //       }}
  //     >
  //       <Tabs.Tab name={watchlistTabName}>
  //         <Tabs.ScrollView>
  //           <Stack px="$4" flex={1}>
  //             <MarketTokenList
  //               networkId={selectedNetworkId}
  //               liquidityFilter={liquidityFilter}
  //               showWatchlistOnly
  //               watchlist={watchlist}
  //             />
  //           </Stack>
  //         </Tabs.ScrollView>
  //       </Tabs.Tab>

  //       <Tabs.Tab name={trendingTabName}>
  //         <Tabs.ScrollView>
  //           <Stack px="$4">
  //             <MarketFilterBar {...filterBarProps} />
  //             <MarketTokenList
  //               networkId={selectedNetworkId}
  //               liquidityFilter={liquidityFilter}
  //               showWatchlistOnly={false}
  //               watchlist={watchlist}
  //             />
  //           </Stack>
  //         </Tabs.ScrollView>
  //       </Tabs.Tab>
  //     </Tabs.Container>
  //   </Stack>
  // );

  const carouselRef = useRef<ICarouselInstance>(null);
  const tabNames = useMemo(() => {
    return [watchlistTabName, trendingTabName];
  }, [watchlistTabName, trendingTabName]);

  const focusedTab = useSharedValue(tabNames[0]);

  const handleTabChange = useCallback(
    (tabName: string) => {
      focusedTab.value = tabName;
      carouselRef.current?.scrollTo({ index: tabNames.indexOf(tabName) });
    },
    [focusedTab, tabNames],
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
        ref={carouselRef}
        loop={false}
        data={tabNames}
        containerStyle={{ height: 800 }}
        renderItem={({ index }) => (
          <YStack bg={index === 0 ? 'red' : 'blue'} flex={1} />
        )}
      />
    </YStack>
  );
}
