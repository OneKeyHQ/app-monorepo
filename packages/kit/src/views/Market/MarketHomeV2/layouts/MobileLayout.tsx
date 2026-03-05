import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { MarketWatchlistTokenList } from '../components/MarketTokenList/MarketWatchlistTokenList';
import { MobileMarketTokenFlatList } from '../components/MarketTokenList/MobileMarketTokenFlatList';

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
}

interface IMarketHomeTabBarProps extends TabBarProps<string> {
  watchlistTabName: string;
  spotTabName: string;
  perpsTabName: string;
  filterBarProps: IMobileLayoutProps['filterBarProps'];
  perpsCategories: { tabId: string; name: string }[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}

function MarketHomeTabBar({
  watchlistTabName,
  spotTabName,
  perpsTabName,
  filterBarProps,
  perpsCategories,
  selectedCategoryId,
  onSelectCategory,
  ...tabBarProps
}: IMarketHomeTabBarProps) {
  const focusedTab = useFocusedTab();

  return (
    <YStack bg="$bgApp">
      <Tabs.TabBar {...tabBarProps} />
      {focusedTab === watchlistTabName ? <MarketListColumnHeader /> : null}
      {focusedTab === spotTabName ? (
        <>
          <MarketFilterBarSmall {...filterBarProps} />
          <MarketListColumnHeader />
        </>
      ) : null}
      {focusedTab === perpsTabName ? (
        <>
          <MarketPerpsCategorySelector
            categories={perpsCategories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={onSelectCategory}
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

  const renderTabBar = useCallback(
    (tabBarProps: TabBarProps<string>) => (
      <MarketHomeTabBar
        {...tabBarProps}
        watchlistTabName={watchlistTabName}
        spotTabName={spotTabName}
        perpsTabName={perpsTabName}
        filterBarProps={filterBarProps}
        perpsCategories={perpsCategories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />
    ),
    [
      watchlistTabName,
      spotTabName,
      perpsTabName,
      filterBarProps,
      perpsCategories,
      selectedCategoryId,
    ],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      handleTabChange(tabName);
    },
    [handleTabChange],
  );

  return (
    <Tabs.Container
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={tabsRef as any}
      width={platformEnv.isNative ? tabContainerWidth : undefined}
      renderTabBar={renderTabBar}
      initialTabName={initialTabName}
      onTabChange={onTabChangeHandler}
      {...containerProps}
    >
      <Tabs.Tab name={watchlistTabName}>
        <MarketWatchlistTokenList
          tabIntegrated
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
  );
}

export const MobileLayout = memo(MobileLayoutComponent);
