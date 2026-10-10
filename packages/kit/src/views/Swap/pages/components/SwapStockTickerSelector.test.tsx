/** @jest-environment jsdom */

import type { ComponentType, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';

import { SwapStockTickerSelector } from './SwapStockTickerSelector';

const mockClosePopover = jest.fn();
const mockSelectStock = jest.fn();
const mockLoadMore = jest.fn();
const mockStock: IMarketStockPublicItem = {
  stockId: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple',
  logoUrl: 'https://example.com/aapl.png',
  assetType: 'stock',
  price: '310.34',
  priceChange24hPercent: '0.32',
  currency: 'USD',
};
const mockListResult = {
  items: [] as IMarketStockPublicItem[],
  isLoading: false,
  isError: false,
  canLoadMore: false,
  isLoadingMore: false,
  isLoadMoreError: false,
  isRevalidatingFirstPage: false,
  loadMore: mockLoadMore,
  refresh: jest.fn(),
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return {
    Button: Wrapper,
    Icon: () => null,
    NumberSizeableText: Wrapper,
    ScrollView: Wrapper,
    SearchBar: ({
      value,
      onChangeText,
      testID,
    }: {
      value: string;
      onChangeText: (value: string) => void;
      testID: string;
    }) => (
      <input
        data-testid={testID}
        value={value}
        onChange={(event) => onChangeText(event.target.value)}
      />
    ),
    SizableText: Wrapper,
    Spinner: () => null,
    Stack: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
    useMedia: () => ({ md: false }),
  };
});
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage',
  () => ({ PriceChangePercentage: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/StockSelectorPopover',
  () => ({
    StockSelectorPopover: ({
      renderContent: Content,
    }: {
      renderContent: ComponentType<{ closePopover: () => void }>;
    }) => <Content closePopover={mockClosePopover} />,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketStockSelectorList',
  () => ({ useMarketStockSelectorList: () => mockListResult }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext',
  () => ({
    useStockDetail: () => ({ stockId: 'AAPL', stockPreview: mockStock }),
  }),
);
jest.mock('../modal/SwapTokenSelectModal.utils', () => ({
  getSwapStockTokenDisplayName: () => 'Apple',
}));
jest.mock('./SwapStockMarketProvider', () => ({
  useSwapStockSelection: () => ({ selectStock: mockSelectStock }),
}));
jest.mock('./SwapStockTradeProvider', () => ({
  useSwapStockTradeContext: () => ({ currentStockToken: undefined }),
}));

describe('SwapStockTickerSelector', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockListResult.items = [];
    mockListResult.canLoadMore = false;
    mockListResult.isLoadMoreError = false;
    mockListResult.isLoadingMore = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps an empty page with a cursor reachable through the more button', () => {
    mockListResult.canLoadMore = true;
    render(<SwapStockTickerSelector />);

    expect(screen.queryByTestId('swap-stock-ticker-empty')).toBeNull();
    expect(screen.queryByText(ETranslations.global_no_results)).toBeNull();
    fireEvent.click(screen.getByText(ETranslations.global_more));
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows the final empty state when there is no continuation cursor', () => {
    render(<SwapStockTickerSelector />);

    expect(screen.getByTestId('swap-stock-ticker-empty')).toBeTruthy();
    expect(screen.getByText(ETranslations.global_no_results)).toBeTruthy();
    expect(screen.queryByTestId('swap-stock-ticker-load-more')).toBeNull();
  });

  it('closes before selecting a stock from the debounced search results', () => {
    mockListResult.items = [mockStock];
    render(<SwapStockTickerSelector />);
    const search = screen.getByTestId('swap-stock-ticker-search');
    fireEvent.change(search, { target: { value: 'aapl' } });
    act(() => jest.advanceTimersByTime(500));
    fireEvent.change(search, { target: { value: 'aapl.d' } });

    fireEvent.click(screen.getByTestId('swap-stock-ticker-AAPL'));

    expect(mockClosePopover).toHaveBeenCalledTimes(1);
    expect(mockSelectStock).toHaveBeenCalledWith(mockStock, 'aapl');
    expect(mockClosePopover.mock.invocationCallOrder[0]).toBeLessThan(
      mockSelectStock.mock.invocationCallOrder[0],
    );
  });
});
