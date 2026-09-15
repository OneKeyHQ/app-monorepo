/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

import { MarketBannerDetail } from './MarketBannerDetail';
import { useMarketBannerDetail } from './useMarketBannerDetail';

let mockType = EMarketBannerType.Mixed;
let mockWide = false;
let mockTokenListId = 'composite';
let mockStockTokens = false;
let mockIncludeNonStockToken = false;
jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: {
      title: 'Composite',
      type: mockType,
      tokenListId: mockTokenListId,
    },
  }),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Change' }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: import('react').PropsWithChildren) =>
    React.createElement('div', null, children);
  const Frame = ({
    children,
    maxWidth,
    testID,
  }: import('react').PropsWithChildren<{
    maxWidth?: number;
    testID?: string;
  }>) =>
    React.createElement(
      'div',
      { 'data-testid': testID, 'data-max-width': maxWidth },
      children,
    );
  return {
    Tabs: {
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
    },
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    Stack: Frame,
    XStack: Container,
    YStack: Frame,
    SizableText: Container,
    NavBackButton: () => null,
    HeaderButtonGroup: () => null,
    useMedia: () => ({ gtMd: mockWide }),
    useSafeAreaInsets: () => ({ top: 0 }),
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
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
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
jest.mock('./BannerDetailStockFlatList', () => ({
  BannerDetailStockFlatList: ({ items }: { items: { stockId: string }[] }) => (
    <div
      data-testid="mobile-stock-list"
      data-stock-ids={items.map((item) => item.stockId).join(',')}
    />
  ),
}));
jest.mock('./BannerDetailTokenFlatList', () => ({
  BannerDetailTokenFlatList: () => <div data-testid="mobile-list" />,
}));
jest.mock('./PerpsTokenListSection', () => ({
  PerpsTokenListSection: ({ tokenListId }: { tokenListId: string }) => (
    <div data-testid="perps">{tokenListId}</div>
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
    tickerIsLoading: false,
  })),
}));

beforeEach(() => {
  mockTokenListId = 'composite';
  mockStockTokens = false;
  mockIncludeNonStockToken = false;
  mockWide = false;
  mockType = EMarketBannerType.Mixed;
});

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
  expect(screen.getByTestId(spotTestId())).toBeTruthy();
  expect(screen.queryByTestId('perps')).toBeNull();
  expect(
    screen.getByRole('tab', { name: 'spot' }).getAttribute('aria-selected'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'perps' }));
  expect(screen.queryByTestId(spotTestId())).toBeNull();
  expect(screen.getByTestId('perps').textContent).toBe('composite');
  expect(
    screen.getByRole('tab', { name: 'perps' }).getAttribute('aria-selected'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'spot' }));
  expect(screen.getByTestId(spotTestId())).toBeTruthy();
  expect(screen.queryByTestId('perps')).toBeNull();
});

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
