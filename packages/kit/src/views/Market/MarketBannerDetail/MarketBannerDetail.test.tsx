/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isTabBarHiddenByRequest } from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';
import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

import {
  BannerDetailListColumnHeader,
  resolveBannerDetailColumnMode,
} from './BannerDetailListColumnHeader';
import { MarketBannerDetail } from './MarketBannerDetail';
import { useMarketBannerDetail } from './useMarketBannerDetail';

let mockType = EMarketBannerType.Mixed;
let mockWide = false;
let mockTokenListId = 'composite';
let mockStockTokens = false;
let mockIncludeNonStockToken = false;
let mockIsWeb = true;
let mockIsNative = false;
let mockIsOverlayPage = false;
let mockIsModalPage = false;
let mockIsNativeIOS26Plus = false;
let mockIsFocused = true;
let mockTickerIsLoading: boolean | undefined;
const mockFocusListeners = new Map<string, () => void>();
const mockNavigation = {
  isFocused: () => mockIsFocused,
  addListener: (event: string, callback: () => void) => {
    mockFocusListeners.set(event, callback);
    return () => mockFocusListeners.delete(event);
  },
};

it('chooses banner metric columns from the list width', () => {
  expect(resolveBannerDetailColumnMode(767)).toBe('compact');
  expect(resolveBannerDetailColumnMode(768)).toBe('two');
  expect(resolveBannerDetailColumnMode(1023)).toBe('two');
  expect(resolveBannerDetailColumnMode(1024)).toBe('three');
});

it('moves volume out of the identity header in three-column mode', () => {
  const props = {
    primaryColumnTitle: 'Name / Volume',
    change24hColumnTitle: 'Change',
    onChangeSortPress: jest.fn(),
  };
  const { rerender } = render(
    <BannerDetailListColumnHeader {...props} columnMode="two" />,
  );
  expect(screen.getByText('Name / Volume')).toBeTruthy();
  rerender(<BannerDetailListColumnHeader {...props} columnMode="three" />);
  expect(screen.queryByText('Name / Volume')).toBeNull();
});
jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      title: 'Composite',
      type: mockType,
      tokenListId: mockTokenListId,
    },
  }),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 74 }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) =>
      id === ETranslations.global_no_data ? 'No data' : 'Change',
  }),
}));
jest.mock('react-native', () => ({
  FlatList: ({
    data,
    ListEmptyComponent,
  }: {
    data: readonly unknown[];
    ListEmptyComponent?: import('react').ReactNode;
  }) => (data.length === 0 ? ListEmptyComponent : null),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: import('react').PropsWithChildren) =>
    React.createElement('div', null, children);
  const Frame = ({
    children,
    maxWidth,
    pt,
    testID,
  }: import('react').PropsWithChildren<{
    maxWidth?: number;
    pt?: number;
    testID?: string;
  }>) =>
    React.createElement(
      'div',
      { 'data-testid': testID, 'data-max-width': maxWidth, 'data-pt': pt },
      children,
    );
  return {
    TabBarItem: ({
      name,
      tabItemStyle,
      onPress,
    }: {
      name: string;
      tabItemStyle: { 'aria-selected': boolean };
      onPress: (name: string) => void;
    }) =>
      React.createElement(
        'button',
        {
          role: 'tab',
          'aria-selected': tabItemStyle['aria-selected'],
          onClick: () => onPress(name),
        },
        name,
      ),
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    Stack: Frame,
    XStack: Container,
    YStack: Frame,
    SizableText: Container,
    Icon: () => null,
    NavBackButton: () => null,
    HeaderButtonGroup: () => null,
    rootNavigationRef: { current: undefined },
    useIsModalPage: () => mockIsModalPage,
    useIsOverlayPage: () => mockIsOverlayPage,
    useMedia: () => ({ gtMd: mockWide }),
    useSafeAreaInsets: () => ({ top: 0 }),
    useTabBarHeight: () => 0,
  };
});
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: import('react').PropsWithChildren) => children,
}));
jest.mock(
  '@onekeyhq/kit/src/components/TabPageHeader/components/HeaderNotificationIconButton',
  () => ({ HeaderNotificationIconButton: () => null }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { marketWatchListV2: 'market' },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  getRootRoutersLength: () => 1,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isWeb() {
      return mockIsWeb;
    },
    get isNative() {
      return mockIsNative;
    },
    get isNativeIOS26Plus() {
      return mockIsNativeIOS26Plus;
    },
  },
}));
jest.mock('../../../components/TabPageHeader', () => ({
  TabPageHeader: () => null,
}));
jest.mock('../MarketDetailV2/hooks/useMarketDetailBackNavigation', () => ({
  useMarketDetailBackNavigation: () => ({ handleBackPress: jest.fn() }),
}));
jest.mock(
  '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage',
  () => ({ useToDetailPage: () => jest.fn() }),
);
jest.mock(
  '../MarketHomeV2/components/MarketTokenList/MarketTokenListBase',
  () => ({
    MarketTokenListBase: ({
      hiddenDesktopColumns,
      forceStockMetadataColumns,
      desktopColumnVariant,
      timeRange,
      result,
    }: {
      hiddenDesktopColumns?: readonly string[];
      forceStockMetadataColumns?: boolean;
      desktopColumnVariant?: string;
      timeRange?: string;
      result: { currentSortBy?: string };
    }) => (
      <div
        data-testid="tokens"
        data-hidden-columns={hiddenDesktopColumns?.join(',') ?? ''}
        data-stock-columns={String(Boolean(forceStockMetadataColumns))}
        data-column-variant={desktopColumnVariant}
        data-time-range={timeRange}
        data-current-sort-by={result.currentSortBy ?? ''}
      />
    ),
  }),
);
jest.mock('../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: ({
    children,
  }: import('react').PropsWithChildren) => children,
}));
jest.mock('./BannerDetailStockTable', () => ({
  BannerDetailStockTable: ({ items }: { items: { stockId: string }[] }) => (
    <div
      data-testid="stocks"
      data-stock-ids={items.map((item) => item.stockId).join(',')}
    />
  ),
}));
jest.mock(
  '../MarketHomeV2/components/MarketStockList/MobileMarketStockListItem',
  () => ({ MobileMarketStockListItem: () => null }),
);
jest.mock(
  '../MarketHomeV2/components/MarketTokenList/components/TokenListItem',
  () => ({ TokenListItem: () => null }),
);
jest.mock(
  '../MarketHomeV2/components/MarketTokenList/components/TokenListSkeleton',
  () => ({ TokenListSkeleton: () => <div data-testid="banner-skeleton" /> }),
);
jest.mock('./BannerDetailStockFlatList', () => {
  const { BannerDetailStockFlatList } = jest.requireActual<
    typeof import('./BannerDetailStockFlatList')
  >('./BannerDetailStockFlatList');
  return {
    BannerDetailStockFlatList: (
      props: import('react').ComponentProps<typeof BannerDetailStockFlatList>,
    ) => (
      <div
        data-testid="mobile-stock-list"
        data-stock-ids={props.items.map((item) => item.stockId).join(',')}
      >
        <BannerDetailStockFlatList {...props} />
      </div>
    ),
  };
});
jest.mock('./BannerDetailTokenFlatList', () => {
  const { BannerDetailTokenFlatList } = jest.requireActual<
    typeof import('./BannerDetailTokenFlatList')
  >('./BannerDetailTokenFlatList');
  return {
    BannerDetailTokenFlatList: (
      props: import('react').ComponentProps<typeof BannerDetailTokenFlatList>,
    ) => (
      <div data-testid="mobile-list">
        <BannerDetailTokenFlatList {...props} />
      </div>
    ),
  };
});
jest.mock('./PerpsTokenListSection', () => ({
  PerpsTokenListSection: ({
    tokenListId,
    isActive,
  }: {
    tokenListId: string;
    isActive: boolean;
  }) => (
    <div data-testid="perps" data-active={String(isActive)}>
      {tokenListId}
    </div>
  ),
}));
jest.mock('./useMarketBannerDetail', () => ({
  useMarketBannerDetail: jest.fn(() => ({
    listResult: {
      data: mockStockTokens
        ? [
            { stock: { tradingActivity: { peRatio: '27.46' } } },
            { stock: {} },
            ...(mockIncludeNonStockToken
              ? [{ marketCap: 100, liquidity: 200, turnover: 300 }]
              : []),
          ]
        : [],
      currentSortBy: 'change24h',
      currentSortType: 'desc',
      setSortBy: jest.fn(),
      setSortType: jest.fn(),
    },
    mobileData: [],
    stockItems: mockStockTokens
      ? [{ stockId: 'AAPL' }, { stockId: 'TSLA' }]
      : [],
    tickerIsLoading: mockTickerIsLoading,
  })),
}));

beforeEach(() => {
  mockTokenListId = 'composite';
  mockStockTokens = false;
  mockIncludeNonStockToken = false;
  mockWide = false;
  mockIsWeb = true;
  mockIsNative = false;
  mockIsOverlayPage = false;
  mockIsModalPage = false;
  mockIsNativeIOS26Plus = false;
  mockIsFocused = true;
  mockTickerIsLoading = false;
  mockFocusListeners.clear();
  mockType = EMarketBannerType.Mixed;
});

it('hides the bottom tab bar while the native banner tab route is focused', () => {
  mockIsNative = true;
  mockIsWeb = false;
  const { unmount } = render(<MarketBannerDetail />);
  expect(isTabBarHiddenByRequest()).toBe(true);

  mockIsFocused = false;
  mockFocusListeners.get('blur')?.();
  expect(isTabBarHiddenByRequest()).toBe(false);

  mockIsFocused = true;
  mockFocusListeners.get('focus')?.();
  expect(isTabBarHiddenByRequest()).toBe(true);

  unmount();
  expect(isTabBarHiddenByRequest()).toBe(false);
});

it.each([
  { name: 'web route', isNative: false, isOverlay: false },
  { name: 'native modal route', isNative: true, isOverlay: true },
])(
  'leaves tab bar visibility alone on the $name',
  ({ isNative, isOverlay }) => {
    mockIsNative = isNative;
    mockIsWeb = !isNative;
    mockIsOverlayPage = isOverlay;
    render(<MarketBannerDetail />);
    expect(isTabBarHiddenByRequest()).toBe(false);
  },
);

// The mixed banner's spot section is the desktop stock table on wide layouts
// and the compact stock list on narrow ones.
const spotTestId = () => (mockWide ? 'stocks' : 'mobile-stock-list');

it.each([
  { name: 'stock and crypto rows', includeNonStock: true },
  { name: 'tokenized stocks only', includeNonStock: false },
])(
  'renders a ticker banner with trending columns ($name)',
  ({ includeNonStock }) => {
    mockType = EMarketBannerType.Ticker;
    mockWide = true;
    mockStockTokens = true;
    mockIncludeNonStockToken = includeNonStock;
    render(<MarketBannerDetail />);
    const list = screen.getByTestId('tokens');
    expect(list.getAttribute('data-column-variant')).toBe('trending');
    expect(list.getAttribute('data-time-range')).toBe('24h');
    expect(list.getAttribute('data-hidden-columns')).toBe('');
    expect(list.getAttribute('data-stock-columns')).toBe('false');
    // Desktop sorts in memory; the persisted mobile sort must not reorder rows.
    expect(list.getAttribute('data-current-sort-by')).toBe('');
    expect(screen.queryByTestId('stocks')).toBeNull();
    expect(useMarketBannerDetail).toHaveBeenLastCalledWith({
      tokenListId: 'composite',
      isPerps: false,
      isStock: false,
      isIndex: false,
    });
  },
);

it.each([
  { name: 'pushed page', isModal: false, pt: '74' },
  { name: 'modal page', isModal: true, pt: '0' },
])(
  'offsets the iOS 26 body by the header height only on a $name',
  ({ isModal, pt }) => {
    // A pushed page's iOS 26 bar floats over the body; a modal's opaque bar
    // (an iPad overlay) already sits above it (OK-67747).
    mockIsNative = true;
    mockIsWeb = false;
    mockIsNativeIOS26Plus = true;
    mockIsModalPage = isModal;
    mockIsOverlayPage = isModal;
    render(<MarketBannerDetail />);
    expect(
      screen.getByTestId('market-banner-detail-body').getAttribute('data-pt'),
    ).toBe(pt);
  },
);

it('frames the desktop page with the shared content width', () => {
  mockType = EMarketBannerType.Ticker;
  mockWide = true;
  render(<MarketBannerDetail />);
  expect(
    screen
      .getByTestId('market-banner-detail-body')
      .getAttribute('data-max-width'),
  ).toBe('1440');
});

it('renders the raw stock rows in the desktop stock table', () => {
  mockType = EMarketBannerType.Stock;
  mockWide = true;
  mockStockTokens = true;
  render(<MarketBannerDetail />);
  expect(screen.getByTestId('stocks').getAttribute('data-stock-ids')).toBe(
    'AAPL,TSLA',
  );
  expect(screen.queryByTestId('tokens')).toBeNull();
});

it('renders the compact stock list with the raw rows on narrow layouts', () => {
  mockType = EMarketBannerType.Stock;
  mockWide = false;
  mockStockTokens = true;
  render(<MarketBannerDetail />);
  expect(
    screen.getByTestId('mobile-stock-list').getAttribute('data-stock-ids'),
  ).toBe('AAPL,TSLA');
  expect(screen.queryByTestId('mobile-list')).toBeNull();
  expect(screen.queryByTestId('stocks')).toBeNull();
});

it('keeps the compact token list for a ticker banner on narrow layouts', () => {
  mockType = EMarketBannerType.Ticker;
  mockWide = false;
  render(<MarketBannerDetail />);
  expect(screen.getByTestId('mobile-list')).toBeTruthy();
  expect(screen.queryByTestId('mobile-stock-list')).toBeNull();
  expect(screen.queryByTestId('tokens')).toBeNull();
});

it.each([EMarketBannerType.Ticker, EMarketBannerType.Stock])(
  'shows the native %s empty state only after the request settles',
  (type) => {
    mockType = type;
    mockIsNative = true;
    mockIsWeb = false;
    mockTickerIsLoading = undefined;
    const { rerender } = render(<MarketBannerDetail />);
    expect(screen.getByTestId('banner-skeleton')).toBeTruthy();
    expect(screen.queryByText('No data')).toBeNull();

    mockTickerIsLoading = false;
    rerender(<MarketBannerDetail />);
    expect(screen.queryByTestId('banner-skeleton')).toBeNull();
    expect(screen.getByText('No data')).toBeTruthy();
  },
);

it('keeps the original FlatList row path on a wide native banner', () => {
  mockIsWeb = false;
  mockIsNative = true;
  mockWide = true;
  mockType = EMarketBannerType.Stock;
  mockStockTokens = true;
  render(<MarketBannerDetail />);
  expect(screen.getByTestId('mobile-stock-list')).toBeTruthy();
  expect(screen.queryByTestId('stocks')).toBeNull();
});

it.each([
  { type: EMarketBannerType.Mixed, wide: false },
  { type: EMarketBannerType.Mixed, wide: true },
  { type: EMarketBannerType.StockPerps, wide: false },
  { type: EMarketBannerType.StockPerps, wide: true },
])('switches between sections for $type (wide=$wide)', ({ type, wide }) => {
  mockType = type;
  mockWide = wide;
  render(<MarketBannerDetail />);
  expect(useMarketBannerDetail).toHaveBeenLastCalledWith({
    tokenListId: 'composite',
    isPerps: false,
    isStock: true,
    isIndex: false,
  });
  const spotList = screen.getByTestId(spotTestId());
  expect(screen.getByRole('tabpanel').contains(spotList)).toBe(true);
  expect(screen.queryByTestId('perps')).toBeNull();
  expect(
    screen.getByRole('tab', { name: 'spot' }).getAttribute('aria-selected'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'perps' }));
  expect(screen.getByTestId(spotTestId())).toBe(spotList);
  const perpsList = screen.getByTestId('perps');
  expect(screen.getByRole('tabpanel').contains(perpsList)).toBe(true);
  expect(perpsList.textContent).toBe('composite');
  expect(perpsList.getAttribute('data-active')).toBe('true');
  expect(
    screen.getByRole('tab', { name: 'perps' }).getAttribute('aria-selected'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'spot' }));
  expect(screen.getByTestId(spotTestId())).toBe(spotList);
  expect(screen.getByRole('tabpanel').contains(spotList)).toBe(true);
  expect(screen.getByTestId('perps')).toBe(perpsList);
  expect(perpsList.getAttribute('data-active')).toBe('false');
  fireEvent.click(screen.getByRole('tab', { name: 'perps' }));
  expect(screen.getByTestId('perps')).toBe(perpsList);
  expect(screen.getByRole('tabpanel').contains(perpsList)).toBe(true);
  expect(perpsList.getAttribute('data-active')).toBe('true');
});

it.each([
  { wide: false, spotTestId: 'mobile-list' },
  { wide: true, spotTestId: 'tokens' },
])(
  'pairs a ticker banner with a perps tab for ticker_perps (wide=$wide)',
  ({ wide, spotTestId: tickerSpotTestId }) => {
    mockType = EMarketBannerType.TickerPerps;
    mockWide = wide;
    render(<MarketBannerDetail />);
    expect(useMarketBannerDetail).toHaveBeenLastCalledWith({
      tokenListId: 'composite',
      isPerps: false,
      isStock: false,
      isIndex: false,
    });
    expect(screen.getByTestId(tickerSpotTestId)).toBeTruthy();
    expect(screen.queryByTestId('stocks')).toBeNull();
    expect(screen.queryByTestId('mobile-stock-list')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'perps' }));
    expect(
      screen
        .getByRole('tabpanel')
        .contains(screen.getByTestId(tickerSpotTestId)),
    ).toBe(false);
    expect(screen.getByTestId('perps').textContent).toBe('composite');
  },
);

it('resets the selected category for another banner', () => {
  mockType = EMarketBannerType.Mixed;
  mockWide = true;
  const { rerender } = render(<MarketBannerDetail />);
  fireEvent.click(screen.getByRole('tab', { name: 'perps' }));
  mockTokenListId = 'another-banner';
  rerender(<MarketBannerDetail />);
  expect(screen.getByTestId(spotTestId())).toBeTruthy();
  expect(screen.queryByTestId('perps')).toBeNull();
});

it('keeps conditional sections outside web', () => {
  mockIsWeb = false;
  mockWide = true;
  render(<MarketBannerDetail />);
  expect(screen.queryByRole('tabpanel')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'perps' }));
  expect(screen.queryByTestId(spotTestId())).toBeNull();
  expect(screen.getByTestId('perps')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'spot' }));
  expect(screen.getByTestId(spotTestId())).toBeTruthy();
  expect(screen.queryByTestId('perps')).toBeNull();
});

it.each([
  EMarketBannerType.Stock,
  EMarketBannerType.Ticker,
  EMarketBannerType.Perps,
])('does not add category tabs to a %s banner', (type) => {
  mockType = type;
  mockWide = true;
  render(<MarketBannerDetail />);
  expect(screen.queryByRole('tab')).toBeNull();
  if (type === EMarketBannerType.Perps) {
    expect(screen.getByTestId('perps')).toBeTruthy();
  } else if (type === EMarketBannerType.Stock) {
    expect(screen.getByTestId('stocks')).toBeTruthy();
  } else {
    expect(
      screen.getByTestId('tokens').getAttribute('data-column-variant'),
    ).toBe('trending');
  }
});
