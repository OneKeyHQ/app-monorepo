import { useCallback, useMemo } from 'react';

import { Dimensions } from 'react-native';

import {
  Carousel,
  Tabs,
  YStack,
  useSafeAreaInsets,
  useTabContainerWidth,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';

import { useMarketTabsLogic } from './hooks';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { IMarketHomeTabValue } from '../types';

interface IMobileLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
  };
  selectedNetworkId: string;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}

export function MobileLayout({
  filterBarProps,
  selectedNetworkId,
  onTabChange,
}: IMobileLayoutProps) {
  const {
    tabNames,
    watchlistTabName,
    focusedTab,
    carouselRef,
    handleTabChange,
    handlePageChanged,
    defaultIndex,
  } = useMarketTabsLogic(onTabChange);

  // Type assertion to help ESLint understand the type
  const typedFocusedTab = focusedTab;

  const { top, bottom } = useSafeAreaInsets();
  const height = useMemo(() => {
    return platformEnv.isNative
      ? Dimensions.get('window').height - top - bottom - 188
      : 'calc(100vh - 140px)';
  }, [bottom, top]);

  const onPageChanged = useCallback(
    (index: number) => {
      handlePageChanged(index);
    },
    [handlePageChanged],
  );

  const pageWidth = useTabContainerWidth();

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      if (item === watchlistTabName) {
        return (
          <YStack flex={1} height={platformEnv.isNative ? undefined : height}>
            <MarketWatchlistTokenList />
          </YStack>
        );
      }
      return (
        <YStack flex={1} height={platformEnv.isNative ? undefined : height}>
          <MarketFilterBarSmall {...filterBarProps} />
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
        focusedTab={typedFocusedTab}
      />
      <Carousel
        pagerProps={{
          scrollSensitivity: 5,
        }}
        pageWidth={pageWidth}
        defaultIndex={defaultIndex}
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
