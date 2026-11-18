/** @jest-environment jsdom */
/*
yarn jest packages/kit/src/views/RewardCenter/pages/SubsidyCenter/useSubsidyRecords.test.tsx
*/
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  useSubsidyHistory,
  useSubsidyIdentity,
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

describe('useSubsidyHistory', () => {
  it('sends nothing while signed out', async () => {
    const { result } = renderHook(() => useSubsidyHistory(undefined));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchSubsidyHistory).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it('loads the first page once and names the network of each record', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(historyResponse());

    const { result } = renderHook(() => useSubsidyHistory('user-a'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(mockFetchSubsidyHistory).toHaveBeenCalledTimes(1);
    expect(mockFetchSubsidyHistory).toHaveBeenCalledWith({ limit: 50 });
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
    });
  });

  it('falls back to the network id when the network cannot be resolved', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(historyResponse());
    mockGetNetworksByIds.mockRejectedValue(new Error('network lookup failed'));

    const { result } = renderHook(() => useSubsidyHistory('user-a'));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.items[0].networkName).toBe('tron--0x2b6653dc');
    expect(result.current.isError).toBe(false);
  });

  it('reports a partial result and a further page separately from empty', async () => {
    mockFetchSubsidyHistory.mockResolvedValue(
      historyResponse({ items: [], complete: false, nextCursor: 'cursor-1' }),
    );

    const { result } = renderHook(() => useSubsidyHistory('user-a'));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      items: [],
      isPartial: true,
      hasMore: true,
    });
  });

  it('turns a failed query into an error state that a reload clears', async () => {
    mockFetchSubsidyHistory.mockRejectedValueOnce(new Error('90801'));
    mockFetchSubsidyHistory.mockResolvedValueOnce(historyResponse());

    const { result } = renderHook(() => useSubsidyHistory('user-a'));

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

    const { result } = renderHook(() => useSubsidyHistory('user-a'));
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

    const { result } = renderHook(() => useSubsidyHistory('user-a'));
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

  it('drops the records of the previous user after an account switch', async () => {
    const first = deferred<ReturnType<typeof historyResponse>>();
    mockFetchSubsidyHistory.mockReturnValueOnce(first.promise);
    mockFetchSubsidyHistory.mockResolvedValueOnce(
      historyResponse({ items: [] }),
    );

    const { result, rerender } = renderHook(
      ({ identity }: { identity: string | undefined }) =>
        useSubsidyHistory(identity),
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
        useSubsidyHistory(identity),
      { initialProps: { identity: 'user-a' as string | undefined } },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ identity: undefined });

    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(result.current.isLoading).toBe(false);
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
