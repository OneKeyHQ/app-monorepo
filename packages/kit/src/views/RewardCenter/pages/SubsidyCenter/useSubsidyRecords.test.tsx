/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/views/RewardCenter/pages/SubsidyCenter/useSubsidyRecords.test.tsx
*/
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  clearSubsidyRecordsCache,
  refreshSubsidyRecords,
  useSubsidyHistoryPage,
  useSubsidyIdentity,
  useSubsidyRecentHistory,
  useSubsidyRecordsRefresh,
  useSubsidySummary,
} from './useSubsidyRecords';

const mockFetchSubsidyHistory: jest.Mock<
  Promise<unknown>,
  unknown[]
> = jest.fn();
const mockFetchSubsidySummary: jest.Mock<
  Promise<unknown>,
  unknown[]
> = jest.fn();
const mockGetNetworksByIds: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();
const mockUseOneKeyAuth: jest.Mock<
  { isLoggedIn: boolean; user: { onekeyUserId?: string } },
  []
> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceGas: {
      fetchSubsidyHistory: (...args: unknown[]) =>
        mockFetchSubsidyHistory(...args),
      fetchSubsidySummary: (...args: unknown[]) =>
        mockFetchSubsidySummary(...args),
    },
    serviceNetwork: {
      getNetworksByIds: (...args: unknown[]) => mockGetNetworksByIds(...args),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => mockUseOneKeyAuth(),
}));

const tronRecord = {
  id: 'tron_energy:attempt-1',
  kind: 'tron_energy',
  operation: 'free_claim',
  networkId: 'tron--0x2b6653dc',
  address: 'TAddress',
  createdAt: '2026-11-09T01:41:00.000Z',
  resolvedAt: null,
  state: 'supplier_accepted',
  transaction: null,
};

function historyResponse(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1,
    subjectScope: 'canonical',
    items: [tronRecord],
    nextCursor: null,
    complete: true,
    sources: [],
    total: 1,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  clearSubsidyRecordsCache();
  mockGetNetworksByIds.mockResolvedValue({
    networks: [{ id: 'tron--0x2b6653dc', name: 'Tron' }],
  });
});

describe('useSubsidyIdentity', () => {
  it('is undefined while signed out', () => {
    mockUseOneKeyAuth.mockReturnValue({ isLoggedIn: false, user: {} });
    expect(renderHook(() => useSubsidyIdentity()).result.current).toBe(
      undefined,
    );
  });

  it('is the OneKey ID of the signed-in user', () => {
    mockUseOneKeyAuth.mockReturnValue({
      isLoggedIn: true,
      user: { onekeyUserId: 'user-a' },
    });
    expect(renderHook(() => useSubsidyIdentity()).result.current).toBe(
      'user-a',
    );
  });
});

describe('useSubsidyRecentHistory', () => {
  it('sends nothing while signed out', async () => {
    const { result } = renderHook(() => useSubsidyRecentHistory(undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchSubsidyHistory).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it('loads the first page once and names the network of each record', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(historyResponse());

    const { result } = renderHook(() => useSubsidyRecentHistory('user-a'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(1);
    // The member the result is for travels with the request, so the service
    // can refuse to answer it as anyone else.
    expect(mockFetchSubsidyHistory).toHaveBeenCalledWith({
      onekeyUserId: 'user-a',
      limit: 6,
      page: undefined,
    });
    expect(result.current.data).toEqual({
      items: [
        expect.objectContaining({
          id: 'tron_energy:attempt-1',
          title: '免费领取能量',
          statusLabel: '已受理',
          networkName: 'Tron',
        }),
      ],
      isPartial: false,
      hasMore: false,
      total: 1,
    });
  });

  it('falls back to the network id when the network cannot be resolved', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(historyResponse());
    mockGetNetworksByIds.mockRejectedValue(new Error('network lookup failed'));

    const { result } = renderHook(() => useSubsidyRecentHistory('user-a'));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.items[0].networkName).toBe('tron--0x2b6653dc');
    expect(result.current.isError).toBe(false);
  });

  it('reports a partial result and a further page separately from empty', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(
      historyResponse({ items: [], complete: false, nextCursor: 'cursor-1' }),
    );

    const { result } = renderHook(() => useSubsidyRecentHistory('user-a'));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      items: [],
      isPartial: true,
      hasMore: true,
      total: 1,
    });
  });

  it.each([
    ['null', null],
    ['missing', undefined],
  ])('reports an unknown total when the count is %s', async (_name, total) => {
    mockFetchSubsidyHistory.mockResolvedValue(historyResponse({ total }));

    const { result } = renderHook(() => useSubsidyRecentHistory('user-a'));

    await waitFor(() => expect(result.current.data).toBeDefined());
    // Unknown is not zero: the caller hides the count instead of showing 0.
    expect(result.current.data?.total).toBeNull();
  });

  it('turns a failed query into an error state that a reload clears', async () => {
    mockFetchSubsidyHistory.mockRejectedValueOnce(new Error('90801'));
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());

    const { result } = renderHook(() => useSubsidyRecentHistory('user-a'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.isError).toBe(false);
    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(2);
  });

  it('keeps the list on screen while a reload is in flight, then replaces it', async () => {
    const refreshed = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());
    mockFetchSubsidyHistory.mockReturnValueOnce(refreshed.promise);

    const { result } = renderHook(() => useSubsidyRecentHistory('user-a'));
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.reload());

    // No skeleton flash: the first page stays visible during the refresh.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data?.items).toHaveLength(1);

    await act(async () => {
      refreshed.resolve(
        historyResponse({
          items: [{ ...tronRecord, id: 'tron_energy:attempt-2' }, tronRecord],
        }),
      );
      await refreshed.promise;
    });

    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));
    expect(result.current.data?.items[0].id).toBe('tron_energy:attempt-2');
  });

  it('keeps the list when a reload fails instead of showing an error', async () => {
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());
    mockFetchSubsidyHistory.mockRejectedValueOnce(new Error('90804'));

    const { result } = renderHook(() => useSubsidyRecentHistory('user-a'));
    await waitFor(() => expect(result.current.data).toBeDefined());

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() =>
      expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(2),
    );
    expect(result.current.isError).toBe(false);
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('paints the last result at once on reopen and refreshes behind it', async () => {
    const refreshed = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());
    mockFetchSubsidyHistory.mockReturnValueOnce(refreshed.promise);

    const first = renderHook(() => useSubsidyRecentHistory('user-a'));
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();

    // Reopening the page: no placeholder frame, so nothing reflows.
    const second = renderHook(() => useSubsidyRecentHistory('user-a'));
    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.data?.items).toHaveLength(1);
    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(2);

    await act(async () => {
      refreshed.resolve(historyResponse({ items: [] }));
      await refreshed.promise;
    });
    await waitFor(() =>
      expect(second.result.current.data?.items).toHaveLength(0),
    );
  });

  it('never paints the cached records of another user', async () => {
    const pending = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());
    mockFetchSubsidyHistory.mockReturnValueOnce(pending.promise);

    const first = renderHook(() => useSubsidyRecentHistory('user-a'));
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();

    const second = renderHook(() => useSubsidyRecentHistory('user-b'));
    expect(second.result.current.data).toBeUndefined();
    expect(second.result.current.isLoading).toBe(true);
    second.unmount();
  });

  it('caches nothing for a session without a OneKey ID', async () => {
    mockUseOneKeyAuth.mockReturnValue({ isLoggedIn: true, user: {} });
    const identity = renderHook(() => useSubsidyIdentity()).result.current;
    mockFetchSubsidyHistory.mockResolvedValue(historyResponse());

    const first = renderHook(() => useSubsidyRecentHistory(identity));
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    expect(mockFetchSubsidyHistory).toHaveBeenCalledWith(
      expect.objectContaining({ onekeyUserId: undefined }),
    );
    first.unmount();

    const second = renderHook(() => useSubsidyRecentHistory(identity));
    expect(second.result.current.data).toBeUndefined();
    expect(second.result.current.isLoading).toBe(true);
    second.unmount();
  });

  it('shows nothing of the previous user in any render after an account switch', async () => {
    const forUserB = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());
    mockFetchSubsidyHistory.mockReturnValueOnce(forUserB.promise);
    // Every render, including the one between the identity change and the
    // effect that reacts to it.
    const renders: { identity: string; hasData: boolean; loading: boolean }[] =
      [];

    const { result, rerender } = renderHook(
      ({ identity }: { identity: string }) => {
        const query = useSubsidyRecentHistory(identity);
        renders.push({
          identity,
          hasData: query.data !== undefined,
          loading: query.isLoading,
        });
        return query;
      },
      { initialProps: { identity: 'user-a' } },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ identity: 'user-b' });

    const rendersForUserB = renders.filter((r) => r.identity === 'user-b');
    expect(rendersForUserB.length).toBeGreaterThan(0);
    expect(rendersForUserB.every((r) => !r.hasData && r.loading)).toBe(true);

    await act(async () => {
      forUserB.resolve(historyResponse({ items: [] }));
      await forUserB.promise;
    });
    await waitFor(() => expect(result.current.data?.items).toEqual([]));
  });

  it('drops the records of the previous user after an account switch', async () => {
    const first = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockReturnValueOnce(first.promise);
    mockFetchSubsidyHistory.mockResolvedValueOnce(
      historyResponse({ items: [] }),
    );

    const { result, rerender } = renderHook(
      ({ identity }: { identity: string | undefined }) =>
        useSubsidyRecentHistory(identity),
      { initialProps: { identity: 'user-a' } },
    );
    rerender({ identity: 'user-b' });
    await waitFor(() => expect(result.current.data).toBeDefined());

    // The slower response of the first user arrives last and must be ignored.
    await act(async () => {
      first.resolve(historyResponse());
      await first.promise;
    });

    expect(result.current.data?.items).toEqual([]);
  });

  it('clears the records on sign-out', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(historyResponse());

    const { result, rerender } = renderHook(
      ({ identity }: { identity: string | undefined }) =>
        useSubsidyRecentHistory(identity),
      { initialProps: { identity: 'user-a' as string | undefined } },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ identity: undefined });

    // Gone in the same render, not one effect later.
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('loads again when an issuance is reported', async () => {
    mockFetchSubsidyHistory.mockResolvedValueOnce(
      historyResponse({ items: [], total: 0 }),
    );
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());
    const { result } = renderHook(() => useSubsidyRecentHistory('user-a'));
    await waitFor(() => expect(result.current.data?.total).toBe(0));

    act(() => refreshSubsidyRecords('user-a'));

    // The current list stays up while the new one loads.
    expect(result.current.data?.total).toBe(0);
    expect(result.current.isFetching).toBe(true);
    await waitFor(() => expect(result.current.data?.total).toBe(1));
    expect(result.current.isFetching).toBe(false);
  });

  it('ignores an issuance reported for another member', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(historyResponse());
    const { result } = renderHook(() => useSubsidyRecentHistory('user-b'));
    await waitFor(() => expect(result.current.data).toBeDefined());

    // A claim the previous member started before signing out completes now.
    act(() => refreshSubsidyRecords('user-a'));

    expect(result.current.isFetching).toBe(false);
    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(1);
  });

  it('starts nothing for a page that was closed before the issuance finished', async () => {
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());
    const { result, unmount } = renderHook(() =>
      useSubsidyRecentHistory('user-a'),
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    const { reload } = result.current;
    unmount();
    // Whoever is signed in by now would answer a request sent this late.
    mockFetchSubsidyHistory.mockResolvedValue(
      historyResponse({ items: [], total: 0 }),
    );

    act(() => {
      refreshSubsidyRecords('user-a');
      reload();
    });

    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(1);
    // The first user's cache still holds the first user's records.
    mockFetchSubsidyHistory.mockReturnValue(new Promise(() => {}));
    const reopened = renderHook(() => useSubsidyRecentHistory('user-a'));
    expect(reopened.result.current.data?.total).toBe(1);
    reopened.unmount();
  });
});

describe('useSubsidyHistoryPage', () => {
  const pageOf = (id: string, overrides: Record<string, unknown> = {}) =>
    historyResponse({ items: [{ ...tronRecord, id }], ...overrides });

  it('sends nothing until the list has been measured', async () => {
    const { result, rerender } = renderHook(
      ({ pageSize }: { pageSize: number | undefined }) =>
        useSubsidyHistoryPage('user-a', { page: 1, pageSize }),
      { initialProps: { pageSize: undefined as number | undefined } },
    );

    expect(result.current.isLoading).toBe(true);
    expect(mockFetchSubsidyHistory).not.toHaveBeenCalled();

    mockFetchSubsidyHistory.mockResolvedValue(pageOf('tron_energy:1'));
    rerender({ pageSize: 7 });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(1);
  });

  it('asks for the plain first page, which carries the total', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(
      pageOf('tron_energy:1', { total: 15 }),
    );

    const { result } = renderHook(() =>
      useSubsidyHistoryPage('user-a', { page: 1, pageSize: 7 }),
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockFetchSubsidyHistory).toHaveBeenCalledWith({
      onekeyUserId: 'user-a',
      limit: 7,
      page: undefined,
    });
    expect(result.current.data?.total).toBe(15);
  });

  it('jumps to a page by number and leaves its total undefined', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(
      pageOf('tron_energy:15', { total: undefined }),
    );

    const { result } = renderHook(() =>
      useSubsidyHistoryPage('user-a', { page: 3, pageSize: 7 }),
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockFetchSubsidyHistory).toHaveBeenCalledWith({
      onekeyUserId: 'user-a',
      limit: 7,
      page: 3,
    });
    // Later pages omit the total; the first page's value stands.
    expect(result.current.data?.total).toBeUndefined();
  });

  it('keeps the previous page on screen while the next one loads', async () => {
    const next = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockResolvedValueOnce(pageOf('tron_energy:1'));
    mockFetchSubsidyHistory.mockReturnValueOnce(next.promise);

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useSubsidyHistoryPage('user-a', { page, pageSize: 7 }),
      { initialProps: { page: 1 } },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.isPreviousData).toBe(false);

    rerender({ page: 2 });

    // No blank list between pages; the rows are flagged as the old page.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPreviousData).toBe(true);
    expect(result.current.data?.items[0].id).toBe('tron_energy:1');

    await act(async () => {
      next.resolve(pageOf('tron_energy:8', { total: undefined }));
      await next.promise;
    });

    await waitFor(() => expect(result.current.isPreviousData).toBe(false));
    expect(result.current.data?.items[0].id).toBe('tron_energy:8');
  });

  it('shows a retry instead of the previous page when the next page fails', async () => {
    mockFetchSubsidyHistory.mockResolvedValueOnce(pageOf('tron_energy:1'));
    mockFetchSubsidyHistory.mockRejectedValueOnce(new Error('90801'));

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useSubsidyHistoryPage('user-a', { page, pageSize: 7 }),
      { initialProps: { page: 1 } },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ page: 2 });

    // Page 1's rows under "page 2" would be mislabelled.
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('returns to a visited page from the cache and refreshes it', async () => {
    mockFetchSubsidyHistory.mockResolvedValueOnce(pageOf('tron_energy:1'));
    mockFetchSubsidyHistory.mockResolvedValueOnce(
      pageOf('tron_energy:8', { total: undefined }),
    );
    const refreshed = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockReturnValueOnce(refreshed.promise);

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useSubsidyHistoryPage('user-a', { page, pageSize: 7 }),
      { initialProps: { page: 1 } },
    );
    await waitFor(() =>
      expect(result.current.data?.items[0].id).toBe('tron_energy:1'),
    );
    rerender({ page: 2 });
    await waitFor(() =>
      expect(result.current.data?.items[0].id).toBe('tron_energy:8'),
    );

    rerender({ page: 1 });

    expect(result.current.isPreviousData).toBe(false);
    expect(result.current.data?.items[0].id).toBe('tron_energy:1');
    // Painted from the cache, but not settled: the list must not act on it
    // (an empty cached page is not proof that the page is past the end).
    expect(result.current.isFetching).toBe(true);
    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(3);
    await act(async () => {
      refreshed.resolve(pageOf('tron_energy:0'));
      await refreshed.promise;
    });
    await waitFor(() =>
      expect(result.current.data?.items[0].id).toBe('tron_energy:0'),
    );
    expect(result.current.isFetching).toBe(false);
  });

  it('forgets cached pages after an issuance and leaves the reload to the list', async () => {
    mockFetchSubsidyHistory.mockResolvedValueOnce(pageOf('tron_energy:1'));
    mockFetchSubsidyHistory.mockResolvedValueOnce(
      pageOf('tron_energy:8', { total: undefined }),
    );
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useSubsidyHistoryPage('user-a', { page, pageSize: 7 }),
      { initialProps: { page: 1 } },
    );
    await waitFor(() =>
      expect(result.current.data?.items[0].id).toBe('tron_energy:1'),
    );
    rerender({ page: 2 });
    await waitFor(() =>
      expect(result.current.data?.items[0].id).toBe('tron_energy:8'),
    );

    act(() => refreshSubsidyRecords('user-a'));

    // The list decides which page to load (it returns to page 1), so the
    // hook sends nothing by itself.
    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(2);
    const fresh = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockReturnValueOnce(fresh.promise);
    rerender({ page: 1 });
    // Page 1 was cached before the issuance; that copy is gone, so page 2
    // stays up (dimmed) instead of a first page that misses the new record.
    expect(result.current.isPreviousData).toBe(true);
    await act(async () => {
      fresh.resolve(pageOf('tron_energy:0'));
      await fresh.promise;
    });
    await waitFor(() =>
      expect(result.current.data?.items[0].id).toBe('tron_energy:0'),
    );
  });

  it('keeps the cached pages of a member when another member is issued a subsidy', async () => {
    mockFetchSubsidyHistory.mockResolvedValueOnce(pageOf('tron_energy:1'));
    mockFetchSubsidyHistory.mockResolvedValueOnce(
      pageOf('tron_energy:8', { total: undefined }),
    );
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useSubsidyHistoryPage('user-b', { page, pageSize: 7 }),
      { initialProps: { page: 1 } },
    );
    await waitFor(() =>
      expect(result.current.data?.items[0].id).toBe('tron_energy:1'),
    );
    rerender({ page: 2 });
    await waitFor(() =>
      expect(result.current.data?.items[0].id).toBe('tron_energy:8'),
    );

    act(() => refreshSubsidyRecords('user-a'));

    mockFetchSubsidyHistory.mockReturnValueOnce(new Promise(() => {}));
    rerender({ page: 1 });
    // This member's pages did not move: page 1 is painted from the cache.
    expect(result.current.isPreviousData).toBe(false);
    expect(result.current.data?.items[0].id).toBe('tron_energy:1');
  });

  it('starts over when the page size changes', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(pageOf('tron_energy:1'));

    const { result, rerender } = renderHook(
      ({ pageSize }: { pageSize: number }) =>
        useSubsidyHistoryPage('user-a', { page: 1, pageSize }),
      { initialProps: { pageSize: 7 } },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ pageSize: 6 });

    await waitFor(() =>
      expect(mockFetchSubsidyHistory).toHaveBeenLastCalledWith({
        onekeyUserId: 'user-a',
        limit: 6,
        page: undefined,
      }),
    );
  });
});

describe('useSubsidyRecordsRefresh', () => {
  it('answers only the issuances of the member it is mounted for', () => {
    const listener = jest.fn();
    const { rerender, unmount } = renderHook(
      ({ identity }: { identity: string | undefined }) =>
        useSubsidyRecordsRefresh(identity, listener),
      { initialProps: { identity: 'user-b' as string | undefined } },
    );

    refreshSubsidyRecords('user-a');
    expect(listener).not.toHaveBeenCalled();
    refreshSubsidyRecords('user-b');
    expect(listener).toHaveBeenCalledTimes(1);

    // The page stays mounted across an account switch.
    rerender({ identity: 'user-a' });
    refreshSubsidyRecords('user-b');
    expect(listener).toHaveBeenCalledTimes(1);
    refreshSubsidyRecords('user-a');
    expect(listener).toHaveBeenCalledTimes(2);

    // Signed out: an issuance without a member reaches nobody.
    rerender({ identity: undefined });
    refreshSubsidyRecords(undefined);
    refreshSubsidyRecords('user-a');
    expect(listener).toHaveBeenCalledTimes(2);

    rerender({ identity: 'user-a' });
    unmount();
    refreshSubsidyRecords('user-a');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('useSubsidySummary', () => {
  it('maps the totals of the signed-in user', async () => {
    mockFetchSubsidySummary.mockResolvedValue({
      contractVersion: 1,
      subjectScope: 'canonical',
      asOf: '2026-11-18T00:00:00.000Z',
      ga: {
        operations: 2,
        sponsoredCount: 2,
        evidencedOperations: 1,
        feeTotals: [],
        sponsorCostUsd: {
          value: '0.2',
          basis: 'reconcile_time_valuation',
          coveredCount: 1,
        },
      },
      tron: { attempts: 1, byState: { supplier_accepted: 1 } },
    });

    const { result } = renderHook(() => useSubsidySummary('user-a'));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      sponsorCostUsd: '0.2',
      gaSettledCount: 2,
      tronAcceptedCount: 1,
    });
  });

  it('reports a failed summary so the totals are not shown as zero', async () => {
    mockFetchSubsidySummary.mockRejectedValue(new Error('90802'));

    const { result } = renderHook(() => useSubsidySummary('user-a'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
