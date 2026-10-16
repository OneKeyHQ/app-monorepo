/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IMarketToken } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type {
  IMarketSpotCategory,
  IMarketStockPublicItem,
} from '@onekeyhq/shared/types/marketV2';

import { useDetailSelectorBrowseState } from './detailSelectorBrowse';
import { MarketTokenSelector } from './MarketTokenSelector';
import MobileTokenSelector from './MobileTokenSelector';

const mockSetSelectorConfig = jest.fn();
const mockStockListMount = jest.fn();
const mockTopCoinPress = jest.fn();
const mockNavigateToMarketTokenDetail = jest.fn();
const mockToStock = jest.fn();
const mockUseToMarketStockDetailPage = jest.fn(
  (_options?: unknown) => mockToStock,
);
let mockConfigLoading = false;
let mockSpotCategories: IMarketSpotCategory[] = [];
let mockStockCategories: Array<{ category: string; name: string }> = [];
let mockSearchTokenList: IMarketToken[] = [];
let mockMobileSearchTokenList:
  | (IMarketSearchV2Token & { networkLogoURI: string })[]
  | undefined;
let mockWatchlistToken: IMarketToken | undefined;

let mockRouteParams:
  | {
      marketTokenCategory?: string;
    }
  | undefined;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

// The tab bar is `Tabs.TabBar` underneath (covered by its own test); a plain
// row of buttons keeps these tests on the selector's own logic.
jest.mock('./selectorTabBar', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  return {
    SelectorTabBar: ({
      tabs,
      onChange,
      testIDPrefix,
    }: {
      tabs: { id: string; label: string }[];
      onChange: (tabId: string) => void;
      testIDPrefix: string;
    }) =>
      ReactModule.createElement(
        'div',
        null,
        tabs.map((tab) =>
          ReactModule.createElement(
            'button',
            {
              key: tab.id,
              type: 'button',
              'data-testid': `${testIDPrefix}${tab.id}`,
              onClick: () => onChange(tab.id),
            },
            tab.label,
          ),
        ),
      ),
  };
});

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
    Page: Object.assign(StackComponent, {
      Header: () => null,
      Body: StackComponent,
    }),
    Stack: StackComponent,
    Toast: { error: jest.fn() },
    Icon: () => null,
    Image: () => null,
    GradientMask: () => null,
    ScrollView: StackComponent,
    useMedia: () => ({ md: false }),
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
      size,
    }: {
      children?: ReactNode;
      size?: string;
    }) => <span data-size={size}>{children}</span>,
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

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popStack: jest.fn() }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketWatchListProviderMirrorV2',
  () => ({
    MarketWatchListProviderMirrorV2: ({ children }: { children?: ReactNode }) =>
      children,
  }),
);
jest.mock('./dismissMobileTokenSelectorKeyboard', () => ({
  dismissMobileTokenSelectorKeyboard: jest.fn(),
}));
jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));
jest.mock('./useLiveTokenOverride', () => ({
  useLiveTokenOverride: () => undefined,
}));
jest.mock('./MobileMarketSelectorBrowseLists', () => ({
  MobileSelectorCategoryTokenList: () => null,
  MobileSelectorStockList: () => null,
  MobileSelectorTopCoinsList: () => null,
  MobileSelectorWatchlistList: ({
    watchlistFilter,
  }: {
    watchlistFilter: string;
  }) => <div data-testid="mobile-favorites" data-filter={watchlistFilter} />,
}));
jest.mock('./MobileMarketTokenSelectorSearchResults', () => ({
  MobileMarketTokenSelectorSearchResults: ({
    marketItems,
    onMarketPress,
  }: {
    marketItems: IMarketSearchV2Token[];
    onMarketPress: (item: IMarketSearchV2Token) => void;
  }) => (
    <button
      type="button"
      data-testid="mobile-search-result"
      onClick={() => onMarketPress(marketItems[0])}
    >
      Select asset
    </button>
  ),
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => undefined,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({ current: {} }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({
    isLoading: mockConfigLoading,
    spotCategories: mockSpotCategories,
    stockCategories: mockStockCategories,
  }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation', () => ({
  usePerpsNavigation: () => ({ navigateToPerps: jest.fn() }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage',
  () => ({
    useToMarketStockDetailPage: (options: unknown) =>
      mockUseToMarketStockDetailPage(options),
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
    searchTokenList: mockMobileSearchTokenList ?? mockSearchTokenList,
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { marketWatchListV2: 'marketWatchListV2' },
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
    MarketStockSelectorList: ({ category }: { category?: string }) => {
      useEffect(() => {
        mockStockListMount();
      }, []);
      return <div data-testid="stock-list" data-category={category ?? ''} />;
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
    watchlistFilter,
  }: {
    watchlistFilter?: string;
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
        data-filter={watchlistFilter}
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
      {isWatchlistMode && mockWatchlistToken ? (
        <button
          data-testid="market-token-selector-watchlist-result"
          type="button"
          onClick={() => {
            if (mockWatchlistToken) onItemPress(mockWatchlistToken);
          }}
        >
          Select favorite
        </button>
      ) : null}
    </>
  ),
}));

jest.mock('./MarketTokenSelectorSearchResults', () => ({
  MarketTokenSelectorSearchResults: ({
    marketItems,
    onMarketPress,
    onStockPress,
  }: {
    marketItems: IMarketToken[];
    onMarketPress: (item: IMarketToken) => void;
    onStockPress: (item: IMarketStockPublicItem) => void;
  }) => (
    <>
      {marketItems[0] ? (
        <button
          data-testid="market-token-selector-search-result"
          type="button"
          onClick={() => onMarketPress(marketItems[0])}
        >
          Select market result
        </button>
      ) : null}
      <button
        data-testid="market-token-selector-stock-search-result"
        type="button"
        onClick={() =>
          onStockPress({
            stockId: 'AAPL',
            symbol: 'AAPL',
            name: 'Apple',
            logoUrl: 'apple.png',
            assetType: 'stock',
            currency: 'USD',
          })
        }
      >
        Select stock result
      </button>
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
    mockUseToMarketStockDetailPage.mockClear();
    mockToStock.mockClear();
    mockSearchTokenList = [];
    mockMobileSearchTokenList = undefined;
    mockWatchlistToken = undefined;
    mockRouteParams = undefined;
    mockConfigLoading = false;
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'stocks', name: 'Stocks' },
    ];
    mockStockCategories = [];
  });

  it('preserves assetId when selecting an asset-only mobile search result', () => {
    mockMobileSearchTokenList = [
      {
        assetId: 'bitcoin',
        name: 'Bitcoin',
        symbol: 'BTC',
        address: '',
        network: '',
        price: '100',
        logoUrl: '',
        isNative: true,
        decimals: 8,
        liquidity: '0',
        volume_24h: '0',
        networkLogoURI: '',
      },
    ];
    render(<MobileTokenSelector />);
    fireEvent.change(screen.getByTestId('market-token-selector-search'), {
      target: { value: 'btc' },
    });
    fireEvent.click(screen.getByTestId('mobile-search-result'));
    expect(mockNavigateToMarketTokenDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: 'bitcoin',
        address: '',
        networkId: '',
      }),
      expect.anything(),
    );
  });

  it.each([false, true])(
    'keeps an explicit mobile search chain even when the result has assetId (native token: %s)',
    (isNative) => {
      const address = isNative ? '' : 'SolanaUsdc';
      mockMobileSearchTokenList = [
        {
          assetId: isNative ? 'solana' : 'usd-coin',
          network: 'sol--101',
          address,
          isNative,
          name: isNative ? 'Solana' : 'USD Coin',
          symbol: isNative ? 'SOL' : 'USDC',
          price: '1',
          logoUrl: '',
          decimals: 6,
          liquidity: '0',
          volume_24h: '0',
          networkLogoURI: '',
        },
      ];
      render(<MobileTokenSelector />);
      fireEvent.change(screen.getByTestId('market-token-selector-search'), {
        target: { value: 'usdc' },
      });
      fireEvent.click(screen.getByTestId('mobile-search-result'));
      expect(mockNavigateToMarketTokenDetail).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: undefined,
          networkId: 'sol--101',
          address,
          isNative,
        }),
        expect.anything(),
      );
    },
  );

  it('shows Favorites, Stocks, and Tokens instead of market categories', async () => {
    renderOpenStockSelector();

    const favoritesTab = screen.getByTestId(
      'market-token-selector-tab-favorites',
    );
    const stocksTab = screen.getByTestId('market-token-selector-tab-stocks');
    const tokensTab = screen.getByTestId('market-token-selector-tab-tokens');
    expect(
      favoritesTab.compareDocumentPosition(stocksTab) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      stocksTab.compareDocumentPosition(tokensTab) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByTestId('market-token-selector-tab-trending'),
    ).toBeNull();
    expect(
      screen.queryByTestId('market-token-selector-tab-top_coins'),
    ).toBeNull();

    fireEvent.click(tokensTab);

    await waitFor(() => {
      expect(screen.queryByTestId('stock-list')).toBeNull();
      expect(
        screen.getByTestId('token-list').getAttribute('data-category'),
      ).toBe('trending');
    });
  });

  it('shows stock and token subcategories under the primary tabs', () => {
    mockStockCategories = [
      { category: 'all', name: 'All' },
      { category: 'ai-chip', name: 'AI Tech' },
    ];
    renderOpenStockSelector();

    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('AI Tech')).toBeTruthy();
    expect(screen.queryByText('Trending')).toBeNull();

    fireEvent.click(screen.getByText('AI Tech'));
    expect(screen.getByTestId('stock-list').getAttribute('data-category')).toBe(
      'ai-chip',
    );

    fireEvent.click(screen.getByTestId('market-token-selector-tab-tokens'));
    expect(screen.getByText('Trending')).toBeTruthy();
    expect(screen.queryByText('AI Tech')).toBeNull();
    expect(screen.getByTestId('token-list').getAttribute('data-category')).toBe(
      'trending',
    );
  });

  it('does not use a stock category from the detail route as the token category', () => {
    mockRouteParams = { marketTokenCategory: 'stocks' };

    render(<MarketTokenSelector />);
    fireEvent.click(screen.getByTestId('market-token-selector-trigger'));

    expect(screen.getByTestId('token-list').getAttribute('data-category')).toBe(
      'trending',
    );
  });

  it('opens Tokens on the detail route category', () => {
    mockRouteParams = { marketTokenCategory: 'robinhood_meme' };
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'robinhood_meme', name: 'Robinhood' },
    ];

    render(<MarketTokenSelector />);
    fireEvent.click(screen.getByTestId('market-token-selector-trigger'));

    expect(screen.getByTestId('token-list').getAttribute('data-category')).toBe(
      'robinhood_meme',
    );
  });

  it('preserves the route category until remote categories finish loading', () => {
    mockSpotCategories = [];
    mockConfigLoading = true;
    const { result, rerender } = renderHook(() =>
      useDetailSelectorBrowseState({
        defaultCategory: 'trending',
        isWatchlistMode: false,
        marketTokenCategory: 'remote_category',
      }),
    );
    expect(result.current.tokenCategoryId).toBe('remote_category');
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'remote_category', name: 'Remote' },
    ];
    mockConfigLoading = false;
    rerender();
    expect(result.current.tokenCategoryId).toBe('remote_category');
  });

  it('falls back when the loaded configuration does not contain the route category', () => {
    mockConfigLoading = true;
    const { result, rerender } = renderHook(() =>
      useDetailSelectorBrowseState({
        defaultCategory: 'trending',
        isWatchlistMode: false,
        marketTokenCategory: 'removed_category',
      }),
    );
    expect(result.current.tokenCategoryId).toBe('removed_category');
    mockConfigLoading = false;
    rerender();
    expect(result.current.tokenCategoryId).toBe('trending');
  });

  it('replaces the current detail route when selecting a stock', () => {
    renderOpenStockSelector();

    expect(mockUseToMarketStockDetailPage).toHaveBeenCalledWith({
      replaceCurrentDetail: true,
    });
  });

  function renderOpenStockSelector() {
    render(<MarketTokenSelector defaultCategory="stocks" />);
    fireEvent.click(screen.getByTestId('market-token-selector-trigger'));
    expect(screen.getByTestId('stock-list')).toBeTruthy();
  }

  it('keeps Tokens selected when category config refreshes', async () => {
    renderOpenStockSelector();
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'stock', name: 'Stocks' },
    ];

    fireEvent.click(screen.getByTestId('market-token-selector-tab-tokens'));

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

  it.each([
    ['BTC', 'btc--0'],
    ['ETH', 'evm--1'],
  ])(
    'resolves %s from Favorites without a search query',
    (symbol, networkId) => {
      mockWatchlistToken = {
        id: symbol,
        symbol,
        name: symbol,
        address: '',
        networkId,
        isNative: true,
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
      };
      renderOpenStockSelector();
      fireEvent.click(
        screen.getByTestId('market-token-selector-tab-favorites'),
      );
      fireEvent.click(
        screen.getByTestId('market-token-selector-watchlist-result'),
      );

      expect(mockNavigateToMarketTokenDetail).toHaveBeenCalledWith(
        expect.objectContaining({ symbol, networkId, isNative: true }),
        expect.objectContaining({
          resolveMarketAsset: true,
          marketTokenCategory: undefined,
          tokenDetailPreview: expect.objectContaining({ symbol, networkId }),
        }),
      );
      expect(mockTopCoinPress).not.toHaveBeenCalled();
    },
  );

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
      expect.objectContaining({
        marketTokenCategory: undefined,
        resolveMarketAsset: true,
      }),
    );
  });

  it('replaces the current detail for a grouped stock search result', () => {
    render(<MarketTokenSelector defaultCategory="top_coins" />);
    fireEvent.click(screen.getByTestId('market-token-selector-trigger'));
    fireEvent.change(screen.getByTestId('market-token-selector-search'), {
      target: { value: 'AAPL' },
    });
    fireEvent.click(
      screen.getByTestId('market-token-selector-stock-search-result'),
    );

    expect(mockToStock).toHaveBeenCalledWith({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: 'apple.png',
      assetType: 'stock',
      currency: 'USD',
    });
    expect(mockNavigateToMarketTokenDetail).not.toHaveBeenCalled();
  });

  it('keeps chain search results on the token detail route', () => {
    mockSearchTokenList = [
      {
        id: 'dex-token',
        stock: { stockId: 'AAPL', subtitle: 'Apple', sourceLogoUri: '' },
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
      expect.objectContaining({
        resolveMarketAsset: true,
      }),
    );
    expect(mockToStock).not.toHaveBeenCalled();
  });

  it('replaces the current detail for a stock listing in search results', () => {
    mockSearchTokenList = [
      {
        id: 'stock-aapl',
        stockId: 'AAPL',
        name: 'Apple',
        symbol: 'AAPL',
        address: '',
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
        networkId: '',
      },
    ];

    render(<MarketTokenSelector defaultCategory="top_coins" />);
    fireEvent.click(screen.getByTestId('market-token-selector-trigger'));
    fireEvent.change(screen.getByTestId('market-token-selector-search'), {
      target: { value: 'AAPL' },
    });
    fireEvent.click(screen.getByTestId('market-token-selector-search-result'));

    expect(mockToStock).toHaveBeenCalledWith({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: '',
      tokenAddress: '',
      networkId: '',
      isNative: undefined,
    });
    expect(mockNavigateToMarketTokenDetail).not.toHaveBeenCalled();
  });
});

describe('Favorites category selection', () => {
  beforeEach(() => {
    mockConfigLoading = false;
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'robinhood_meme', name: 'Robinhood' },
    ];
    mockStockCategories = [
      { category: 'all', name: 'All' },
      { category: 'ai-chip', name: 'AI Tech' },
    ];
    mockRouteParams = undefined;
    mockSearchTokenList = [];
    mockMobileSearchTokenList = undefined;
  });

  it('keeps Favorites, Stocks, and Tokens categories independent across tab switches and config refreshes', () => {
    const { result, rerender } = renderHook(() =>
      useDetailSelectorBrowseState({
        defaultCategory: 'trending',
        isWatchlistMode: true,
      }),
    );
    expect(result.current.watchlistFilter).toBe('all');
    expect(result.current.subCategories.map(({ id }) => id)).toEqual([
      'all',
      'spot',
      'stocks',
    ]);
    act(() => result.current.handleSubCategoryChange('stocks'));
    expect(result.current.selectedSubCategoryId).toBe('stocks');
    mockConfigLoading = true;
    rerender();
    expect(result.current.watchlistFilter).toBe('stocks');
    act(() => result.current.handleBrowseTabChange('tokens'));
    expect(result.current.selectedSubCategoryId).toBe('trending');
    act(() => result.current.handleSubCategoryChange('robinhood_meme'));
    act(() => result.current.handleBrowseTabChange('stocks'));
    act(() => result.current.handleSubCategoryChange('ai-chip'));
    act(() => result.current.handleBrowseTabChange('favorites'));
    expect(result.current.selectedSubCategoryId).toBe('stocks');
    expect(result.current.tokenCategoryId).toBe('robinhood_meme');
    expect(result.current.stockCategoryId).toBe('ai-chip');
    act(() => result.current.handleSubCategoryChange('perps'));
    expect(result.current.watchlistFilter).toBe('stocks');
  });

  it.each(['desktop', 'mobile'])(
    'passes the selected Favorites category to the %s list and keeps keyword search separate',
    (platform) => {
      if (platform === 'mobile') {
        render(<MobileTokenSelector />);
      } else {
        render(<MarketTokenSelector />);
        fireEvent.click(screen.getByTestId('market-token-selector-trigger'));
      }
      fireEvent.click(
        screen.getByTestId('market-token-selector-tab-favorites'),
      );
      const listId = platform === 'mobile' ? 'mobile-favorites' : 'token-list';
      expect(screen.getByTestId(listId).getAttribute('data-filter')).toBe(
        'all',
      );
      fireEvent.click(screen.getByText('prime_crypto_payment__label'));
      expect(screen.getByTestId(listId).getAttribute('data-filter')).toBe(
        'spot',
      );
      fireEvent.change(screen.getByTestId('market-token-selector-search'), {
        target: { value: 'btc' },
      });
      expect(screen.queryByTestId(listId)).toBeNull();
    },
  );
});
