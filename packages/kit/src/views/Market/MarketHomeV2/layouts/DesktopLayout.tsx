import { useCallback, useMemo } from 'react';

import {
  Carousel,
  Tabs,
  YStack,
  useTabContainerWidth,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';

import { useMarketTabsLogic } from './hooks';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { IMarketHomeTabValue } from '../types';

interface IDesktopLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
  };
  selectedNetworkId: string;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  onTabChange,
}: IDesktopLayoutProps) {
  const {
    tabNames,
    watchlistTabName,
    focusedTab,
    carouselRef,
    handleTabChange,
    defaultIndex,
    handlePageChanged,
  } = useMarketTabsLogic(onTabChange);

  const height = useMemo(() => {
    return platformEnv.isNative ? undefined : 'calc(100vh - 96px)';
  }, []);

  const pageWidth = useTabContainerWidth();
  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      if (item === watchlistTabName) {
        return (
          <YStack px="$4" height={height} flex={1}>
            <MarketWatchlistTokenList />
          </YStack>
        );
      }
      return (
        <YStack px="$4" height={height} flex={1}>
          <MarketFilterBar {...filterBarProps} />
          <MarketNormalTokenList networkId={selectedNetworkId} />
        </YStack>
      );
    },
    [filterBarProps, height, selectedNetworkId, watchlistTabName],
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
        pageWidth={pageWidth}
        defaultIndex={defaultIndex}
        onPageChanged={handlePageChanged}
        disableAnimation
        containerStyle={{ height }}
        ref={carouselRef as any}
        loop={false}
        showPagination={false}
        data={tabNames}
        renderItem={renderItem}
      />
    </YStack>
  );
}
