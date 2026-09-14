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

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketStockPublicListResponse } from '@onekeyhq/shared/types/marketV2';

import { MarketStockSelectorList } from './MarketStockSelectorList';
import { useMarketStockSelectorList } from './useMarketStockSelectorList';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/useMarketStockColumns',
  () => ({ useMarketStockColumns: () => [] }),
);

jest.mock('@onekeyhq/components', () => ({
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Spinner: () => <div data-testid="loading" />,
  Empty: () => <div data-testid="empty" />,
  ListEndIndicator: () => null,
  Table: ({
    dataSource,
    onEndReached,
  }: {
    dataSource: IMarketStockPublicListResponse['items'];
    onEndReached: () => void;
  }) => (
    <div data-testid="stock-table">
      {dataSource.map((item) => (
        <div key={item.stockId}>{item.symbol}</div>
      ))}
      <button type="button" onClick={onEndReached}>
        Load more
      </button>
    </div>
  ),
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: () => ({
    promise: Promise.resolve(null),
    reset: jest.fn(),
    resolve: jest.fn(),
  }),
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockList: jest.fn(),
      searchMarketStocks: jest.fn(),
    },
  },
}));

const fetchList = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarketV2.fetchMarketStockList,
);
const searchStocks = jest.mocked(
  // eslint-disable-next-line @typescript-eslint/unbound-method
  backgroundApiProxy.serviceMarketV2.searchMarketStocks,
);

const createStock = (stockId: string) => ({
  stockId,
  symbol: stockId,
  name: stockId,
  logoUrl: '',
  assetType: 'stock' as const,
  currency: 'USD' as const,
});

const firstPage: IMarketStockPublicListResponse = {
  items: [createStock('AAPL')],
  total: 2,
  nextCursor: 'next',
};
const secondPage: IMarketStockPublicListResponse = {
  items: [createStock('AAPL'), createStock('MSFT')],
  total: 2,
};

beforeEach(() => {
  fetchList.mockReset();
  searchStocks.mockReset();
});

it('loads selector pages and appends unique stocks', async () => {
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? secondPage : firstPage,
  );

  const { result } = renderHook(() =>
    useMarketStockSelectorList({ query: '  ' }),
  );
  await waitFor(() => expect(result.current.items).toEqual(firstPage.items));
  expect(result.current.canLoadMore).toBe(true);

  await act(async () => result.current.loadMore());

  await waitFor(() =>
    expect(result.current.items.map((item) => item.stockId)).toEqual([
      'AAPL',
      'MSFT',
    ]),
  );
  expect(fetchList).toHaveBeenNthCalledWith(1, { limit: 20 });
  expect(fetchList).toHaveBeenNthCalledWith(2, {
    cursor: 'next',
    limit: 20,
  });
  expect(result.current.canLoadMore).toBe(false);
});

it('passes the normalized query and cursor to search pages', async () => {
  searchStocks.mockImplementation(async (params) =>
    params.cursor ? secondPage : firstPage,
  );

  const { result } = renderHook(() =>
    useMarketStockSelectorList({ query: '  aapl  ' }),
  );
  await waitFor(() => expect(result.current.items).toEqual(firstPage.items));

  await act(async () => result.current.loadMore());

  await waitFor(() => expect(result.current.items).toHaveLength(2));
  expect(searchStocks).toHaveBeenNthCalledWith(1, {
    query: 'aapl',
    limit: 20,
  });
  expect(searchStocks).toHaveBeenNthCalledWith(2, {
    query: 'aapl',
    cursor: 'next',
    limit: 20,
  });
});

it('starts only one request for concurrent end-reached events', async () => {
  let resolveNextPage: (
    response: IMarketStockPublicListResponse,
  ) => void = () => undefined;
  const nextPage = new Promise<IMarketStockPublicListResponse>((resolve) => {
    resolveNextPage = resolve;
  });
  fetchList.mockImplementation(async (params) =>
    params?.cursor ? nextPage : firstPage,
  );

  const { result } = renderHook(() => useMarketStockSelectorList({}));
  await waitFor(() => expect(result.current.canLoadMore).toBe(true));

  let requests: Promise<void>[] = [];
  act(() => {
    requests = [result.current.loadMore(), result.current.loadMore()];
  });
  expect(
    fetchList.mock.calls.filter(([params]) => params?.cursor),
  ).toHaveLength(1);

  await act(async () => {
    resolveNextPage(secondPage);
    await Promise.all(requests);
  });
});

it.each([
  ['', 'mu'],
  ['mu', 'aapl'],
  ['mu', ''],
])(
  'replaces the table through loading when query changes from %s to %s',
  async (initialQuery, nextQuery) => {
    fetchList.mockResolvedValue(firstPage);
    searchStocks.mockResolvedValue(firstPage);
    const onItemPress = jest.fn();
    const { rerender } = render(
      <MarketStockSelectorList
        query={initialQuery}
        onItemPress={onItemPress}
      />,
    );
    const previousTable = await screen.findByTestId('stock-table');

    let resolveFirstPage: (
      response: IMarketStockPublicListResponse,
    ) => void = () => undefined;
    const pendingPage = new Promise<IMarketStockPublicListResponse>(
      (resolve) => {
        resolveFirstPage = resolve;
      },
    );
    fetchList.mockReturnValue(pendingPage);
    searchStocks.mockReturnValue(pendingPage);
    rerender(
      <MarketStockSelectorList query={nextQuery} onItemPress={onItemPress} />,
    );

    expect(screen.queryByTestId('stock-table')).toBeNull();
    expect(screen.getByTestId('loading')).toBeTruthy();
    expect(previousTable.isConnected).toBe(false);

    await act(async () => {
      resolveFirstPage({ items: [createStock('MU')], total: 1 });
      await pendingPage;
    });
    const nextTable = await screen.findByTestId('stock-table');
    expect(nextTable).not.toBe(previousTable);
    expect(nextTable.textContent).toContain('MU');
    expect(nextTable.textContent).not.toContain('AAPL');
  },
);

it('keeps the same table during pagination with the real selector hook', async () => {
  let resolvePage: (response: IMarketStockPublicListResponse) => void = () =>
    undefined;
  const pendingPage = new Promise<IMarketStockPublicListResponse>((resolve) => {
    resolvePage = resolve;
  });
  searchStocks.mockImplementation(async (params) =>
    params.cursor ? pendingPage : firstPage,
  );
  render(<MarketStockSelectorList query="aapl" onItemPress={jest.fn()} />);
  const table = await screen.findByTestId('stock-table');

  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await waitFor(() =>
    expect(searchStocks).toHaveBeenCalledWith({
      query: 'aapl',
      cursor: 'next',
      limit: 20,
    }),
  );
  expect(screen.getByTestId('stock-table')).toBe(table);

  await act(async () => {
    resolvePage(secondPage);
    await pendingPage;
  });
  await waitFor(() => expect(table.textContent).toContain('MSFT'));
  expect(screen.getByTestId('stock-table')).toBe(table);
});
