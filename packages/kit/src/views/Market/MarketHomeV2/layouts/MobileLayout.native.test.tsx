/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import type {
  IMarketHomePreferences,
  IMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MobileLayout } from './MobileLayout.native';

import type { IMarketCategoryItem, IMarketFilterBarProps } from '../types';
import type {
  CollapsiblePagerNativeSubHeaderConfig,
  CollapsiblePagerViewOnNativeSubHeaderPressEvent,
  CollapsiblePagerViewOnNativeTabPressEvent,
} from 'react-native-pager-view';

type IMockPagerProps = {
  children?: ReactNode;
  stickyHeader?: ReactNode;
  initialPage?: number;
  nativeTabPressAnimationEnabled?: boolean;
  nativeSubHeader?: CollapsiblePagerNativeSubHeaderConfig;
  onNativeSubHeaderPress?: (
    event: CollapsiblePagerViewOnNativeSubHeaderPressEvent,
  ) => void;
  onNativeTabPress: (event: CollapsiblePagerViewOnNativeTabPressEvent) => void;
};

type IMockCategorySelectorProps = {
  categories: IMarketCategoryItem[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
};

const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockHandleTabChange = jest.fn();
let mockPagerProps: IMockPagerProps | undefined;
let mockCategorySelectorProps: IMockCategorySelectorProps | undefined;
let mockSelection: IMarketSelectedTabAtom;
let mockPreferences: IMarketHomePreferences;
const mockSelectionListeners = new Set<() => void>();
const mockSetPreferences = jest.fn(
  (update: (prev: IMarketHomePreferences) => IMarketHomePreferences) => {
    mockPreferences = update(mockPreferences);
    mockSelectionListeners.forEach((listener) => listener());
  },
);
const mockNativeSelections = {
  watchlist: '',
  stocks: '',
  topCoins: '',
};

const mockSpotTabItems = [
  { categoryId: 'trending', tabName: 'Trending' },
  { categoryId: 'stocks', tabName: 'Stocks' },
  { categoryId: MARKET_TOP_COINS_CATEGORY_ID, tabName: 'Top coins' },
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
        return (
          <div>
            {props.stickyHeader}
            {props.children}
          </div>
        );
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
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useMarketSelectedTabAtom: () => [mockSelection],
    useMarketHomePreferencesAtom: () => [
      React.useSyncExternalStore(
        (listener) => {
          mockSelectionListeners.add(listener);
          return () => mockSelectionListeners.delete(listener);
        },
        () => mockPreferences,
      ),
      mockSetPreferences,
    ],
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  serviceMarketV2: { updateMarketHomePreferences: jest.fn() },
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
  MobileMarketNativeStockList: ({
    selectedCategoryId,
  }: {
    selectedCategoryId: string;
  }) => {
    mockNativeSelections.stocks = selectedCategoryId;
    return null;
  },
  MobileMarketNativeTokenList: () => null,
  MobileMarketNativeTopCoinsList: ({
    selectedCategoryId,
  }: {
    selectedCategoryId: string;
  }) => {
    mockNativeSelections.topCoins = selectedCategoryId;
    return null;
  },
  MobileMarketNativeWatchlist: ({
    selectedFilter,
  }: {
    selectedFilter: string;
  }) => {
    mockNativeSelections.watchlist = selectedFilter;
    return null;
  },
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
  MarketStockCategorySelector: (props: IMockCategorySelectorProps) => {
    mockCategorySelectorProps = props;
    return null;
  },
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
} satisfies IMarketFilterBarProps;

const stockCategories: IMarketCategoryItem[] = [
  { id: 'all', name: 'All' },
  { id: 'ai-tech', name: 'AI Tech' },
  { id: 'consumer-tech', name: 'Consumer Tech' },
];
const topCoinsCategories: IMarketCategoryItem[] = [
  { id: 'all', name: 'All' },
  { id: 'chains', name: 'L1/L2' },
  { id: 'defi', name: 'DeFi & Infra' },
];
const categoryFilterBarProps: IMarketFilterBarProps = {
  ...filterBarProps,
  categories: mockSpotTabItems.map((item) => ({
    id: item.categoryId,
    name: item.tabName,
  })),
  stockCategories,
  topCoinsCategories,
  isCategoryConfigLoading: false,
};

function renderLayout(props: IMarketFilterBarProps = filterBarProps) {
  return render(
    <MobileLayout
      filterBarProps={props}
      selectedNetworkId="evm--1"
      onTabChange={jest.fn()}
    />,
  );
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockPagerProps = undefined;
  mockCategorySelectorProps = undefined;
  mockSelection = { tab: 'trending' };
  mockPreferences = {};
  mockTabsLogic.selectedTabName = 'Favorites';
  mockHandleTabChange.mockImplementation((tabName: string) => {
    mockTabsLogic.selectedTabName = tabName;
  });
});

function pressNativeTab(key: string) {
  act(() => {
    mockPagerProps?.onNativeTabPress({
      nativeEvent: { key, position: 0 },
    } as CollapsiblePagerViewOnNativeTabPressEvent);
  });
}

describe('native market home tab presses', () => {
  it('jumps straight to a distant tab instead of scrolling through pages', () => {
    renderLayout();

    pressNativeTab('Perps');

    expect(mockHandleTabChange).toHaveBeenCalledWith('Perps');
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(4);
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('stops the pager from animating its own native tab press command', () => {
    renderLayout();

    expect(mockPagerProps?.nativeTabPressAnimationEnabled).toBe(false);

    pressNativeTab('Perps');
    pressNativeTab('Perps');

    expect(mockHandleTabChange).toHaveBeenCalledTimes(1);
    expect(mockSetPageWithoutAnimation).toHaveBeenCalledTimes(1);
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockPagerProps?.nativeTabPressAnimationEnabled).toBe(false);
  });
});

describe('native market home selection restoration', () => {
  beforeEach(() => {
    mockSelection = {
      tab: 'trending',
      selectedStockCategory: 'ai-tech',
      selectedTopCoinsCategory: 'defi',
      watchlistFilter: 'stocks',
    };
    mockTabsLogic.selectedTabName = 'Stocks';
  });

  it('restores the iOS native category highlight and the matching list filters', () => {
    renderLayout(categoryFilterBarProps);

    expect(mockPagerProps?.initialPage).toBe(2);
    expect(mockPagerProps?.nativeSubHeader?.selectedKey).toBe('ai-tech');
    expect(mockNativeSelections).toEqual({
      stocks: 'ai-tech',
      topCoins: 'defi',
      watchlist: 'stocks',
    });
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });

  it('persists native chip presses and restores both categories after leaving the page', () => {
    const first = renderLayout(categoryFilterBarProps);
    act(() => {
      mockPagerProps?.onNativeSubHeaderPress?.({
        nativeEvent: { key: 'consumer-tech', position: 2 },
      } as CollapsiblePagerViewOnNativeSubHeaderPressEvent);
    });
    expect(mockPagerProps?.nativeSubHeader?.selectedKey).toBe('consumer-tech');

    pressNativeTab('Top coins');
    expect(mockPagerProps?.nativeSubHeader?.selectedKey).toBe('defi');
    act(() => {
      mockPagerProps?.onNativeSubHeaderPress?.({
        nativeEvent: { key: 'chains', position: 1 },
      } as CollapsiblePagerViewOnNativeSubHeaderPressEvent);
    });
    first.unmount();

    renderLayout(categoryFilterBarProps);
    expect(mockPagerProps?.nativeSubHeader?.selectedKey).toBe('chains');
    expect(mockNativeSelections).toEqual({
      stocks: 'consumer-tech',
      topCoins: 'chains',
      watchlist: 'stocks',
    });
  });

  it('restores the saved iOS chip once the category config arrives', () => {
    const view = renderLayout({
      ...categoryFilterBarProps,
      stockCategories: [],
      isCategoryConfigLoading: true,
    });
    expect(mockPagerProps?.nativeSubHeader).toBeUndefined();
    expect(mockNativeSelections.stocks).toBe('ai-tech');

    view.rerender(
      <MobileLayout
        filterBarProps={categoryFilterBarProps}
        selectedNetworkId="evm--1"
        onTabChange={jest.fn()}
      />,
    );
    expect(mockPagerProps?.nativeSubHeader?.selectedKey).toBe('ai-tech');
    expect(mockSetPreferences).not.toHaveBeenCalled();
  });

  it('restores and persists the Android JS category selector', () => {
    jest.replaceProperty(platformEnv, 'isNativeIOS', false);
    jest.replaceProperty(platformEnv, 'isNativeAndroid', true);
    const first = renderLayout(categoryFilterBarProps);

    expect(mockPagerProps?.nativeSubHeader).toBeUndefined();
    expect(mockCategorySelectorProps?.selectedCategoryId).toBe('ai-tech');
    act(() => mockCategorySelectorProps?.onSelectCategory('consumer-tech'));
    expect(mockNativeSelections.stocks).toBe('consumer-tech');
    first.unmount();

    renderLayout(categoryFilterBarProps);
    expect(mockCategorySelectorProps?.selectedCategoryId).toBe('consumer-tech');
    expect(mockNativeSelections.stocks).toBe('consumer-tech');
    expect(mockSelection.selectedTopCoinsCategory).toBe('defi');
  });
});
