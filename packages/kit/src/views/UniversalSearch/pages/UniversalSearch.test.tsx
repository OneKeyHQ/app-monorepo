/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IMarketAssetDetailData,
  IMarketWatchListItemV2,
} from '@onekeyhq/shared/types/market';
import type { IMarketStockPublicItem } from '@onekeyhq/shared/types/marketV2';
import {
  EUniversalSearchSource,
  EUniversalSearchType,
} from '@onekeyhq/shared/types/search';
import type {
  IUniversalSearchBatchResult,
  IUniversalSearchPerp,
  IUniversalSearchResultItem,
  IUniversalSearchV2MarketToken,
} from '@onekeyhq/shared/types/search';

import { UniversalSearch } from './UniversalSearch';

let mockWatchlistItems: IMarketWatchListItemV2[] = [];
let mockResults: IUniversalSearchBatchResult = {};
let mockStocks: IMarketStockPublicItem[] = [];
const mockSearch = jest.fn(async () => mockResults);
const mockFetchAssetDetail = jest.fn<
  Promise<Pick<IMarketAssetDetailData, 'selectedVariant' | 'variants'>>,
  [{ assetId: string; autoHandleError: boolean }]
>();
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockEmptyTokens = {
  tokens: [],
  entries: [],
  itemByTokenId: new Map<string, IUniversalSearchV2MarketToken>(),
};
const mockStockResult = {
  total: 0,
  isLoading: false,
  isError: false,
  isLoadingMore: false,
  isLoadMoreError: false,
  canLoadMore: false,
  isRevalidatingFirstPage: false,
  loadMore: jest.fn(),
  refresh: jest.fn(),
};

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('use-debounce', () => ({
  useDebouncedCallback: (callback: unknown) => callback,
}));
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: string) =>
    jest.requireActual<typeof import('react')>('react').useRef({ value })
      .current,
}));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    View: Container,
    YStack: Container,
    XStack: Container,
    Stack: Container,
    ScrollView: Container,
    SizableText: Container,
    Skeleton: () => null,
    Icon: () => null,
    Spinner: () => <div data-testid="spinner" />,
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children: ReactNode;
      onPress: () => void;
      testID: string;
    }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    Empty: ({ title }: { title: string }) => <div>{title}</div>,
    SearchBar: ({
      value,
      onChangeText,
      onSearchTextChange,
    }: {
      value: string;
      onChangeText: (value: string) => void;
      onSearchTextChange: (value: string) => void;
    }) => (
      <input
        aria-label="Search"
        value={value}
        onChange={(event) => {
          onChangeText(event.target.value);
          onSearchTextChange(event.target.value);
        }}
      />
    ),
    Tabs: {
      TabBar: ({
        tabNames,
        onTabPress,
        focusedTab,
      }: {
        tabNames: string[];
        onTabPress: (name: string) => void;
        focusedTab: { value: string };
      }) => (
        <div>
          {tabNames.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={focusedTab.value === name}
              onClick={() => onTabPress(name)}
            >
              {name}
            </button>
          ))}
        </div>
      ),
    },
    SectionList: ({
      sections,
      renderItem,
      ListEmptyComponent,
      ListFooterComponent,
    }: {
      sections: { data: IUniversalSearchResultItem[] }[];
      renderItem: (info: { item: IUniversalSearchResultItem }) => ReactNode;
      ListEmptyComponent?: ReactNode;
      ListFooterComponent?: ReactNode;
    }) => (
      <div data-testid="results">
        {sections.length === 0
          ? ListEmptyComponent
          : sections.flatMap((section) =>
              section.data.map((item, index) => (
                <div key={index}>{renderItem({ item })}</div>
              )),
            )}
        {ListFooterComponent}
      </div>
    ),
    useMedia: () => ({ gtMd: true }),
    isLiquidGlassAvailable: () => false,
  };
});
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceUniversalSearch: {
      universalSearch: () => mockSearch(),
      universalSearchRecommend: async () => ({}),
    },
    serviceToken: { getAllAggregateTokenInfo: async () => ({}) },
    serviceMarket: {
      fetchMarketAssetDetail: (params: {
        assetId: string;
        autoHandleError: boolean;
      }) => mockFetchAssetDetail(params),
    },
  },
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: <T,>(callback: () => Promise<T>, deps: unknown[]) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [result, setResult] = React.useState<T>();
    React.useEffect(() => {
      let mounted = true;
      void callback().then((value) => {
        if (mounted) setResult(value);
      });
      return () => {
        mounted = false;
      };
      // Match the hook's caller-provided request dependencies.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return { result };
  },
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({}),
}));
jest.mock('../../../states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: mockWatchlistItems }],
}));
jest.mock('../../../states/jotai/contexts/tokenList/cells', () => ({
  useHomeTokenListSnapshot: () => ({ map: {}, tokens: [] }),
}));
jest.mock('../../../components/AccountSelector', () => ({}));
jest.mock('../../../components/ListItem', () => ({ ListItem: () => null }));
jest.mock('../../Home/components/HomeTokenListProvider', () => ({}));
jest.mock('../../Market/MarketWatchListProviderMirror', () => ({}));
jest.mock('../../Market/MarketWatchListProviderMirrorV2', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror',
  () => ({}),
);
jest.mock('./UniversalSearchProviderMirror', () => ({}));
jest.mock('./components/RecentSearched', () => ({
  RecentSearched: () => null,
}));
jest.mock('../components/MarketTableHeader', () => ({
  MarketTableHeader: () => null,
}));
jest.mock('../hooks/useSettingsSearch', () => ({
  useSettingsSearch: () => () => [],
}));
jest.mock('../hooks/useUniversalSearchMarketPress', () => ({
  useUniversalSearchMarketPress: () => jest.fn(),
}));
jest.mock('../components/SearchResultItems', () => {
  const Row = ({
    item,
    watchlistIdentity,
  }: {
    item: IUniversalSearchResultItem;
    watchlistIdentity?: IMarketWatchListItemV2;
  }) => (
    <span
      data-testid="result-row"
      data-asset-id={watchlistIdentity?.assetId}
      data-chain-id={watchlistIdentity?.chainId}
    >
      {'symbol' in item.payload ? item.payload.symbol : ''}
      {'name' in item.payload ? item.payload.name : ''}
    </span>
  );
  return {
    UniversalSearchV2MarketTokenItem: Row,
    UniversalSearchPerpItem: Row,
    UniversalSearchAddressItem: Row,
    UniversalSearchAccountAssetItem: Row,
    UniversalSearchDappItem: Row,
    UniversalSearchSettingsItem: Row,
  };
});
jest.mock('../components/UniversalSearchMarketResults', () => ({
  useUniversalSearchSelectorTokens: () => mockEmptyTokens,
  toUniversalSearchStockItem: (stock: IMarketStockPublicItem) => ({
    type: EUniversalSearchType.MarketStock,
    payload: { ...stock, network: '', address: '' },
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelectorSearchResults',
  () => ({
    MarketSearchSectionTitle: () => null,
    MarketSearchShowMoreButton: () => null,
    MarketSearchStockSection: () => null,
    MarketSearchTokenSection: () => null,
    SearchResultsSkeleton: () => null,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileMarketSelectorBrowseLists',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileMarketTokenSelectorSearchResults',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketTokenSelectorSearchState',
  () => ({
    useStockLoadMoreOnScrollEnd: () => undefined,
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketStockSelectorList',
  () => ({
    useMarketStockSelectorList: ({ query }: { query: string }) => ({
      ...mockStockResult,
      items: query ? mockStocks : [],
    }),
  }),
);
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    universalSearch: { search: { universalSearchQuery: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: {},
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true, isWebDappMode: false },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'normal' } }),
  },
}));

async function search(filterTypes?: EUniversalSearchType[]) {
  const view = render(
    <UniversalSearch
      source={EUniversalSearchSource.Unknown}
      filterTypes={filterTypes}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
    target: { value: 'match' },
  });
  await waitFor(() => expect(mockSearch).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      filterTypes?.includes(EUniversalSearchType.Dapp)
        ? screen.queryByText(ETranslations.global_no_results)
        : screen.queryByRole('button', { name: ETranslations.global_all }),
    ).toBeTruthy(),
  );
  return view;
}

beforeEach(() => {
  mockWatchlistItems = [];
  mockStocks = [];
  mockResults = {};
  mockSearch.mockClear();
  mockFetchAssetDetail.mockReset();
  mockStockResult.canLoadMore = false;
  mockStockResult.isLoadingMore = false;
  mockStockResult.isLoadMoreError = false;
  mockStockResult.isError = false;
  mockStockResult.loadMore.mockReset();
  mockStockResult.refresh.mockReset();
});

it('keeps Watchlist visible for default search and shows the empty-watchlist copy', async () => {
  await search();
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.global_watchlist }),
  );
  expect(
    screen
      .getByRole('button', { name: ETranslations.global_watchlist })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    screen.getByText(ETranslations.market_empty_watchlist_title),
  ).toBeTruthy();
});

it('filters complete token, stock and perps results and reacts to watchlist changes', async () => {
  const tokens = Array.from({ length: 7 }, (_, index) => ({
    type: EUniversalSearchType.V2MarketToken,
    payload: {
      network: 'evm--1',
      address: `0x${index}`,
      symbol: `TOKEN${index}`,
    },
  })) as IUniversalSearchV2MarketToken[];
  const perp = {
    type: EUniversalSearchType.Perp,
    payload: { assetType: 'perps', name: 'BTC' },
  } as IUniversalSearchPerp;
  mockResults = {
    [EUniversalSearchType.V2MarketToken]: { items: tokens },
    [EUniversalSearchType.Perp]: { items: [perp] },
  };
  mockStocks = [
    {
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
    },
  ];
  mockWatchlistItems = [
    { chainId: 'evm--1', contractAddress: '0x6' },
    { stockId: 'AAPL', chainId: '', contractAddress: '' },
    { perpsCoin: 'BTC', chainId: '', contractAddress: '' },
  ];
  await search();
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.global_watchlist }),
  );
  expect(
    screen.getAllByTestId('result-row').map((row) => row.textContent),
  ).toEqual(['AAPLApple', 'TOKEN6', 'BTC']);
  expect(screen.queryByText('TOKEN0')).toBeNull();

  mockWatchlistItems = [{ chainId: 'evm--1', contractAddress: '0xunknown' }];
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.global_all }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.global_watchlist }),
  );
  expect(screen.getByText(ETranslations.global_no_results)).toBeTruthy();
  expect(screen.queryByTestId('result-row')).toBeNull();
});

it('hides Watchlist for DApp-only searches', async () => {
  await search([EUniversalSearchType.Dapp]);
  expect(
    screen.queryByRole('button', { name: ETranslations.global_watchlist }),
  ).toBeNull();
});

const createStock = (stockId: string): IMarketStockPublicItem => ({
  stockId,
  symbol: stockId,
  name: stockId,
  logoUrl: '',
  assetType: 'stock',
  currency: 'USD',
});

it('loads filtered-out stock pages until a later favorite is found, then stops', async () => {
  mockStocks = Array.from({ length: 20 }, (_, index) =>
    createStock(`S${index}`),
  );
  mockWatchlistItems = [{ stockId: 'S40', chainId: '', contractAddress: '' }];
  mockStockResult.canLoadMore = true;
  mockStockResult.loadMore.mockImplementation(() => {
    mockStockResult.isLoadingMore = true;
  });
  const view = await search();
  expect(mockStockResult.loadMore).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.global_watchlist }),
  );
  expect(mockStockResult.loadMore).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('spinner')).toBeTruthy();
  expect(screen.queryByText(ETranslations.global_no_results)).toBeNull();

  const redraw = () =>
    view.rerender(<UniversalSearch source={EUniversalSearchSource.Unknown} />);
  redraw();
  expect(mockStockResult.loadMore).toHaveBeenCalledTimes(1);
  mockStocks = [
    ...mockStocks,
    ...Array.from({ length: 20 }, (_, index) => createStock(`S${index + 20}`)),
  ];
  mockStockResult.isLoadingMore = false;
  redraw();
  expect(mockStockResult.loadMore).toHaveBeenCalledTimes(2);

  redraw();
  expect(mockStockResult.loadMore).toHaveBeenCalledTimes(2);
  mockStocks = [...mockStocks, createStock('S40')];
  mockStockResult.isLoadingMore = false;
  redraw();
  expect(screen.getByText('S40S40')).toBeTruthy();
  expect(mockStockResult.loadMore).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId('spinner')).toBeNull();
});

it('offers retry for a failed Watchlist stock page and stops when pages are exhausted', async () => {
  mockStocks = [createStock('S0')];
  mockWatchlistItems = [
    { stockId: 'missing', chainId: '', contractAddress: '' },
  ];
  mockStockResult.canLoadMore = true;
  mockStockResult.isLoadMoreError = true;
  const view = await search();
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.global_watchlist }),
  );
  expect(mockStockResult.loadMore).not.toHaveBeenCalled();
  expect(screen.queryByText(ETranslations.global_no_results)).toBeNull();
  fireEvent.click(screen.getByTestId('universal-search-watchlist-stock-retry'));
  expect(mockStockResult.loadMore).toHaveBeenCalledTimes(1);

  mockStockResult.canLoadMore = false;
  mockStockResult.isLoadMoreError = false;
  view.rerender(<UniversalSearch source={EUniversalSearchSource.Unknown} />);
  expect(screen.getByText(ETranslations.global_no_results)).toBeTruthy();
  expect(
    screen.queryByTestId('universal-search-watchlist-stock-retry'),
  ).toBeNull();
  expect(mockStockResult.loadMore).toHaveBeenCalledTimes(1);
});

it('passes the matched asset favorite identity to a variant row', async () => {
  mockWatchlistItems = [
    { assetId: 'ethereum', chainId: '', contractAddress: '' },
  ];
  const token = {
    type: EUniversalSearchType.V2MarketToken,
    payload: { network: 'evm--1', address: '', symbol: 'ETH' },
  } as IUniversalSearchV2MarketToken;
  mockResults = { [EUniversalSearchType.V2MarketToken]: { items: [token] } };
  mockFetchAssetDetail.mockResolvedValue({
    selectedVariant: {
      variantId: 'eth',
      networkId: 'evm--1',
      tokenAddress: '',
      networkName: 'Ethereum',
      networkSymbol: 'ETH',
      networkLogoUrl: '',
      isNative: true,
      isDefault: true,
    },
    variants: [],
  });
  await search();
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.global_watchlist }),
  );
  await waitFor(() =>
    expect(screen.getByTestId('result-row').getAttribute('data-asset-id')).toBe(
      'ethereum',
    ),
  );
  expect(screen.getByTestId('result-row').getAttribute('data-chain-id')).toBe(
    '',
  );
});

it('retries a failed first stock page from Watchlist', async () => {
  mockWatchlistItems = [{ stockId: 'AAPL', chainId: '', contractAddress: '' }];
  mockStockResult.isError = true;
  await search();
  fireEvent.click(
    screen.getByRole('button', { name: ETranslations.global_watchlist }),
  );
  fireEvent.click(screen.getByTestId('universal-search-watchlist-stock-retry'));
  expect(mockStockResult.refresh).toHaveBeenCalledTimes(1);
  expect(mockStockResult.loadMore).not.toHaveBeenCalled();
});
