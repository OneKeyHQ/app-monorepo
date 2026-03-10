import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { RefObject } from 'react';

import { Tabs, YStack, useTabContainerWidth } from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import { useFocusedTab } from '@onekeyhq/components/src/composite/Tabs/useFocusedTab';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMarketBasicConfig } from '../../hooks/useMarketBasicConfig';
import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketListColumnHeader } from '../components/MarketListColumnHeader';
import { MobileMarketPerpsFlatList } from '../components/MarketPerpsList';
import { MarketPerpsCategorySelector } from '../components/MarketPerpsList/MarketPerpsCategorySelector';
import { MobileMarketTokenFlatList } from '../components/MarketTokenList/MobileMarketTokenFlatList';
import { MobileMarketWatchlistFlatList } from '../components/MarketTokenList/MobileMarketWatchlistFlatList';

import { useMarketTabsLogic } from './hooks';

import type { ITimeRangeSelectorValue } from '../components/TimeRangeSelector';
import type { IMarketHomeTabValue } from '../types';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

interface IMobileLayoutProps {
  filterBarProps: {
    selectedNetworkId: string;
    timeRange: ITimeRangeSelectorValue;
    onNetworkIdChange: (networkId: string) => void;
    onTimeRangeChange: (timeRange: ITimeRangeSelectorValue) => void;
  };
  selectedNetworkId: string;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
  tabsRef?: RefObject<ITabContainerRef | null>;
  nestedPager?: boolean;
}

// Context for dynamic tab bar values so renderTabBar stays stable.
interface ITabBarDynamicContext {
  filterBarProps: IMobileLayoutProps['filterBarProps'];
  perpsCategories: { tabId: string; name: string }[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}

const TabBarDynamicContext = createContext<ITabBarDynamicContext | null>(null);

interface IMarketHomeTabBarProps extends TabBarProps<string> {
  watchlistTabName: string;
  spotTabName: string;
  perpsTabName: string;
}

function MarketHomeTabBar({
  watchlistTabName,
  spotTabName,
  perpsTabName,
  ...tabBarProps
}: IMarketHomeTabBarProps) {
  const focusedTab = useFocusedTab();
  const ctx = useContext(TabBarDynamicContext)!;

  return (
    <YStack bg="$bgApp">
      <Tabs.TabBar {...tabBarProps} />
      {focusedTab === watchlistTabName ? <MarketListColumnHeader /> : null}
      {focusedTab === spotTabName ? (
        <>
          <MarketFilterBarSmall {...ctx.filterBarProps} />
          <MarketListColumnHeader />
        </>
      ) : null}
      {focusedTab === perpsTabName ? (
        <>
          <MarketPerpsCategorySelector
            categories={ctx.perpsCategories}
            selectedCategoryId={ctx.selectedCategoryId}
            onSelectCategory={ctx.onSelectCategory}
            containerStyle={{
              px: '$5',
              pt: '$3',
              pb: '$2',
            }}
          />
          <MarketListColumnHeader />
        </>
      ) : null}
    </YStack>
  );
}

function MobileLayoutComponent({
  filterBarProps,
  selectedNetworkId,
  onTabChange,
  tabsRef,
  nestedPager = false,
}: IMobileLayoutProps) {
  const {
    watchlistTabName,
    spotTabName,
    perpsTabName,
    showPerpsTab,
    handleTabChange,
    selectedTab,
  } = useMarketTabsLogic(onTabChange);

  const tabBarHeight = useTabBarHeight();
  const tabContainerWidth = useTabContainerWidth() as number | undefined;

  // Perps category state (lifted from MobileMarketPerpsFlatList)
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const { perpsCategories: rawPerpsCategories } = useMarketBasicConfig();

  const perpsCategories = useMemo(
    () =>
      rawPerpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [rawPerpsCategories],
  );

  useEffect(() => {
    if (!selectedCategoryId && perpsCategories.length > 0) {
      setSelectedCategoryId(perpsCategories[0].tabId);
    }
  }, [perpsCategories, selectedCategoryId]);

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

  const listContainerProps = useMemo(() => {
    const getPaddingBottom = () => {
      if (platformEnv.isNativeIOS) {
        return 125;
      }
      if (platformEnv.isNativeAndroid) {
        return tabBarHeight + 40;
      }
      return 0;
    };

    return {
      paddingBottom: getPaddingBottom(),
    };
  }, [tabBarHeight]);

  // Stable renderTabBar — reads dynamic values from context, not props.
  const renderTabBar = useCallback(
    (tabBarProps: TabBarProps<string>) => (
      <MarketHomeTabBar
        {...tabBarProps}
        watchlistTabName={watchlistTabName}
        spotTabName={spotTabName}
        perpsTabName={perpsTabName}
      />
    ),
    [watchlistTabName, spotTabName, perpsTabName],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      handleTabChange(tabName);
    },
    [handleTabChange],
  );

  const dynamicCtx = useMemo<ITabBarDynamicContext>(
    () => ({
      filterBarProps,
      perpsCategories,
      selectedCategoryId,
      onSelectCategory: setSelectedCategoryId,
    }),
    [filterBarProps, perpsCategories, selectedCategoryId],
  );

  return (
    <TabBarDynamicContext.Provider value={dynamicCtx}>
      <Tabs.Container
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={tabsRef as any}
        width={platformEnv.isNative ? tabContainerWidth : undefined}
        renderTabBar={renderTabBar}
        initialTabName={initialTabName}
        onTabChange={onTabChangeHandler}
        useNativeHeaderAnimation={platformEnv.isNativeAndroid}
        pagerProps={
          nestedPager ? ({ nestedScrollEnabled: true } as any) : undefined
        }
        {...containerProps}
      >
        <Tabs.Tab name={watchlistTabName}>
          <MobileMarketWatchlistFlatList
            listContainerProps={listContainerProps}
          />
        </Tabs.Tab>
        <Tabs.Tab name={spotTabName}>
          <MobileMarketTokenFlatList
            networkId={selectedNetworkId}
            listContainerProps={listContainerProps}
          />
        </Tabs.Tab>
        {showPerpsTab ? (
          <Tabs.Tab name={perpsTabName}>
            <MobileMarketPerpsFlatList
              selectedCategoryId={selectedCategoryId}
              listContainerProps={listContainerProps}
            />
          </Tabs.Tab>
        ) : null}
      </Tabs.Container>
    </TabBarDynamicContext.Provider>
  );
}

export const MobileLayout = memo(MobileLayoutComponent);
