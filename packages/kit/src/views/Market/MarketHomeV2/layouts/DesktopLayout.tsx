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
import { MarketPerpsTokenList } from '../components/MarketPerpsList';
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
    perpsTabName,
    focusedTab,
    carouselRef,
    handleTabChange,
    defaultIndex,
    handlePageChanged,
  } = useMarketTabsLogic(onTabChange);

  const { bannerList } = useMarketBannerList();
  const hasBanner = Boolean(bannerList && bannerList.length > 0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { height, containerStyle } = useMemo(() => {
    // Always use the height that does NOT subtract banner space.
    // When the banner is present, the outer scroll container overflows
    // by exactly the banner height, allowing it to scroll away while
    // the TabBar sticks via CSS position: sticky.
    const computedHeight = platformEnv.isNative
      ? undefined
      : `calc(100vh - 47px)`;
    const style: Record<string, any> = { height: computedHeight };

    if (platformEnv.isWebDappMode) {
      style.paddingBottom = 100;
    }

    if (platformEnv.isDesktop) {
      style.paddingBottom = 50;
    }
    return { height: computedHeight, containerStyle: style };
  }, []);

  // Wheel event handler: prioritize outer scroll (banner collapse)
  // over inner Table scroll when the banner is still visible.
  useEffect(() => {
    if (!hasBanner || platformEnv.isNative) return;

    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) return;

      // Scrolling down: collapse banner first
      if (e.deltaY > 0 && el.scrollTop < maxScroll - 1) {
        e.preventDefault();
        el.scrollTop = Math.min(el.scrollTop + e.deltaY, maxScroll);
        return;
      }

      // Scrolling up: expand banner when inner lists are at top
      if (e.deltaY < 0 && el.scrollTop > 0) {
        let target = e.target as HTMLElement | null;
        let innerCanScrollUp = false;
        while (target && target !== el) {
          if (
            target.scrollHeight > target.clientHeight + 1 &&
            target.scrollTop > 1
          ) {
            innerCanScrollUp = true;
            break;
          }
          target = target.parentElement;
        }

        if (!innerCanScrollUp) {
          e.preventDefault();
          el.scrollTop = Math.max(el.scrollTop + e.deltaY, 0);
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [hasBanner]);

  const pageWidth = useTabContainerWidth();
  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const selectedIndex = carouselRef.current?.getCurrentIndex();
      const isNotFocused = !platformEnv.isNative && selectedIndex !== index;
      if (item === watchlistTabName) {
        return (
          <YStack
            px="$4"
            height={height}
            flex={1}
            style={isNotFocused ? { contentVisibility: 'hidden' } : undefined}
          >
            <MarketWatchlistTokenList />
          </YStack>
        );
      }
      if (item === perpsTabName) {
        return (
          <YStack
            px="$4"
            height={height}
            flex={1}
            style={isNotFocused ? { contentVisibility: 'hidden' } : undefined}
          >
            <MarketPerpsTokenList />
          </YStack>
        );
      }
      return (
        <YStack
          px="$4"
          height={height}
          flex={1}
          style={isNotFocused ? { contentVisibility: 'hidden' } : undefined}
        >
          <MarketFilterBar {...filterBarProps} />
          <MarketNormalTokenList networkId={selectedNetworkId} />
        </YStack>
      );
    },
    [
      filterBarProps,
      height,
      selectedNetworkId,
      watchlistTabName,
      perpsTabName,
      carouselRef,
    ],
  );

  const isFocused = useIsFirstFocus();
  if (!isFocused) {
    return null;
  }
  return (
    <YStack
      flex={1}
      ref={scrollContainerRef as any}
      style={
        hasBanner && !platformEnv.isNative
          ? { overflowY: 'auto', scrollbarWidth: 'none' }
          : undefined
      }
    >
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
