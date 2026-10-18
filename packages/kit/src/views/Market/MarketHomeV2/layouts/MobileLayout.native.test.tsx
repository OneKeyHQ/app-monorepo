/** @jest-environment jsdom */

import { createRef } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import type { IAppPagerRef } from '@onekeyhq/kit/src/components/AppPager/types';
import type {
  IMarketHomePreferences,
  IMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { buildMarketNativeSnapshot } from '../components/MarketNativeList/marketNativeListRows';

import { MobileLayout } from './MobileLayout.native';

import type { IMarketNativeListPresentation } from '../components/MarketNativeList/marketNativeListRows';
import type { IMarketCategoryItem, IMarketFilterBarProps } from '../types';
import type {
  CollapsiblePagerNativeSubHeaderConfig,
  CollapsiblePagerViewOnNativeSubHeaderPressEvent,
  CollapsiblePagerViewOnNativeTabPressEvent,
} from 'react-native-pager-view';

type IMockLayoutEvent = { nativeEvent: { layout: { height: number } } };
type IMockListContainerProps = {
  paddingBottom: number;
  emptyContentHeight?: number;
};

type IMockPagerProps = {
  children?: ReactNode;
  stickyHeader?: ReactNode;
  initialPage?: number;
  onLayout?: (event: IMockLayoutEvent) => void;
  externalTopOverlayTag?: number;
  topScrollEdgeEffect?: 'hard' | 'soft';
  onScrollEdgeCapability?: (event: {
    nativeEvent: { available: boolean };
  }) => void;
  nativeTabPressAnimationEnabled?: boolean;
  nativeSubHeader?: CollapsiblePagerNativeSubHeaderConfig;
  onNativeSubHeaderPress?: (
    event: CollapsiblePagerViewOnNativeSubHeaderPressEvent,
  ) => void;
  onPageSelected?: (event: { nativeEvent: { position: number } }) => void;
  onPageScrollStateChanged?: (event: {
    nativeEvent: { pageScrollState: 'dragging' | 'idle' };
  }) => void;
  onNativeTabPress: (event: CollapsiblePagerViewOnNativeTabPressEvent) => void;
};

type IMockCategorySelectorProps = {
  categories: IMarketCategoryItem[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
};

const mockInsetCommits: { padding: string | null | undefined; tag?: number }[] =
  [];
let mockStickyHeaderLayout: ((event: IMockLayoutEvent) => void) | undefined;
let mockListContainerProps: IMockListContainerProps | undefined;
const mockSetPage = jest.fn();
const mockSetPageWithoutAnimation = jest.fn();
const mockHandleTabChange = jest.fn();
let mockSelectionInFlight = false;
let mockUseRealTabsLogic = false;
let mockPerpDisabled = false;
const mockSetSelectedTab = jest.fn();
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
  isTabSelectionInFlight: () => mockSelectionInFlight,
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
    ScrollEdgeEffect: { Hard: 'hard', Soft: 'soft' },
    CollapsiblePagerView: React.forwardRef(
      (props: IMockPagerProps, ref: React.Ref<unknown>) => {
        mockPagerProps = props;
        const hostRef = React.useRef<HTMLDivElement>(null);
        React.useLayoutEffect(() => {
          mockInsetCommits.push({
            padding:
              hostRef.current?.parentElement?.getAttribute('data-padding-top'),
            tag: props.externalTopOverlayTag,
          });
        });
        React.useImperativeHandle(ref, () => ({
          setPage: mockSetPage,
          setPageWithoutAnimation: mockSetPageWithoutAnimation,
        }));
        return (
          <div ref={hostRef}>
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
  YStack: ({
    children,
    pt,
    onLayout,
  }: PropsWithChildren<{
    pt?: number;
    onLayout?: (event: IMockLayoutEvent) => void;
  }>) => {
    if (onLayout) mockStickyHeaderLayout = onLayout;
    return <div data-padding-top={pt}>{children}</div>;
  },
  s: (size: number) => size,
  useScrollContentTabBarOffset: () => 0,
  useTabBarHeight: () => 0,
  useTheme: () => mockTheme,
  useThemeName: () => 'light',
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNative: true,
  isNativeIOS: true,
  isNativeAndroid: false,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useMarketSelectedTabAtom: () => [mockSelection, mockSetSelectedTab],
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
jest.mock('./hooks', () => ({
  useMarketTabsLogic: (
    ...args: Parameters<
      typeof import('./hooks/useMarketTabsLogic').useMarketTabsLogic
    >
  ) =>
    mockUseRealTabsLogic
      ? jest
          .requireActual<typeof import('./hooks/useMarketTabsLogic')>(
            './hooks/useMarketTabsLogic',
          )
          .useMarketTabsLogic(...args)
      : mockTabsLogic,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => ({ perpDisabled: mockPerpDisabled }),
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'normal' } }),
  },
}));
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
  MobileMarketNativeTokenList: ({
    listContainerProps,
  }: {
    listContainerProps: IMockListContainerProps;
  }) => {
    mockListContainerProps = listContainerProps;
    return null;
  },
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
  mockInsetCommits.length = 0;
  mockPagerProps = undefined;
  mockStickyHeaderLayout = undefined;
  mockListContainerProps = undefined;
  mockCategorySelectorProps = undefined;
  mockSelection = { tab: 'trending' };
  mockPreferences = {};
  mockSelectionInFlight = false;
  mockUseRealTabsLogic = false;
  mockPerpDisabled = false;
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
  it('commits a press immediately and ignores stale non-drag selection callbacks', () => {
    const tabsRef = createRef<IAppPagerRef>();
    render(
      <MobileLayout
        filterBarProps={filterBarProps}
        selectedNetworkId="evm--1"
        onTabChange={jest.fn()}
        tabsRef={tabsRef}
      />,
    );
    pressNativeTab('Perps');
    expect(tabsRef.current?.getFocusedTab()).toBe('Perps');
    act(() =>
      mockPagerProps?.onPageSelected?.({ nativeEvent: { position: 0 } }),
    );
    expect(tabsRef.current?.getFocusedTab()).toBe('Perps');
    expect(mockHandleTabChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the local command during an in-flight stale atom sync', () => {
    const tabsRef = createRef<IAppPagerRef>();
    render(
      <MobileLayout
        filterBarProps={filterBarProps}
        selectedNetworkId="evm--1"
        onTabChange={jest.fn()}
        tabsRef={tabsRef}
      />,
    );
    mockSelectionInFlight = true;
    mockHandleTabChange.mockImplementation(() => {});
    pressNativeTab('Perps');
    act(() => tabsRef.current?.syncCurrentPage());
    expect(tabsRef.current?.getCurrentIndex()).toBe(4);
    expect(mockSetPageWithoutAnimation).toHaveBeenLastCalledWith(4);
    expect(mockHandleTabChange).toHaveBeenCalledTimes(1);
  });

  it('accepts a real dragging selection and notifies the domain once', () => {
    const tabsRef = createRef<IAppPagerRef>();
    render(
      <MobileLayout
        filterBarProps={filterBarProps}
        selectedNetworkId="evm--1"
        onTabChange={jest.fn()}
        tabsRef={tabsRef}
      />,
    );
    act(() => {
      mockPagerProps?.onPageScrollStateChanged?.({
        nativeEvent: { pageScrollState: 'dragging' },
      });
      mockPagerProps?.onPageSelected?.({ nativeEvent: { position: 1 } });
      mockPagerProps?.onPageScrollStateChanged?.({
        nativeEvent: { pageScrollState: 'idle' },
      });
    });
    expect(tabsRef.current?.getCurrentIndex()).toBe(1);
    expect(mockHandleTabChange).toHaveBeenCalledTimes(1);
    expect(mockHandleTabChange).toHaveBeenCalledWith('Trending');
  });

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

describe('external header inset ownership', () => {
  it('reserves one header inset until native confirms support and on revocation', () => {
    const { container, rerender } = render(
      <MobileLayout
        filterBarProps={filterBarProps}
        selectedNetworkId="evm--1"
        onTabChange={jest.fn()}
        externalTopOverlayTag={123}
        externalTopOverlayHeight={96}
      />,
    );
    const padding = () =>
      container.firstElementChild?.getAttribute('data-padding-top');
    expect(padding()).toBe('96');
    expect(mockPagerProps?.externalTopOverlayTag).toBeUndefined();
    act(() =>
      mockPagerProps?.onScrollEdgeCapability?.({
        nativeEvent: { available: false },
      }),
    );
    expect(padding()).toBe('96');
    rerender(
      <MobileLayout
        filterBarProps={filterBarProps}
        selectedNetworkId="evm--1"
        onTabChange={jest.fn()}
        externalTopOverlayTag={123}
        externalTopOverlayHeight={104}
      />,
    );
    expect(padding()).toBe('104');
    act(() =>
      mockPagerProps?.onScrollEdgeCapability?.({
        nativeEvent: { available: true },
      }),
    );
    expect(padding()).toBe('0');
    expect(mockPagerProps?.externalTopOverlayTag).toBe(123);
    expect(mockPagerProps?.topScrollEdgeEffect).toBe('hard');
    act(() =>
      mockPagerProps?.onScrollEdgeCapability?.({
        nativeEvent: { available: false },
      }),
    );
    expect(padding()).toBe('104');
    expect(mockPagerProps?.externalTopOverlayTag).toBeUndefined();
    expect(mockPagerProps?.topScrollEdgeEffect).toBeUndefined();
    expect(mockInsetCommits.length).toBeGreaterThanOrEqual(4);
    for (const commit of mockInsetCommits) {
      expect(commit).toEqual(
        commit.tag === 123
          ? { padding: '0', tag: 123 }
          : { padding: expect.stringMatching(/^(96|104)$/), tag: undefined },
      );
    }
  });
});

const mockPresentation: IMarketNativeListPresentation = {
  theme: {
    background: '#000000',
    rowBackground: '#000000',
    rowSelectedBackground: '#111111',
    rowPressedBackground: '#111111',
    subduedBackground: '#222222',
    strongBackground: '#333333',
    primaryText: '#ffffff',
    secondaryText: '#aaaaaa',
    disabledText: '#777777',
    icon: '#ffffff',
    iconSubdued: '#aaaaaa',
    separator: '#444444',
    accent: '#00ff00',
    positive: '#00ff00',
    negative: '#ff0000',
    criticalBackground: '#ff0000',
    inverseBackground: '#ffffff',
    inverseText: '#000000',
    info: '#0000ff',
  },
  communityRecognizedAccessibilityLabel: 'Community recognized',
  leverageAccessibilityLabel: 'Leverage',
  providerAccessibilityLabel: 'Provider',
  positiveBackground: '#008000',
  negativeBackground: '#800000',
  neutralBackground: '#666666',
  infoBackground: '#001144',
  infoText: '#66aaff',
  tokenBackground: '#ffffff2c',
  tokenBorderColor: '#ffffff09',
};

function readEmptySnapshot(failed: boolean) {
  if (!mockListContainerProps)
    throw new OneKeyLocalError('Market list must receive layout props');
  return buildMarketNativeSnapshot({
    rows: [],
    generation: 1,
    presentation: mockPresentation,
    loading: false,
    noDataMessage: 'No data',
    retryMessage: 'Retry',
    errorMessage: failed ? 'Request failed' : undefined,
    contentPaddingBottom: mockListContainerProps.paddingBottom,
    emptyContentHeight: mockListContainerProps.emptyContentHeight,
  });
}

function measureMarketViewport(height: number) {
  act(() => {
    mockStickyHeaderLayout?.({ nativeEvent: { layout: { height: 44 } } });
    mockPagerProps?.onLayout?.({ nativeEvent: { layout: { height } } });
  });
}

describe.each([false, true])(
  'external header empty/retry viewport (failed=%s)',
  (failed) => {
    const row = () => {
      const snapshot = readEmptySnapshot(failed);
      return failed ? snapshot.rows[0] : snapshot.emptyState;
    };
    it('passes the corrected viewport to real noMatch/retry rows and updates memoized geometry', () => {
      const props = {
        filterBarProps,
        selectedNetworkId: 'evm--1',
        onTabChange: jest.fn(),
        externalTopOverlayTag: 123,
        externalTopOverlayHeight: 100,
      };
      const screen = render(<MobileLayout {...props} />);
      measureMarketViewport(700);
      expect(row()).toMatchObject({
        height: 656,
        variant: failed ? 'retry' : 'noMatch',
      });
      act(() =>
        mockPagerProps?.onScrollEdgeCapability?.({
          nativeEvent: { available: true },
        }),
      );
      expect(row()).toMatchObject({
        height: 556,
        variant: failed ? 'retry' : 'noMatch',
      });
      if (failed)
        expect(row()).toMatchObject({
          actionKey: 'retry',
          actionText: 'Retry',
        });
      const previousProps = mockListContainerProps;
      screen.rerender(
        <MobileLayout {...props} externalTopOverlayHeight={120} />,
      );
      expect(mockListContainerProps).not.toBe(previousProps);
      expect(row()?.height).toBe(536);
      screen.rerender(
        <MobileLayout {...props} externalTopOverlayTag={undefined} />,
      );
      expect(row()?.height).toBe(656);
      screen.rerender(<MobileLayout {...props} />);
      expect(row()?.height).toBe(556);
      act(() =>
        mockPagerProps?.onScrollEdgeCapability?.({
          nativeEvent: { available: false },
        }),
      );
      expect(row()?.height).toBe(656);
      act(() =>
        mockPagerProps?.onScrollEdgeCapability?.({
          nativeEvent: { available: true },
        }),
      );
      measureMarketViewport(80);
      expect(mockListContainerProps?.emptyContentHeight).toBe(0);
      expect(row()?.height).toBe(failed ? 120 : 88);
    });

    it.each([undefined, 0, -1])(
      'does not subtract for standalone or invalid external tag %s',
      (tag) => {
        render(
          <MobileLayout
            filterBarProps={filterBarProps}
            selectedNetworkId="evm--1"
            onTabChange={jest.fn()}
            externalTopOverlayTag={tag}
            externalTopOverlayHeight={100}
          />,
        );
        measureMarketViewport(700);
        act(() =>
          mockPagerProps?.onScrollEdgeCapability?.({
            nativeEvent: { available: true },
          }),
        );
        expect(row()?.height).toBe(656);
      },
    );

    it('keeps the older-iOS no-capability fallback height', () => {
      render(
        <MobileLayout
          filterBarProps={filterBarProps}
          selectedNetworkId="evm--1"
          onTabChange={jest.fn()}
          externalTopOverlayTag={123}
          externalTopOverlayHeight={100}
        />,
      );
      measureMarketViewport(700);
      act(() =>
        mockPagerProps?.onScrollEdgeCapability?.({
          nativeEvent: { available: false },
        }),
      );
      expect(row()?.height).toBe(656);
    });

    it('keeps Android geometry even when capability is reported', () => {
      jest.replaceProperty(platformEnv, 'isNativeIOS', false);
      jest.replaceProperty(platformEnv, 'isNativeAndroid', true);
      render(
        <MobileLayout
          filterBarProps={filterBarProps}
          selectedNetworkId="evm--1"
          onTabChange={jest.fn()}
          externalTopOverlayTag={123}
          externalTopOverlayHeight={100}
        />,
      );
      measureMarketViewport(700);
      act(() =>
        mockPagerProps?.onScrollEdgeCapability?.({
          nativeEvent: { available: true },
        }),
      );
      expect(row()?.height).toBe(616);
    });
  },
);

describe('native market domain fallback with the real business hook', () => {
  it.each(['category removal', 'disabled perps'])(
    'silently selects the first Spot after %s',
    (kind) => {
      mockUseRealTabsLogic = true;
      mockSelection =
        kind === 'category removal'
          ? { tab: 'trending', selectedSpotCategory: 'stocks' }
          : { tab: 'perps', selectedSpotCategory: 'trending' };
      const tabsRef = createRef<IAppPagerRef>();
      const onTabChange = jest.fn();
      const categories = [
        { id: 'trending', name: 'Trending' },
        { id: 'stocks', name: 'Stocks' },
      ];
      const view = render(
        <MobileLayout
          tabsRef={tabsRef}
          filterBarProps={{ ...filterBarProps, categories }}
          selectedNetworkId="evm--1"
          onTabChange={onTabChange}
        />,
      );
      mockSetPageWithoutAnimation.mockClear();
      mockSetSelectedTab.mockClear();
      mockPerpDisabled = kind === 'disabled perps';
      view.rerender(
        <MobileLayout
          tabsRef={tabsRef}
          filterBarProps={{
            ...filterBarProps,
            categories:
              kind === 'category removal' ? categories.slice(0, 1) : categories,
          }}
          selectedNetworkId="evm--1"
          onTabChange={onTabChange}
        />,
      );
      expect(tabsRef.current?.getFocusedTab()).toBe('Trending');
      expect(tabsRef.current?.getCurrentIndex()).toBe(1);
      expect(mockSetPageWithoutAnimation).toHaveBeenCalledWith(1);
      expect(mockSetSelectedTab).not.toHaveBeenCalled();
      expect(onTabChange).not.toHaveBeenCalled();
    },
  );
});
