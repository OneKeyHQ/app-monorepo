/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { IMarketSpotCategory } from '@onekeyhq/shared/types/marketV2';

import { MarketTokenSelector } from './MarketTokenSelector';

const mockSetSelectorConfig = jest.fn();
const mockStockListMount = jest.fn();
const mockTopCoinPress = jest.fn();
const mockNavigateToMarketTokenDetail = jest.fn();
let mockSpotCategories: IMarketSpotCategory[] = [];
let mockSearchTokenList: IMarketToken[] = [];

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: undefined }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function StackComponent({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) {
    return (
      <div data-testid={testID} onClick={onPress} role="presentation">
        {children}
      </div>
    );
  }

  return {
    Icon: () => null,
    Popover: ({
      open,
      onOpenChange,
      renderContent,
      renderTrigger,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      renderContent: (props: { isOpen: boolean }) => ReactNode;
      renderTrigger: ReactNode;
    }) => {
      const RenderContent = renderContent;
      return (
        <>
          <div onClick={() => onOpenChange(true)} role="presentation">
            {renderTrigger}
          </div>
          {open ? <RenderContent isOpen /> : null}
        </>
      );
    },
    SearchBar: ({
      value,
      onChangeText,
    }: {
      value: string;
      onChangeText: (value: string) => void;
    }) => (
      <input
        data-testid="market-token-selector-search"
        value={value}
        onChange={(event) => onChangeText(event.currentTarget.value)}
      />
    ),
    SizableText: ({
      children,
      letterSpacing,
      textTransform,
    }: {
      children?: ReactNode;
      letterSpacing?: number;
      textTransform?: string;
    }) => (
      <span
        data-letter-spacing={letterSpacing}
        data-text-transform={textTransform}
      >
        {children}
      </span>
    ),
    XStack: StackComponent,
    YStack: StackComponent,
    usePopoverContext: () => ({ closePopover: jest.fn() }),
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => undefined,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({ current: {} }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ spotCategories: mockSpotCategories }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation', () => ({
  usePerpsNavigation: () => ({ navigateToPerps: jest.fn() }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage',
  () => ({
    useToMarketStockDetailPage: () => jest.fn(),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTopCoinsList/hooks/useMarketTopCoins',
  () => ({
    useMarketTopCoins: () => ({
      data: [
        {
          assetId: 'btc',
          symbol: 'BTC',
          price: '100',
          priceChange24hPercent: '1',
          priceChange7dPercent: '2',
          marketCap: '1000',
          volume24h: '500',
          logoUrl: 'bitcoin.png',
          sparkline24h: [],
        },
      ],
      handleItemPress: mockTopCoinPress,
      isLoading: false,
    }),
  }),
);

jest.mock('@onekeyhq/kit/src/views/Swap/hooks/useSwapPro', () => ({
  useSwapProTokenSearch: () => ({
    searchLoading: false,
    searchTokenList: mockSearchTokenList,
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketTokenSelectorConfigAtom: () => [
    { isWatchlistMode: false },
    mockSetSelectorConfig,
  ],
}));

jest.mock('../../hooks/useMarketDetailDisplayData', () => ({
  useMarketDetailHeaderDisplayData: () => ({
    networkId: 'evm--1',
    tokenDetail: {
      address: '0xstock',
      logoUrl: '',
      symbol: 'AAPL',
    },
  }),
}));

jest.mock('./MarketStockSelectorList', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    MarketStockSelectorList: () => {
      useEffect(() => {
        mockStockListMount();
      }, []);
      return <div data-testid="stock-list" />;
    },
  };
});

jest.mock('./MarketTokenSelectorList', () => ({
  MarketTokenSelectorList: ({
    dataOverride,
    isWatchlistMode,
    onItemPress,
    searchResults,
    selectedCategory,
  }: {
    dataOverride?: (IMarketToken & { marketAssetId?: string })[];
    isWatchlistMode: boolean;
    onItemPress: (item: IMarketToken) => void;
    searchResults?: IMarketToken[];
    selectedCategory?: string;
  }) => (
    <>
      <div
        data-category={selectedCategory}
        data-override-count={dataOverride?.length ?? 0}
        data-testid="token-list"
        data-watchlist={String(isWatchlistMode)}
      />
      {dataOverride?.[0] ? (
        <button
          data-testid="market-token-selector-top-coin"
          type="button"
          onClick={() => onItemPress(dataOverride[0])}
        >
          Select Top Coin
        </button>
      ) : null}
      {searchResults?.[0] ? (
        <button
          data-testid="market-token-selector-search-result"
          type="button"
          onClick={() => onItemPress(searchResults[0])}
        >
          Select search result
        </button>
      ) : null}
    </>
  ),
}));

jest.mock('./navigateToMarketTokenDetail', () => ({
  navigateToMarketTokenDetail: (...args: unknown[]) => {
    mockNavigateToMarketTokenDetail(...args);
  },
}));

describe('MarketTokenSelector stock default category', () => {
  beforeEach(() => {
    mockSetSelectorConfig.mockReset();
    mockStockListMount.mockReset();
    mockTopCoinPress.mockReset();
    mockNavigateToMarketTokenDetail.mockReset();
    mockSearchTokenList = [];
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'stocks', name: 'Stocks' },
    ];
  });

  it('adds Top Coins after Stocks and renders its selector data', async () => {
    renderOpenStockSelector();

    const topCoinsTab = screen.getByTestId(
      'market-token-selector-tab-top_coins',
    );
    const stocksTab = screen.getByTestId('market-token-selector-tab-stocks');
    expect(
      stocksTab.compareDocumentPosition(topCoinsTab) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(topCoinsTab);

    await waitFor(() => {
      expect(screen.queryByTestId('stock-list')).toBeNull();
      expect(
        screen.getByTestId('token-list').getAttribute('data-category'),
      ).toBe('top_coins');
      expect(
        screen.getByTestId('token-list').getAttribute('data-override-count'),
      ).toBe('1');
    });

    fireEvent.click(screen.getByTestId('market-token-selector-top-coin'));
    expect(mockTopCoinPress).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'btc' }),
    );
    expect(mockNavigateToMarketTokenDetail).not.toHaveBeenCalled();
  });

  it('preserves category label casing', () => {
    renderOpenStockSelector();

    const topCoinsLabel = screen.getByText('Top Coins');
    expect(topCoinsLabel.getAttribute('data-text-transform')).toBe('none');
    expect(topCoinsLabel.getAttribute('data-letter-spacing')).toBe('0');
  });

  function renderOpenStockSelector() {
    render(<MarketTokenSelector defaultCategory="stocks" />);
    fireEvent.click(screen.getByTestId('market-token-selector-trigger'));
    expect(screen.getByTestId('stock-list')).toBeTruthy();
  }

  it('keeps Trending selected when category config refreshes', async () => {
    renderOpenStockSelector();
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'stock', name: 'Stocks' },
    ];

    fireEvent.click(screen.getByTestId('market-token-selector-tab-trending'));

    await waitFor(() => {
      expect(screen.queryByTestId('stock-list')).toBeNull();
      expect(
        screen.getByTestId('token-list').getAttribute('data-category'),
      ).toBe('trending');
    });
  });

  it('keeps Favorites selected when category config refreshes', async () => {
    renderOpenStockSelector();
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'stock', name: 'Stocks' },
    ];

    fireEvent.click(screen.getByTestId('market-token-selector-tab-favorites'));

    await waitFor(() => {
      expect(screen.queryByTestId('stock-list')).toBeNull();
      expect(
        screen.getByTestId('token-list').getAttribute('data-watchlist'),
      ).toBe('true');
    });
  });

  it('keeps the opened stock list mounted when a custom trigger updates', () => {
    const { rerender } = render(
      <MarketTokenSelector
        defaultCategory="stocks"
        renderTrigger={<div data-testid="custom-stock-trigger">AAPL</div>}
      />,
    );

    fireEvent.click(screen.getByTestId('custom-stock-trigger'));
    expect(screen.getByTestId('stock-list')).toBeTruthy();
    expect(mockStockListMount).toHaveBeenCalledTimes(1);

    rerender(
      <MarketTokenSelector
        defaultCategory="stocks"
        renderTrigger={<div data-testid="custom-stock-trigger">AAPL 2</div>}
      />,
    );

    expect(screen.getByTestId('stock-list')).toBeTruthy();
    expect(mockStockListMount).toHaveBeenCalledTimes(1);
  });

  it('does not carry the Top Coins category into a DEX search result', () => {
    mockSearchTokenList = [
      {
        id: 'dex-token',
        name: 'DEX Token',
        symbol: 'DEX',
        address: '0xdex',
        decimals: 18,
        price: 1,
        change24h: 0,
        marketCap: 0,
        liquidity: 0,
        transactions: 0,
        uniqueTraders: 0,
        holders: 0,
        turnover: 0,
        tokenImageUri: '',
        networkLogoUri: '',
        networkId: 'evm--1',
      },
    ];

    render(<MarketTokenSelector defaultCategory="top_coins" />);
    fireEvent.click(screen.getByTestId('market-token-selector-trigger'));
    fireEvent.change(screen.getByTestId('market-token-selector-search'), {
      target: { value: 'DEX' },
    });
    fireEvent.click(screen.getByTestId('market-token-selector-search-result'));

    expect(mockNavigateToMarketTokenDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0xdex',
        networkId: 'evm--1',
      }),
      expect.objectContaining({ marketTokenCategory: undefined }),
    );
  });
});
