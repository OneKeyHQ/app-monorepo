import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';

import {
  IconButton,
  Tabs,
  XStack,
  YStack,
  useTabContainerWidth,
} from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import { useTabBarHeight } from '@onekeyhq/components/src/layouts/Page/hooks';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMarketBasicConfig } from '../../hooks/useMarketBasicConfig';
import { MarketBannerList } from '../components/MarketBanner';
import { MarketFilterBarSmall } from '../components/MarketFilterBarSmall';
import { MarketListColumnHeader } from '../components/MarketListColumnHeader';
import { MobileMarketPerpsFlatList } from '../components/MarketPerpsList';
import { MarketPerpsCategorySelector } from '../components/MarketPerpsList/MarketPerpsCategorySelector';
import {
  type IWatchlistFilterType,
  MarketWatchlistCategorySelector,
} from '../components/MarketTokenList/MarketWatchlistCategorySelector';
import { MobileMarketTokenFlatList } from '../components/MarketTokenList/MobileMarketTokenFlatList';
import { MobileMarketWatchlistFlatList } from '../components/MarketTokenList/MobileMarketWatchlistFlatList';
import { useOpenMarketWatchlistEditDialog } from '../components/MarketTokenList/useOpenMarketWatchlistEditDialog';

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
  watchlistFilter: IWatchlistFilterType;
  onSelectWatchlistFilter: (filter: IWatchlistFilterType) => void;
  isWatchlistEmpty: boolean;
  onEditWatchlist: () => void;
  perpsCategories: { tabId: string; name: string }[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  activeTabName: string;
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
  const ctx = useContext(TabBarDynamicContext)!;
  const { activeTabName } = ctx;
  const currentFocusedTabName = activeTabName || tabBarProps.tabNames[0] || '';

  // Watchlist sub-header: conditional rendering (hidden when empty).
  // Spot & Perps sub-headers: display toggling keeps both mounted across
  // tab switches — avoids remount flicker and loading re-trigger for the
  // network selector and perps category selector.
  const isSpotOrPerps =
    currentFocusedTabName === spotTabName ||
    currentFocusedTabName === perpsTabName;

  return (
    <YStack bg="$bgApp" position={'sticky' as any} top={0} zIndex={10}>
      <Tabs.TabBar
        {...tabBarProps}
        containerStyle={{ position: 'relative' as any }}
      />
      {currentFocusedTabName === watchlistTabName && !ctx.isWatchlistEmpty ? (
        <>
          <XStack alignItems="center" pr="$3">
            <XStack flex={1}>
              <MarketWatchlistCategorySelector
                selectedFilter={ctx.watchlistFilter}
                onSelectFilter={ctx.onSelectWatchlistFilter}
                containerStyle={{
                  px: '$5',
                  pt: '$3',
                  pb: '$2',
                }}
              />
            </XStack>
            <IconButton
              icon="PencilOutline"
              size="small"
              variant="tertiary"
              onPress={ctx.onEditWatchlist}
            />
          </XStack>
          <MarketListColumnHeader />
        </>
      ) : null}
      <YStack
        display={
          isSpotOrPerps && currentFocusedTabName === spotTabName
            ? 'flex'
            : 'none'
        }
      >
        <MarketFilterBarSmall {...ctx.filterBarProps} />
        <MarketListColumnHeader />
      </YStack>
      <YStack
        display={
          isSpotOrPerps && currentFocusedTabName === perpsTabName
            ? 'flex'
            : 'none'
        }
      >
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
      </YStack>
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
  const openMarketWatchlistEditDialog = useOpenMarketWatchlistEditDialog();
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

  // Watchlist state — used to hide category selector when empty
  const [watchlistState] = useMarketWatchListV2Atom();
  const isWatchlistEmpty =
    !watchlistState.data || watchlistState.data.length === 0;

  // Watchlist category filter state
  const [watchlistFilter, setWatchlistFilter] =
    useState<IWatchlistFilterType>('all');

  // Perps category state (lifted from MobileMarketPerpsFlatList)
  const { perpsCategories: rawPerpsCategories } = useMarketBasicConfig();

  const perpsCategories = useMemo(
    () =>
      rawPerpsCategories.map((c) => ({
        tabId: c.categoryId,
        name: c.name,
      })),
    [rawPerpsCategories],
  );

  const initialCategoryId = useMemo(
    () => perpsCategories[0]?.tabId ?? '',
    [perpsCategories],
  );
  const [selectedCategoryId, setSelectedCategoryId] =
    useState(initialCategoryId);

  useEffect(() => {
    if (!selectedCategoryId && initialCategoryId) {
      setSelectedCategoryId(initialCategoryId);
    }
  }, [initialCategoryId, selectedCategoryId]);

  const initialTabName = useMemo(() => {
    if (selectedTab === 'watchlist') return watchlistTabName;
    if (selectedTab === 'perps' && showPerpsTab) return perpsTabName;
    return spotTabName;
  }, [selectedTab, watchlistTabName, spotTabName, perpsTabName, showPerpsTab]);
  const [activeTabName, setActiveTabName] = useState(initialTabName);

  const setActiveTabNameRef = useRef(setActiveTabName);
  setActiveTabNameRef.current = setActiveTabName;

  useEffect(() => {
    setActiveTabName(initialTabName);
  }, [initialTabName]);

  const containerProps = useMemo(
    () => ({
      allowHeaderOverscroll: true,
      // NOTE: renderHeader must never return a 0-height tree after it had
      // a positive height, because react-native-collapsible-tab-view's
      // useLayoutHeight guard ignores 0-height re-layouts once a positive
      // height has been measured. Wrapping in a YStack with minHeight={1}
      // ensures the layout callback always fires with height >= 1 so the
      // library re-measures correctly when the banner disappears.
      renderHeader: () => (
        <YStack bg="$bgApp" pointerEvents="box-none" minHeight={1}>
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
    (tabBarProps: TabBarProps<string>) => {
      const handleTabPress = (name: string) => {
        setActiveTabNameRef.current(name);
        tabBarProps.onTabPress?.(name);
      };

      return (
        <MarketHomeTabBar
          {...tabBarProps}
          onTabPress={handleTabPress}
          watchlistTabName={watchlistTabName}
          spotTabName={spotTabName}
          perpsTabName={perpsTabName}
        />
      );
    },
    [watchlistTabName, spotTabName, perpsTabName],
  );

  const onTabChangeHandler = useCallback(
    ({ tabName }: { tabName: string }) => {
      setActiveTabName(tabName);
      handleTabChange(tabName);
    },
    [handleTabChange],
  );
  const dynamicCtx = useMemo<ITabBarDynamicContext>(
    () => ({
      filterBarProps,
      watchlistFilter,
      onSelectWatchlistFilter: setWatchlistFilter,
      isWatchlistEmpty,
      onEditWatchlist: openMarketWatchlistEditDialog,
      perpsCategories,
      selectedCategoryId,
      onSelectCategory: setSelectedCategoryId,
      activeTabName,
    }),
    [
      filterBarProps,
      watchlistFilter,
      isWatchlistEmpty,
      openMarketWatchlistEditDialog,
      perpsCategories,
      selectedCategoryId,
      activeTabName,
    ],
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
        useNativeHeaderAnimation={
          platformEnv.isNativeAndroid ? !nestedPager : false
        }
        pagerProps={
          nestedPager ? ({ nestedScrollEnabled: true } as any) : undefined
        }
        {...containerProps}
      >
        <Tabs.Tab name={watchlistTabName}>
          <MobileMarketWatchlistFlatList
            selectedFilter={watchlistFilter}
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
