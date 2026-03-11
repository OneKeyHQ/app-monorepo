import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Tabs, YStack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBar } from '../components/MarketFilterBar';
import { MarketPerpsTokenList } from '../components/MarketPerpsList';
import { MarketNormalTokenList } from '../components/MarketTokenList/MarketNormalTokenList';
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';

import { DesktopStickyHeaderContext } from './DesktopStickyHeaderContext';
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

  // Portal target for sticky column headers.
  // List components use createPortal to render their headers into this element.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const portalRefCallback = useCallback((el: HTMLDivElement | null) => {
    setPortalTarget(el);
  }, []);

  const [activeTabName, setActiveTabName] = useState(initialTabName);

  // Ref so renderTabBar can update activeTabName immediately on press
  // without recreating the callback (which would break collapsible tab memoisation).
  const setActiveTabNameRef = useRef(setActiveTabName);
  setActiveTabNameRef.current = setActiveTabName;

  const renderTabBar = useCallback(
    (tabBarProps: TabBarProps<string>) => {
      const handleTabPress = (name: string) => {
        // Update immediately on press so the portal clears before the
        // tab-switch animation completes (onTabChange fires after animation).
        setActiveTabNameRef.current(name);
        tabBarProps.onTabPress?.(name);
      };
      // Wrap TabBar + portal target in a single sticky container.
      // Override TabBar's own sticky with position: relative so
      // the outer wrapper controls stickiness for both.
      return (
        <YStack bg="$bgApp" position={'sticky' as any} top={0} zIndex={10}>
          <Tabs.TabBar
            {...tabBarProps}
            onTabPress={handleTabPress}
            divider={false}
            containerStyle={{ position: 'relative' as any }}
          />
          <div ref={portalRefCallback} />
        </YStack>
      );
    },
    [portalRefCallback],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      setActiveTabName(tabName);
      handleTabChange(tabName);
    },
    [handleTabChange],
  );

  const listContainerProps = useMemo(() => {
    if (platformEnv.isWebDappMode) {
      return { paddingBottom: 100 };
    }
    if (platformEnv.isDesktop) {
      return { paddingBottom: 50 };
    }
    return { paddingBottom: 0 };
  }, []);

  const stickyHeaderCtx = useMemo(
    () => ({ portalTarget, activeTabName }),
    [portalTarget, activeTabName],
  );

  if (!isFocused) {
    return null;
  }

  return (
    <DesktopStickyHeaderContext.Provider value={stickyHeaderCtx}>
      <YStack flex={1}>
        <Tabs.Container
          renderTabBar={renderTabBar}
          initialTabName={initialTabName}
          onTabChange={onTabChangeHandler}
          {...containerProps}
        >
          <Tabs.Tab name={watchlistTabName}>
            <YStack px="$4" flex={1}>
              <MarketWatchlistTokenList
                tabIntegrated
                tabName={watchlistTabName}
                listContainerProps={listContainerProps}
              />
            </YStack>
          </Tabs.Tab>
          <Tabs.Tab name={spotTabName}>
            <YStack px="$4" flex={1}>
              <MarketNormalTokenList
                networkId={selectedNetworkId}
                tabIntegrated
                tabName={spotTabName}
                listContainerProps={listContainerProps}
                toolbar={<MarketFilterBar {...filterBarProps} />}
              />
            </YStack>
          </Tabs.Tab>
          {showPerpsTab ? (
            <Tabs.Tab name={perpsTabName}>
              <YStack px="$4" flex={1}>
                <MarketPerpsTokenList
                  tabIntegrated
                  tabName={perpsTabName}
                  listContainerProps={listContainerProps}
                />
              </YStack>
            </Tabs.Tab>
          ) : null}
        </Tabs.Container>
      </YStack>
    </DesktopStickyHeaderContext.Provider>
  );
}
