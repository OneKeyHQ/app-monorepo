import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Carousel,
  Tabs,
  YStack,
  useTabContainerWidth,
} from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MarketBannerList,
  useMarketBannerList,
} from '../components/MarketBanner';
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

const useIsFirstFocus = () => {
  const isFirstFocusRef = useRef(false);
  const [isFirstFocus, setIsFirstFocus] = useState(false);
  const isFocused = useRouteIsFocused();
  useEffect(() => {
    if (isFirstFocusRef.current) {
      return;
    }
    if (isFocused) {
      isFirstFocusRef.current = true;
      setIsFirstFocus(true);
    }
  }, [isFocused]);
  return isFirstFocus;
};
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

  const { bannerList } = useMarketBannerList();
  const hasBanner = Boolean(bannerList && bannerList.length > 0);

  const { height, containerStyle } = useMemo(() => {
    const bannerHeight = hasBanner ? 0 : 120;
    const computedHeight = platformEnv.isNative
      ? undefined
      : `calc(100vh - ${167 - bannerHeight}px)`;
    const style: Record<string, any> = { height: computedHeight };
    if (platformEnv.isWebDappMode || platformEnv.isDesktop) {
      style.paddingBottom = 100;
    }
    return { height: computedHeight, containerStyle: style };
  }, [hasBanner]);

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

  const isFocused = useIsFirstFocus();
  if (!isFocused) {
    return null;
  }
  return (
    <YStack>
      <MarketBannerList />
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
        containerStyle={containerStyle}
        ref={carouselRef as any}
        loop={false}
        showPagination={false}
        data={tabNames}
        renderItem={renderItem}
      />
    </YStack>
  );
}
