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
      account: { id: 'acc-1', indexedAccountId: 'idx-1' },
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
