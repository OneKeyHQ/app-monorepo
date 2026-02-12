import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Tabs, YStack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketPerpsTokenList } from '../components/MarketPerpsList';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';

import { useMarketTabsLogic } from './hooks';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { IMarketHomeTabValue } from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

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

/**
 * Wheel event handler: when the Tabs.Container outer scroll hasn't fully
 * collapsed the header, intercept wheel-down events so the banner scrolls
 * away before the inner token-list Table begins scrolling. For scroll-up,
 * re-expand the header when inner lists are at their top.
 */
function useHeaderScrollCoordination(
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (platformEnv.isNative) return;
    if (!enabled) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      const scrollEl = wrapper.querySelector(
        '.onekey-tabs-container',
      ) as HTMLElement | null;
      if (!scrollEl) return;

      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      if (maxScroll <= 0) return;

      // Scrolling down: collapse header first
      if (e.deltaY > 0 && scrollEl.scrollTop < maxScroll - 1) {
        e.preventDefault();
        e.stopPropagation();
        scrollEl.scrollTop = Math.min(
          scrollEl.scrollTop + e.deltaY,
          maxScroll,
        );
        return;
      }

      // Scrolling up: expand header when inner lists are at top
      if (e.deltaY < 0 && scrollEl.scrollTop > 0) {
        let target = e.target as HTMLElement | null;
        let innerCanScrollUp = false;
        while (target && target !== scrollEl) {
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
          e.stopPropagation();
          scrollEl.scrollTop = Math.max(scrollEl.scrollTop + e.deltaY, 0);
        }
      }
    };

    wrapper.addEventListener('wheel', handleWheel, {
      capture: true,
      passive: false,
    });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [wrapperRef, enabled]);
}

export function DesktopLayout({
  filterBarProps,
  selectedNetworkId,
  onTabChange,
}: IDesktopLayoutProps) {
  const {
    watchlistTabName,
    spotTabName,
    perpsTabName,
    showPerpsTab,
    handleTabChange,
    selectedTab,
  } = useMarketTabsLogic(onTabChange);

  const isFocused = useIsFirstFocus();

  const wrapperRef = useRef<HTMLDivElement>(null);
  useHeaderScrollCoordination(wrapperRef, isFocused);

  const initialTabName = useMemo(() => {
    if (selectedTab === 'watchlist') return watchlistTabName;
    if (selectedTab === 'perps' && showPerpsTab) return perpsTabName;
    return spotTabName;
  }, [selectedTab, watchlistTabName, spotTabName, perpsTabName, showPerpsTab]);

  const containerProps = useMemo(
    () => ({
      allowHeaderOverscroll: true,
      renderHeader: () => (
        <YStack bg="$bgApp" pointerEvents="box-none">
          <MarketBannerList />
        </YStack>
      ),
    }),
    [],
  );

  const renderTabBar = useCallback((tabBarProps: TabBarProps<string>) => {
    const handleTabPress = (name: string) => {
      tabBarProps.onTabPress?.(name);
    };
    return (
      <Tabs.TabBar
        {...tabBarProps}
        onTabPress={handleTabPress}
        divider={false}
      />
    );
  }, []);

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      handleTabChange(tabName);
    },
    [handleTabChange],
  );

  const contentHeight = useMemo(() => {
    const h = `calc(100vh - 47px)`;
    if (platformEnv.isWebDappMode) {
      return { height: h, paddingBottom: 100 };
    }
    if (platformEnv.isDesktop) {
      return { height: h, paddingBottom: 50 };
    }
    return { height: h };
  }, []);

  if (!isFocused) {
    return null;
  }

  return (
    <YStack flex={1} ref={wrapperRef as any}>
      <Tabs.Container
        renderTabBar={renderTabBar}
        initialTabName={initialTabName}
        onTabChange={onTabChangeHandler}
        {...containerProps}
      >
        <Tabs.Tab name={watchlistTabName}>
          <Tabs.ScrollView style={contentHeight}>
            <YStack px="$4" flex={1}>
              <MarketWatchlistTokenList />
            </YStack>
          </Tabs.ScrollView>
        </Tabs.Tab>
        <Tabs.Tab name={spotTabName}>
          <Tabs.ScrollView style={contentHeight}>
            <YStack px="$4" flex={1}>
              <MarketFilterBar {...filterBarProps} />
              <MarketNormalTokenList networkId={selectedNetworkId} />
            </YStack>
          </Tabs.ScrollView>
        </Tabs.Tab>
        {showPerpsTab ? (
          <Tabs.Tab name={perpsTabName}>
            <Tabs.ScrollView style={contentHeight}>
              <YStack px="$4" flex={1}>
                <MarketPerpsTokenList />
              </YStack>
            </Tabs.ScrollView>
          </Tabs.Tab>
        ) : null}
      </Tabs.Container>
    </YStack>
  );
}
