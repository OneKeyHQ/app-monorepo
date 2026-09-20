/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { MarketTokenSelectorSearchResults } from './MarketTokenSelectorSearchResults';

const mockStockPress = jest.fn();
const mockMarketPress = jest.fn();
const mockRefresh = jest.fn();
type IMockStockSelectorResult = {
  items: IMarketStockPublicItem[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
};
const mockUseMarketStockSelectorList = jest.fn<
  IMockStockSelectorResult,
  [{ query: string }]
>();

const createStock = (stockId: string): IMarketStockPublicItem => ({
  stockId,
  symbol: stockId,
  name: stockId,
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
});

const defaultStockResult = {
  items: [createStock('AAPL')],
  isLoading: false,
  isError: false,
  refresh: mockRefresh,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button data-testid={testID} type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return {
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Empty: () => <div data-testid="empty" />,
    ScrollView: Container,
    SizableText: Container,
    Spinner: () => <div data-testid="spinner" />,
    Table: ({
      dataSource,
      onRow,
    }: {
      dataSource: Array<{ id?: string; stockId?: string }>;
      onRow: (item: { id?: string; stockId?: string }) => {
        onPress: () => void;
      };
    }) => (
      <div>
        {dataSource.map((item) => {
          const id = item.stockId ?? item.id ?? '';
          return (
            <button
              key={id}
              data-testid={`search-row-${id}`}
              type="button"
              onClick={onRow(item).onPress}
            >
              {id}
            </button>
          );
        })}
      </div>
    ),
    XStack: Container,
    YStack: Container,
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/useMarketStockColumns',
  () => ({ useMarketStockColumns: () => [] }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenColumns',
  () => ({ useMarketTokenColumns: () => [] }),
);
jest.mock('./useMarketStockSelectorList', () => ({
  useMarketStockSelectorList: (options: { query: string }) =>
    mockUseMarketStockSelectorList(options),
}));

const marketItem = {
  name: 'AAPL xStock',
  price: '100',
  symbol: 'AAPLx',
  address: '0xaapl',
  network: 'evm--1',
  logoUrl: '',
  isNative: false,
  decimals: 18,
  liquidity: '1000',
  volume_24h: '500',
  networkLogoURI: '',
};

describe('MarketTokenSelectorSearchResults', () => {
  beforeEach(() => {
    mockStockPress.mockReset();
    mockMarketPress.mockReset();
    mockRefresh.mockReset();
    mockUseMarketStockSelectorList.mockReset();
    mockUseMarketStockSelectorList.mockReturnValue(defaultStockResult);
  });

  it('shows stock and market sections with separate navigation identities', () => {
    render(
      <MarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(screen.getAllByText('perps.token_selector_stocks')).toHaveLength(2);
    expect(screen.getAllByText('global.market')).toHaveLength(2);
    expect(mockUseMarketStockSelectorList).toHaveBeenCalledWith({
      query: 'aapl',
    });

    fireEvent.click(screen.getByTestId('search-row-AAPL'));
    expect(mockStockPress).toHaveBeenCalledWith(defaultStockResult.items[0]);

    fireEvent.click(screen.getByTestId('search-row-evm--1_0xaapl'));
    expect(mockMarketPress).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evm--1_0xaapl',
        address: '0xaapl',
        networkId: 'evm--1',
      }),
    );
  });

  it('filters stock and market rows and resets to all for a new query', () => {
    const { rerender } = render(
      <MarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-stocks'),
    );
    expect(screen.getByTestId('search-row-AAPL')).toBeTruthy();
    expect(screen.queryByTestId('search-row-evm--1_0xaapl')).toBeNull();

    fireEvent.click(
      screen.getByTestId('market-token-selector-search-tab-market'),
    );
    expect(screen.queryByTestId('search-row-AAPL')).toBeNull();
    expect(screen.getByTestId('search-row-evm--1_0xaapl')).toBeTruthy();

    rerender(
      <MarketTokenSelectorSearchResults
        query="apple"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );
    expect(screen.getByTestId('search-row-AAPL')).toBeTruthy();
    expect(screen.getByTestId('search-row-evm--1_0xaapl')).toBeTruthy();
  });

  it('keeps market results available when stock search fails', () => {
    mockUseMarketStockSelectorList.mockReturnValue({
      ...defaultStockResult,
      items: [],
      isError: true,
    });

    render(
      <MarketTokenSelectorSearchResults
        query="aapl"
        marketItems={[marketItem]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(screen.getByTestId('search-row-evm--1_0xaapl')).toBeTruthy();
    fireEvent.click(
      screen.getByTestId('market-token-selector-stock-search-retry'),
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('expands a section without mixing stock and market rows', () => {
    mockUseMarketStockSelectorList.mockReturnValue({
      ...defaultStockResult,
      items: ['AAPL', 'MSFT', 'NVDA', 'TSLA'].map(createStock),
    });

    render(
      <MarketTokenSelectorSearchResults
        query="stock"
        marketItems={[]}
        onStockPress={mockStockPress}
        onMarketPress={mockMarketPress}
      />,
    );

    expect(screen.queryByTestId('search-row-TSLA')).toBeNull();
    fireEvent.click(screen.getByText('global.show_more'));
    expect(screen.getByTestId('search-row-TSLA')).toBeTruthy();
  });
});
