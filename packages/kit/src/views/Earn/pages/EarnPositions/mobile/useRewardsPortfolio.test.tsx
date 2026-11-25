/* eslint-disable import/first */

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Every ledger read the hook sends, in the order it sent them; the test
// settles them in whatever order the scenario needs.
const reads: IDeferred<IEarnRewardsPortfolioResponse>[] = [];
let mockSelectedAddress = 0;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getRewardsPortfolio: () => {
        const read = deferred<IEarnRewardsPortfolioResponse>();
        reads.push(read);
        return read.promise;
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: {
        id: 'acc-1',
        indexedAccountId: 'idx-1',
        connectedAddresses: { evm: '0xaaa,0xbbb' },
        selectedAddress: { evm: mockSelectedAddress },
      },
      indexedAccount: { id: 'idx-1' },
    },
  }),
}));

// The real hook's contract, reduced to what this test needs: the method
// runs again when its deps change or `run` is called, and only the latest
// run's result is applied, so a read of a scope the page has left never
// reaches `result` (the real hook gates on its swr key and nonce alike).
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (method: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = React.useState<unknown>(undefined);
      const latestRunRef = React.useRef(0);
      const methodRef = React.useRef(method);
      methodRef.current = method;
      const run = React.useCallback(async () => {
        latestRunRef.current += 1;
        const thisRun = latestRunRef.current;
        const value = await methodRef.current();
        if (thisRun === latestRunRef.current) {
          setResult(value);
        }
      }, []);
      const depsKey = JSON.stringify(deps);
      React.useEffect(() => {
        void run();
      }, [run, depsKey]);
      return { result, isLoading: false, run };
    },
  };
});

import { act, renderHook } from '@testing-library/react-native';

import type { IEarnRewardsPortfolioResponse } from '@onekeyhq/shared/types/staking';

import { useRewardsPortfolio } from './useRewardsPortfolio';

const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const response = (id: string): IEarnRewardsPortfolioResponse =>
  ({
    asOf: 1,
    stage: 'claimable',
    totals: { claimable: '0', pending: '0', rewards: '0' },
    groups: [{ id }],
  }) as unknown as IEarnRewardsPortfolioResponse;

const groupIdsOf = (rewards: IEarnRewardsPortfolioResponse | undefined) =>
  rewards?.groups.map((group) => (group as unknown as { id: string }).id);

describe('useRewardsPortfolio last read', () => {
  beforeEach(() => {
    reads.length = 0;
    mockSelectedAddress = 0;
  });

  it('does not show rewards from a previously selected external address', async () => {
    const { result, rerender } = renderHook(() =>
      useRewardsPortfolio({
        stage: 'claimable',
        networkIds: [],
        isActive: true,
      }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve(response('address-a'));
      await flush();
    });
    mockSelectedAddress = 1;
    rerender(undefined);
    expect(result.current.rewards).toBeUndefined();
    await act(flush);
    expect(reads).toHaveLength(2);
    await act(async () => {
      reads[1].resolve(response('address-b'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['address-b']);
  });

  it('does not let a retained load-more callback replace the current address pages', async () => {
    const { result, rerender } = renderHook(() =>
      useRewardsPortfolio({
        stage: 'claimable',
        networkIds: [],
        isActive: true,
      }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve({ ...response('a-first'), cursor: 'a-next' });
      await flush();
    });
    const loadMoreFromA = result.current.loadMore;
    mockSelectedAddress = 1;
    rerender(undefined);
    await act(flush);
    await act(async () => {
      reads[1].resolve({ ...response('b-first'), cursor: 'b-next' });
      await flush();
    });
    await act(async () => {
      void result.current.loadMore();
      await flush();
    });
    await act(async () => {
      reads[2].resolve(response('b-second'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['b-first', 'b-second']);
    await act(async () => {
      void loadMoreFromA();
      await flush();
    });
    expect(reads).toHaveLength(3);
    expect(groupIdsOf(result.current.rewards)).toEqual(['b-first', 'b-second']);
  });

  it('allows the current address to load more while an old address request is pending', async () => {
    const { result, rerender } = renderHook(() =>
      useRewardsPortfolio({
        stage: 'claimable',
        networkIds: [],
        isActive: true,
      }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve({ ...response('a-first'), cursor: 'a-next' });
      await flush();
    });
    await act(async () => {
      void result.current.loadMore();
      await flush();
    });
    mockSelectedAddress = 1;
    rerender(undefined);
    await act(flush);
    await act(async () => {
      reads[2].resolve({ ...response('b-first'), cursor: 'b-next' });
      await flush();
    });
    expect(result.current.isLoadingMore).toBe(false);
    await act(async () => {
      void result.current.loadMore();
      await flush();
    });
    expect(reads).toHaveLength(4);
    await act(async () => {
      reads[3].resolve(response('b-second'));
      await flush();
    });
    await act(async () => {
      reads[1].resolve(response('a-second-late'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['b-first', 'b-second']);
  });

  it('does not apply an old A page after A to B to A even when asOf and cursor match', async () => {
    const { result, rerender } = renderHook(() =>
      useRewardsPortfolio({
        stage: 'claimable',
        networkIds: [],
        isActive: true,
      }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve({ ...response('a-old-first'), cursor: 'next' });
      await flush();
    });
    const oldLoadMore = result.current.loadMore;
    await act(async () => {
      void oldLoadMore();
      await flush();
    });
    mockSelectedAddress = 1;
    rerender(undefined);
    await act(flush);
    mockSelectedAddress = 0;
    rerender(undefined);
    await act(flush);
    await act(async () => {
      reads[3].resolve({ ...response('a-new-first'), cursor: 'next' });
      await flush();
    });
    expect(result.current.isLoadingMore).toBe(false);
    await act(async () => {
      reads[1].resolve(response('a-old-page'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['a-new-first']);
    await act(async () => {
      void oldLoadMore();
      await flush();
    });
    expect(reads).toHaveLength(4);
    await act(async () => {
      void result.current.loadMore();
      await flush();
    });
    await act(async () => {
      reads[4].resolve(response('a-new-page'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual([
      'a-new-first',
      'a-new-page',
    ]);
  });

  it('does not let a late first A read replace the fallback after A to B to A', async () => {
    const { result, rerender } = renderHook(() =>
      useRewardsPortfolio({
        stage: 'claimable',
        networkIds: [],
        isActive: true,
      }),
    );
    await act(flush);
    const retainedRefresh = result.current.refresh;
    mockSelectedAddress = 1;
    rerender(undefined);
    await act(flush);
    mockSelectedAddress = 0;
    rerender(undefined);
    await act(flush);
    await act(async () => {
      reads[2].resolve(response('a-current'));
      await flush();
    });
    await act(async () => {
      reads[0].resolve(response('a-old-late'));
      await flush();
    });
    await act(async () => {
      void retainedRefresh();
      await flush();
    });
    await act(async () => {
      reads[3].reject(new Error('offline'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['a-current']);
  });

  it('keeps the later same-scope read as fallback when an earlier read finishes late', async () => {
    const { result } = renderHook(() =>
      useRewardsPortfolio({
        stage: 'claimable',
        networkIds: [],
        isActive: true,
      }),
    );
    await act(flush);
    await act(async () => {
      void result.current.refresh();
      await flush();
    });
    await act(async () => {
      reads[1].resolve(response('newer'));
      await flush();
    });
    await act(async () => {
      reads[0].resolve(response('older'));
      await flush();
    });
    await act(async () => {
      void result.current.refresh();
      await flush();
    });
    await act(async () => {
      reads[2].reject(new Error('offline'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['newer']);
  });

  it('does not apply a page of the previous first read after a same-asOf refresh', async () => {
    const { result } = renderHook(() =>
      useRewardsPortfolio({
        stage: 'claimable',
        networkIds: [],
        isActive: true,
      }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve({ ...response('first-old'), cursor: 'next' });
      await flush();
    });
    const oldLoadMore = result.current.loadMore;
    await act(async () => {
      void oldLoadMore();
      await flush();
    });
    await act(async () => {
      void result.current.refresh();
      await flush();
    });
    await act(async () => {
      reads[2].resolve({ ...response('first-new'), cursor: 'next' });
      await flush();
    });
    expect(result.current.isLoadingMore).toBe(false);
    await act(async () => {
      void oldLoadMore();
      await flush();
    });
    expect(reads).toHaveLength(3);
    await act(async () => {
      void result.current.loadMore();
      await flush();
    });
    await act(async () => {
      reads[3].resolve(response('new-page'));
      await flush();
    });
    await act(async () => {
      reads[1].resolve(response('old-page'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual([
      'first-new',
      'new-page',
    ]);
  });

  it('preserves the loaded pages when the first-page refresh fails', async () => {
    const { result } = renderHook(() =>
      useRewardsPortfolio({
        stage: 'claimable',
        networkIds: [],
        isActive: true,
      }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve({ ...response('first'), cursor: 'next' });
      await flush();
    });
    await act(async () => {
      void result.current.loadMore();
      await flush();
    });
    await act(async () => {
      reads[1].resolve(response('second'));
      await flush();
    });
    await act(async () => {
      void result.current.refresh();
      await flush();
    });
    await act(async () => {
      reads[2].reject(new Error('offline'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['first', 'second']);
  });

  it('keeps the current scope on a failed refresh after a read of a left scope landed late', async () => {
    const { result, rerender } = renderHook(
      ({ networkIds }: { networkIds: string[] }) =>
        useRewardsPortfolio({ stage: 'claimable', networkIds, isActive: true }),
      { initialProps: { networkIds: ['evm--1'] } },
    );
    await act(flush);
    expect(reads).toHaveLength(1);

    // The page moves to another network filter while the first read is
    // still out; the new scope's read lands first.
    rerender({ networkIds: ['evm--8453'] });
    await act(flush);
    expect(reads).toHaveLength(2);
    await act(async () => {
      reads[1].resolve(response('base-group'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['base-group']);

    // The left scope's read lands late: the page still shows the current scope.
    await act(async () => {
      reads[0].resolve(response('ethereum-group'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['base-group']);

    // A refresh of the current scope fails: the page keeps what it showed.
    await act(async () => {
      void result.current.refresh();
      await flush();
    });
    expect(reads).toHaveLength(3);
    await act(async () => {
      reads[2].reject(new Error('network'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['base-group']);
    expect(result.current.isLoading).toBe(false);
  });

  it('shows a new scope empty, not the previous scope, when its first read fails', async () => {
    const { result, rerender } = renderHook(
      ({ networkIds }: { networkIds: string[] }) =>
        useRewardsPortfolio({ stage: 'claimable', networkIds, isActive: true }),
      { initialProps: { networkIds: ['evm--1'] } },
    );
    await act(async () => {
      await flush();
      reads[0].resolve(response('ethereum-group'));
      await flush();
    });
    expect(groupIdsOf(result.current.rewards)).toEqual(['ethereum-group']);

    rerender({ networkIds: ['evm--8453'] });
    await act(flush);
    await act(async () => {
      reads[1].reject(new Error('network'));
      await flush();
    });
    expect(result.current.rewards).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});
