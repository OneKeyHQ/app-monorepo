/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
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
  Promise<unknown>,
  [{ assetId: string; autoHandleError: boolean }]
>();
let mockGtMd = true;
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
    useMedia: () => ({ gtMd: mockGtMd }),
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
  () => ({ MobileSelectorSearchSkeleton: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileMarketTokenSelectorSearchResults',
  () => ({
    MobileMarketSearchAllList: ({
      sections,
    }: {
      sections: { key: string; body: ReactNode }[];
    }) => (
      <div>
        {sections.map((section) => (
          <div key={section.key}>{section.body}</div>
        ))}
      </div>
    ),
    MobileMarketSearchStockRows: () => null,
    MobileMarketSearchTokenRows: () => null,
    MobileMarketSearchSectionTitle: () => null,
    MobileMarketSearchShowMoreButton: () => null,
  }),
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
  mockGtMd = true;
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

describe.each([
  ['desktop', true],
  ['mobile', false],
] as const)('search tabs on %s', (_layout, gtMd) => {
  beforeEach(() => {
    mockGtMd = gtMd;
  });

  it('hides Watchlist when the query has no results', async () => {
    await search();
    expect(
      screen.queryByRole('button', { name: ETranslations.global_watchlist }),
    ).toBeNull();
    expect(
      screen
        .getByRole('button', { name: ETranslations.global_all })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText(ETranslations.global_no_results)).toBeTruthy();
  });

  it.each([false, true])(
    'keeps result tabs without Watchlist when saved favorites=%s',
    async (hasFavorites) => {
      mockWatchlistItems = hasFavorites
        ? [
            { assetId: 'ethereum', chainId: '', contractAddress: '' },
            { stockId: 'ETHA', chainId: '', contractAddress: '' },
          ]
        : [];
      mockResults = {
        [EUniversalSearchType.V2MarketToken]: {
          items: [
            {
              type: EUniversalSearchType.V2MarketToken,
              payload: { network: 'evm--1', address: '', symbol: 'ETH' },
            } as IUniversalSearchV2MarketToken,
          ],
        },
        [EUniversalSearchType.Perp]: {
          items: [
            {
              type: EUniversalSearchType.Perp,
              payload: { assetType: 'perps', name: 'ETH' },
            } as IUniversalSearchPerp,
          ],
        },
      };
      mockStocks = [
        {
          stockId: 'ETHA',
          symbol: 'ETHA',
          name: 'Ethereum ETF',
          logoUrl: '',
          assetType: 'stock',
          currency: 'USD',
        },
      ];
      mockStockResult.canLoadMore = true;
      await search();
      expect(
        screen.queryByRole('button', { name: ETranslations.global_watchlist }),
      ).toBeNull();
      for (const title of [
        ETranslations.global_all,
        ETranslations.perps_token_selector_stocks,
        ETranslations.global_universal_search_tabs_tokens,
        ETranslations.global_perp,
      ]) {
        expect(screen.getByRole('button', { name: title })).toBeTruthy();
      }
      fireEvent.click(
        screen.getByRole('button', { name: ETranslations.global_perp }),
      );
      expect(
        screen
          .getByRole('button', { name: ETranslations.global_perp })
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(screen.getByTestId('result-row').textContent).toBe('ETH');
      expect(mockFetchAssetDetail).not.toHaveBeenCalled();
      expect(mockStockResult.loadMore).not.toHaveBeenCalled();
    },
  );

  it('does not restore Watchlist after clearing and retyping a query', async () => {
    await search();
    const input = screen.getByRole('textbox', { name: 'Search' });
    fireEvent.change(input, { target: { value: '' } });
    expect(
      screen.queryByRole('button', { name: ETranslations.global_watchlist }),
    ).toBeNull();
    fireEvent.change(input, { target: { value: 'ETH' } });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: ETranslations.global_all }),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByRole('button', { name: ETranslations.global_watchlist }),
    ).toBeNull();
  });
});

it('keeps Watchlist hidden for DApp-only searches', async () => {
  await search([EUniversalSearchType.Dapp]);
  expect(
    screen.queryByRole('button', { name: ETranslations.global_watchlist }),
  ).toBeNull();
});
