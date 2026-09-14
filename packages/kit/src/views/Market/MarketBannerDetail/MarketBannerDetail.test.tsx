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
    Stack: Container,
    XStack: Container,
    YStack: Container,
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
    }: {
      hiddenDesktopColumns?: readonly string[];
      forceStockMetadataColumns?: boolean;
    }) => (
      <div
        data-testid="stocks"
        data-hidden-columns={hiddenDesktopColumns?.join(',')}
        data-stock-columns={forceStockMetadataColumns}
      />
    ),
  }),
);
jest.mock('../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: ({
    children,
  }: import('react').PropsWithChildren) => children,
}));
jest.mock('./BannerDetailTokenFlatList', () => ({
  BannerDetailTokenFlatList: () => <div data-testid="stocks" />,
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
    },
    mobileData: [],
  })),
}));

beforeEach(() => {
  mockTokenListId = 'composite';
  mockStockTokens = false;
  mockIncludeNonStockToken = false;
});

it('keeps token columns for a ticker banner containing stock and crypto rows', () => {
  mockType = EMarketBannerType.Ticker;
  mockWide = true;
  mockStockTokens = true;
  mockIncludeNonStockToken = true;
  render(<MarketBannerDetail />);
  const list = screen.getByTestId('stocks');
  expect(list.getAttribute('data-stock-columns')).toBe('true');
  expect(list.getAttribute('data-hidden-columns')).toBe(
    'transactions,uniqueTraders,holders,tokenAge',
  );
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
  expect(screen.getByTestId('stocks')).toBeTruthy();
  expect(screen.queryByTestId('perps')).toBeNull();
  expect(
    screen.getByRole('tab', { name: 'spot' }).getAttribute('aria-selected'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'perps' }));
  expect(screen.queryByTestId('stocks')).toBeNull();
  expect(screen.getByTestId('perps').textContent).toBe('composite');
  expect(
    screen.getByRole('tab', { name: 'perps' }).getAttribute('aria-selected'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('tab', { name: 'spot' }));
  expect(screen.getByTestId('stocks')).toBeTruthy();
  expect(screen.queryByTestId('perps')).toBeNull();
});

it('resets the selected category for another banner', () => {
  mockType = EMarketBannerType.Mixed;
  const { rerender } = render(<MarketBannerDetail />);
  fireEvent.click(screen.getByRole('tab', { name: 'perps' }));
  mockTokenListId = 'another-banner';
  rerender(<MarketBannerDetail />);
  expect(screen.getByTestId('stocks')).toBeTruthy();
  expect(screen.queryByTestId('perps')).toBeNull();
});

it('uses stock columns for tokenized stocks in a ticker banner', () => {
  mockType = EMarketBannerType.Ticker;
  mockWide = true;
  mockStockTokens = true;
  render(<MarketBannerDetail />);
  const list = screen.getByTestId('stocks');
  expect(list.getAttribute('data-hidden-columns')).toBe(
    'transactions,uniqueTraders,holders,tokenAge',
  );
  expect(list.getAttribute('data-stock-columns')).toBe('true');
  expect(useMarketBannerDetail).toHaveBeenLastCalledWith({
    tokenListId: 'composite',
    isPerps: false,
    isStock: false,
    isIndex: false,
  });
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
  } else {
    const list = screen.getByTestId('stocks');
    expect(list.getAttribute('data-hidden-columns')).toBe(
      type === EMarketBannerType.Stock
        ? 'transactions,uniqueTraders,holders,tokenAge,turnover'
        : 'liquidity',
    );
    expect(list.getAttribute('data-stock-columns')).toBe(
      String(type === EMarketBannerType.Stock),
    );
  }
});
