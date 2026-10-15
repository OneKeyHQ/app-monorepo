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

import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketAssetListData,
  IMarketAssetListItem,
} from '@onekeyhq/shared/types/market';

import { useMarketTopCoins } from '../../../MarketHomeV2/components/MarketTopCoinsList/hooks/useMarketTopCoins';

import { MarketTokenSelectorList } from './MarketTokenSelectorList';

import type { useMarketWatchlistTokenList } from '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList';

const mockWatchlistResult = jest.fn<
  Pick<
    ReturnType<typeof useMarketWatchlistTokenList>,
    'data' | 'isLoading' | 'isError' | 'refetch'
  >,
  Parameters<typeof useMarketWatchlistTokenList>
>();
const mockFetchTopCoins = jest.fn<Promise<IMarketAssetListData>, [string]>();
const mockDeferred = {
  promise: Promise.resolve(),
  resolve: jest.fn(),
  reset: jest.fn(),
};
jest.mock(
  '../../../MarketHomeV2/components/MarketTopCoinsList/hooks/marketTopCoinsPlatformApi',
  () => ({
    fetchMarketTopCoinsForPlatform: (type: string) => mockFetchTopCoins(type),
  }),
);
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock(
  '../../../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage',
  () => ({ useToDetailPage: () => jest.fn() }),
);
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isDesktop: true, isWeb: false },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useDeferredPromise: () => mockDeferred,
  useNetInfo: () => ({ isRawInternetReachable: true }),
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Spinner: () => <div data-testid="loading" />,
  Empty: ({ title }: { title: string }) => <div>{title}</div>,
  Button: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress: () => void;
    testID: string;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  ListView: ({ data }: { data: { symbol: string }[] }) => (
    <div data-testid="list">{data.map((item) => item.symbol).join(',')}</div>
  ),
}));
jest.mock(
  '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList',
  () => ({ useMarketTokenList: jest.fn() }),
);
jest.mock(
  '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList',
  () => ({
    useMarketWatchlistTokenList: (
      ...args: Parameters<typeof useMarketWatchlistTokenList>
    ) => mockWatchlistResult(...args),
  }),
);
jest.mock('./SelectorWatchlistRecommendations', () => ({
  SelectorWatchlistRecommendations: () => (
    <div data-testid="recommendations">Recommend tokens</div>
  ),
}));

jest.mock('./MarketTokenSelectorRow', () => ({
  MarketTokenSelectorRow: () => null,
}));
jest.mock('./selectorTable', () => ({
  SelectorTableHeader: () => <div data-testid="header" />,
}));
jest.mock('../../../MarketHomeV2/utils', () => ({
  isTrendingStyleSpotCategory: () => false,
}));
jest.mock('../../utils/marketDetailPreview', () => ({
  buildMarketSearchTokenDetailPreview: jest.fn(),
}));

const bitcoin: IMarketAssetListItem = {
  assetId: 'bitcoin',
  symbol: 'BTC',
  price: '100',
  volume24h: '1',
  marketCap: '1',
  logoUrl: '',
  priceChange24hPercent: '0',
  priceChange7dPercent: '0',
  sparkline24h: [],
};

function TopCoinsSelector() {
  const { data, isLoading, isError, refresh } = useMarketTopCoins();
  return (
    <MarketTokenSelectorList
      networkId=""
      onItemPress={jest.fn()}
      dataOverride={data.map((item) => ({
        id: item.assetId,
        name: item.symbol,
        symbol: item.symbol,
        address: '',
        networkId: '',
        decimals: 0,
        price: 0,
        change24h: 0,
        marketCap: 0,
        liquidity: 0,
        transactions: 0,
        uniqueTraders: 0,
        holders: 0,
        turnover: 0,
        tokenImageUri: '',
        networkLogoUri: '',
      }))}
      dataOverrideLoading={isLoading}
      dataOverrideError={isError}
      onDataOverrideRetry={() => void refresh()}
    />
  );
}

describe('desktop Top Coins request states', () => {
  beforeEach(() => {
    mockFetchTopCoins.mockReset();
  });

  it.each(['desktop', 'web'])(
    'recovers from a %s request failure through the retry button',
    async (platform) => {
      platformEnv.isDesktop = platform === 'desktop';
      platformEnv.isWeb = platform === 'web';
      mockFetchTopCoins
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ list: [bitcoin], total: 1 });
      render(<TopCoinsSelector />);
      fireEvent.click(
        await screen.findByTestId('market-token-selector-list-retry'),
      );
      await waitFor(() =>
        expect(screen.getByTestId('list').textContent).toBe('BTC'),
      );
      expect(mockFetchTopCoins).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByTestId('market-token-selector-list-retry'),
      ).toBeNull();
    },
  );

  it('retains cached rows when a desktop refresh fails and clears the error on success', async () => {
    platformEnv.isDesktop = true;
    platformEnv.isWeb = false;
    mockFetchTopCoins
      .mockResolvedValueOnce({ list: [bitcoin], total: 1 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ list: [bitcoin], total: 1 });
    const { result } = renderHook(() => useMarketTopCoins());
    await waitFor(() => expect(result.current.data).toEqual([bitcoin]));
    await act(async () => result.current.refresh());
    expect(result.current.data).toEqual([bitcoin]);
    expect(result.current.isError).toBe(true);
    await act(async () => result.current.refresh());
    expect(result.current.data).toEqual([bitcoin]);
    expect(result.current.isError).toBe(false);
  });

  it('offers a retry after an empty failed request and returns to loading on retry', () => {
    const onRetry = jest.fn();
    const { rerender } = render(
      <MarketTokenSelectorList
        networkId=""
        onItemPress={jest.fn()}
        dataOverride={[]}
        dataOverrideError
        onDataOverrideRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.queryByTestId('list')).toBeNull();
    fireEvent.click(screen.getByTestId('market-token-selector-list-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(
      <MarketTokenSelectorList
        networkId=""
        onItemPress={jest.fn()}
        dataOverride={[]}
        dataOverrideLoading
        onDataOverrideRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('loading')).toBeTruthy();
    expect(screen.queryByTestId('market-token-selector-list-retry')).toBeNull();
  });
});

const mockWatchlistAtom = jest.mocked(useMarketWatchListV2Atom);

describe('desktop selector recommendations', () => {
  beforeEach(() => {
    mockWatchlistAtom.mockReturnValue([
      { data: [], isMounted: true },
      jest.fn(),
    ]);
    mockWatchlistResult.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  it('shows recommendations instead of a column header for empty Favorites', () => {
    render(
      <MarketTokenSelectorList
        networkId=""
        isWatchlistMode
        onItemPress={jest.fn()}
      />,
    );
    expect(screen.getByTestId('recommendations')).toBeTruthy();
    expect(screen.queryByTestId('header')).toBeNull();
    expect(mockWatchlistResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageSize: 1 }),
    );
  });

  it.each(['initializing', 'loading', 'error'])(
    'keeps %s separate from an empty watchlist',
    (state) => {
      mockWatchlistAtom.mockReturnValue([
        { data: [], isMounted: state !== 'initializing' },
        jest.fn(),
      ]);
      mockWatchlistResult.mockReturnValue({
        data: [],
        isLoading: state === 'loading',
        isError: state === 'error',
        refetch: jest.fn(),
      });
      render(
        <MarketTokenSelectorList
          networkId=""
          isWatchlistMode
          onItemPress={jest.fn()}
        />,
      );
      expect(screen.queryByTestId('recommendations')).toBeNull();
      expect(screen.getByTestId('header')).toBeTruthy();
    },
  );

  it('does not truncate the selectable favorites after a page of perps', () => {
    mockWatchlistAtom.mockReturnValue([
      {
        data: Array.from({ length: 101 }, () => ({
          chainId: 'evm--1',
          contractAddress: '',
        })),
        isMounted: true,
      },
      jest.fn(),
    ]);
    mockWatchlistResult.mockImplementation(({ pageSize = 20 }) => ({
      data: Array.from({ length: 101 }, (_, i) => ({
        id: String(i),
        symbol: `TOKEN${i}`,
        name: `Token ${i}`,
        stockId: undefined,
        address: '',
        networkId: '',
        decimals: 0,
        price: 0,
        change24h: 0,
        marketCap: 0,
        liquidity: 0,
        transactions: 0,
        uniqueTraders: 0,
        holders: 0,
        turnover: 0,
        tokenImageUri: '',
        networkLogoUri: '',
        perpsCoin: i < 100 ? `PERP${i}` : undefined,
      })).slice(0, pageSize),
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    }));
    render(
      <MarketTokenSelectorList
        networkId=""
        isWatchlistMode
        onItemPress={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('recommendations')).toBeNull();
    expect(screen.getByTestId('list').textContent).toBe('TOKEN100');
  });
});
