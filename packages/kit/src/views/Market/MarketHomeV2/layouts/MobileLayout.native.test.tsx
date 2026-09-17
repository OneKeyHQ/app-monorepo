/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import { MobileLayout } from './MobileLayout.native';

import type { IMarketFilterBarProps } from '../types';
import type {
  CollapsiblePagerViewOnNativeTabPressEvent,
  CollapsiblePagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';

type IMockPagerProps = {
  onNativeTabPress: (event: CollapsiblePagerViewOnNativeTabPressEvent) => void;
  onPageSelected: (event: CollapsiblePagerViewOnPageSelectedEvent) => void;
};

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockHandleTabChange = jest.fn();
let mockPagerProps: IMockPagerProps | undefined;

const mockSpotTabItems = [
  { categoryId: 'trending', tabName: 'Trending' },
  { categoryId: 'stocks', tabName: 'Stocks' },
  { categoryId: 'top-coins', tabName: 'Top coins' },
];
const mockTabsLogic = {
  watchlistTabName: 'Favorites',
  showWatchlistTab: true,
  spotTabItems: mockSpotTabItems,
  perpsTabName: 'Perps',
  showPerpsTab: true,
  handleTabChange: mockHandleTabChange,
  getSpotCategoryIdByTabName: (tabName: string) =>
    mockSpotTabItems.find((item) => item.tabName === tabName)?.categoryId,
  selectedTabName: 'Favorites',
  isTabSelectionInFlight: () => false,
};
const mockTheme = Object.fromEntries(
  ['bgApp', 'bgActive', 'text', 'textSubdued'].map((key) => [
    key,
    { val: '#000000' },
  ]),
);
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    CollapsiblePagerView: React.forwardRef(
      (props: IMockPagerProps, ref: React.Ref<unknown>) => {
        mockPagerProps = props;
        React.useImperativeHandle(ref, () => ({
          setPage: mockSetPage,
          setPageWithoutAnimation: mockSetPageWithoutAnimation,
        }));
        return null;
      },
    ),
  };
});
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: <T,>(value: T) => React.useRef({ value }).current,
  };
});
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
// Every @onekeyhq/components import path resolves to one jest module.
jest.mock('@onekeyhq/components', () => ({
  IconButton: () => null,
  Tabs: { TabBar: () => null },
  XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  YStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  s: (size: number) => size,
  useScrollContentTabBarOffset: () => 0,
  useTabBarHeight: () => 0,
  useTheme: () => mockTheme,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNative: true,
  isNativeIOS: true,
  isNativeAndroid: false,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    market: { navigation: { marketHomePagerSync: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ isMounted: true, data: [] }],
}));
jest.mock('./hooks', () => ({ useMarketTabsLogic: () => mockTabsLogic }));
jest.mock('../components/MarketBanner/MarketBannerList', () => ({
  MarketBannerList: () => null,
  useMarketBannerState: () => ({
    bannerList: [],
    isFetched: true,
    scope: 'test',
  }),
}));
jest.mock('../components/MarketFilterBarSmall', () => ({
  MarketFilterBarSmall: () => null,
}));
jest.mock('../components/MarketListColumnHeader', () => ({
  MarketListColumnHeader: () => null,
}));
jest.mock('../components/MarketNativeList/MobileMarketNativeLists', () => ({
  MobileMarketNativePerpsList: () => null,
  MobileMarketNativeStockList: () => null,
  MobileMarketNativeTokenList: () => null,
  MobileMarketNativeTopCoinsList: () => null,
  MobileMarketNativeWatchlist: () => null,
}));
jest.mock(
  '../components/MarketPerpsList/hooks/useSyncedMarketPerpsCategory',
  () => ({
    useSyncedMarketPerpsCategory: () => ({
      perpsCategories: [],
      selectedCategoryId: 'hot',
      handleSelectCategory: jest.fn(),
    }),
  }),
);
jest.mock('../components/MarketPerpsList/MarketPerpsCategorySelector', () => ({
  MarketPerpsCategorySelector: () => null,
}));
jest.mock(
  '../components/MarketTokenList/hooks/useMarketWatchlistTokenList',
  () => ({ useIsWatchlistTokenCacheReady: () => true }),
);
jest.mock('../components/MarketTokenList/MarketStockCategorySelector', () => ({
  MarketStockCategorySelector: () => null,
}));
jest.mock(
  '../components/MarketTokenList/MarketWatchlistCategorySelector',
  () => ({
    DEFAULT_WATCHLIST_FILTER: 'all',
    MarketWatchlistCategorySelector: () => null,
  }),
);
jest.mock(
  '../components/MarketTokenList/useOpenMarketWatchlistEditDialog',
  () => ({
    useOpenMarketWatchlistEditDialog: () => jest.fn(),
  }),
);

const filterBarProps = {
  selectedNetworkId: 'evm--1',
  timeRange: '24h',
  categories: [],
  onNetworkIdChange: jest.fn(),
  onTimeRangeChange: jest.fn(),
} as unknown as IMarketFilterBarProps;

function renderLayout() {
  render(
    <MobileLayout
      filterBarProps={filterBarProps}
      selectedNetworkId="evm--1"
      onTabChange={jest.fn()}
    />,
  );
}

function pressNativeTab(key: string) {
  act(() => {
    mockPagerProps?.onNativeTabPress({
      nativeEvent: { key, position: 0 },
    } as CollapsiblePagerViewOnNativeTabPressEvent);
  });
}

function selectNativePage(position: number) {
  act(() => {
    mockPagerProps?.onPageSelected({
      nativeEvent: { position },
    } as CollapsiblePagerViewOnPageSelectedEvent);
  });
}

describe('native market home tab presses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPagerProps = undefined;
    mockTabsLogic.selectedTabName = 'Favorites';
    // Mirror the synced tab atom echoing the selection back.
    mockHandleTabChange.mockImplementation((tabName: string) => {
      mockTabsLogic.selectedTabName = tabName;
    });
  });

  it('jumps straight to a distant tab instead of scrolling through pages', () => {
    renderLayout();

    pressNativeTab('Perps');

    expect(mockHandleTabChange).toHaveBeenCalledWith('Perps');
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(4);
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('supersedes the pager animation when the pending tab is pressed again', () => {
    renderLayout();

    pressNativeTab('Perps');
    pressNativeTab('Perps');

    expect(mockHandleTabChange).toHaveBeenCalledTimes(1);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(2);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(4);

    selectNativePage(4);
    pressNativeTab('Perps');

    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(2);
    expect(mockSetPage).not.toHaveBeenCalled();
  });
});
