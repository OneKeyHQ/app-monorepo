/* eslint-disable import/first */
import {
  StrictMode,
  Suspense,
  startTransition,
  useLayoutEffect,
  useState,
} from 'react';

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

// Every positions read the hook sends, in the order it sent them; the test
// settles them in whatever order the scenario needs.
const reads: IDeferred<IEarnPortfolioPositionsResponse>[] = [];
const accountReads: string[] = [];
let mockAccountId = 'acc-1';
let mockIndexedAccountId = 'idx-1';
let mockSelectedAddress = 0;
let mockInitialCache: Record<string, unknown> = {};
let mockLatestCache: Record<string, unknown> = {};
let mockNoAssets = false;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getAvailableAssetsV2: () =>
        Promise.resolve(
          mockNoAssets
            ? []
            : [{ type: 'normal', networkId: 'evm--1', provider: 'morpho' }],
        ),
      getEarnAvailableAccountsParams: ({
        accountId,
      }: {
        accountId: string;
      }) => {
        accountReads.push(accountId);
        return Promise.resolve([
          { networkId: 'evm--1', accountAddress: accountId },
        ]);
      },
      getPortfolioPositions: () => {
        const read = deferred<IEarnPortfolioPositionsResponse>();
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
        id: mockAccountId,
        indexedAccountId: mockIndexedAccountId,
        connectedAddresses: { evm: '0xaaa,0xbbb' },
        selectedAddress: { evm: mockSelectedAddress },
      },
      indexedAccount: { id: mockIndexedAccountId },
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => {
  const { useState: useMockState } =
    jest.requireActual<typeof import('react')>('react');
  return {
    useEarnPortfolioPositionsAtom: () => {
      const state = useMockState<Record<string, unknown>>(mockInitialCache);
      mockLatestCache = state[0];
      return state;
    },
  };
});

jest.mock('../../../hooks/useEarnAccountKey', () => ({
  useEarnAccountKey: () => `wallet-${mockAccountId}`,
}));

import { act, render, renderHook } from '@testing-library/react-native';

import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';

import { useEarnPortfolioPositions } from './useEarnPortfolioPositions';

const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const response = (amount: string): IEarnPortfolioPositionsResponse =>
  ({
    positions: {
      'evm--1': [
        {
          protocol: 'morpho',
          assets: [{ symbol: 'USDC', amount }],
          earn: {
            manage: {
              networkId: 'evm--1',
              provider: 'morpho',
              symbol: 'USDC',
              vault: '0xA',
            },
            symbol: 'USDC',
            vault: '0xA',
          },
        },
      ],
    },
    protocolSummaries: [],
    errors: [],
  }) as unknown as IEarnPortfolioPositionsResponse;

const amountsOf = (merged: IEarnPortfolioPositionsResponse) =>
  Object.values(merged.positions)
    .flat()
    .map((position) => position.assets[0].amount);

describe('useEarnPortfolioPositions read order', () => {
  beforeEach(() => {
    reads.length = 0;
    accountReads.length = 0;
    mockAccountId = 'acc-1';
    mockIndexedAccountId = 'idx-1';
    mockSelectedAddress = 0;
    mockInitialCache = {};
    mockLatestCache = {};
    mockNoAssets = false;
  });

  it('starts one B load when the hidden subtree reveals with a new account', async () => {
    const never = new Promise<never>(() => undefined);
    const observed: {
      committed?: ReturnType<typeof useEarnPortfolioPositions>;
    } = {};
    function Positions({ suspend }: { suspend: boolean }) {
      const flow = useEarnPortfolioPositions({ isActive: true });
      useLayoutEffect(() => {
        observed.committed = flow;
      }, [flow]);
      if (suspend) throw never;
      return null;
    }
    const tree = (suspend: boolean) => (
      <Suspense fallback={null}>
        <Positions suspend={suspend} />
      </Suspense>
    );
    const view = render(tree(false));
    await act(flush);
    await act(async () => {
      reads[0].resolve(response('account-a'));
      await flush();
    });
    view.rerender(tree(true));
    mockAccountId = 'acc-2';
    mockIndexedAccountId = 'idx-2';
    view.rerender(tree(false));
    await act(flush);
    expect(accountReads).toEqual(['acc-1', 'acc-2']);
    expect(
      observed.committed && amountsOf(observed.committed.response),
    ).toEqual([]);
    expect(JSON.stringify(mockLatestCache['wallet-acc-2'] ?? {})).not.toContain(
      'account-a',
    );
    await act(async () => {
      reads[1].resolve(response('account-b'));
      await flush();
    });
    expect(
      observed.committed && amountsOf(observed.committed.response),
    ).toEqual(['account-b']);
    view.unmount();
  });

  it('does not add a reveal refresh to StrictMode effect replay', async () => {
    function Positions() {
      useEarnPortfolioPositions({ isActive: true });
      return null;
    }
    const view = render(
      <StrictMode>
        <Positions />
      </StrictMode>,
    );
    await act(flush);
    expect(accountReads.length).toBeLessThanOrEqual(2);
    view.unmount();
  });

  it('does not seed an empty B result with hidden account A rows', async () => {
    const never = new Promise<never>(() => undefined);
    const observed: {
      committed?: ReturnType<typeof useEarnPortfolioPositions>;
    } = {};
    function Positions({ suspend }: { suspend: boolean }) {
      const flow = useEarnPortfolioPositions({ isActive: true });
      useLayoutEffect(() => {
        observed.committed = flow;
      }, [flow]);
      if (suspend) throw never;
      return null;
    }
    const tree = (suspend: boolean) => (
      <Suspense fallback={null}>
        <Positions suspend={suspend} />
      </Suspense>
    );
    mockAccountId = 'acc-2';
    mockIndexedAccountId = 'idx-2';
    const view = render(tree(false));
    await act(flush);
    await act(async () => {
      reads[0].resolve(response('cached-b'));
      await flush();
    });
    mockAccountId = 'acc-1';
    mockIndexedAccountId = 'idx-1';
    view.rerender(tree(false));
    await act(flush);
    await act(async () => {
      reads[1].resolve(response('account-a'));
      await flush();
    });
    view.rerender(tree(true));
    mockAccountId = 'acc-2';
    mockIndexedAccountId = 'idx-2';
    mockNoAssets = true;
    view.rerender(tree(false));
    await act(flush);
    expect(
      observed.committed && amountsOf(observed.committed.response),
    ).toEqual([]);
    expect(observed.committed?.isLoading).toBe(false);
    expect(JSON.stringify(mockLatestCache['wallet-acc-2'] ?? {})).not.toContain(
      'account-a',
    );
    expect(accountReads).toEqual(['acc-2', 'acc-1', 'acc-2']);
    view.unmount();
  });

  it('restarts a read lost while an already mounted Suspense subtree is hidden', async () => {
    const never = new Promise<never>(() => undefined);
    const observed: {
      committed?: ReturnType<typeof useEarnPortfolioPositions>;
      hidden: boolean;
    } = { hidden: false };

    function Positions({ suspend }: { suspend: boolean }) {
      const flow = useEarnPortfolioPositions({ isActive: true });
      useLayoutEffect(() => {
        observed.committed = flow;
        observed.hidden = false;
        return () => {
          observed.hidden = true;
        };
      }, [flow]);
      if (suspend) throw never;
      return null;
    }
    const tree = (suspend: boolean) => (
      <Suspense fallback={null}>
        <Positions suspend={suspend} />
      </Suspense>
    );
    const view = render(tree(false));
    await act(flush);
    expect(reads).toHaveLength(1);
    expect(observed.committed?.isLoading).toBe(true);

    view.rerender(tree(true));
    expect(observed.hidden).toBe(true);
    await act(async () => {
      reads[0].resolve(response('hidden'));
      await flush();
    });
    view.rerender(tree(false));
    await act(flush);
    expect(reads).toHaveLength(2);
    expect(
      observed.committed && amountsOf(observed.committed.response),
    ).toEqual([]);
    expect(observed.committed?.isLoading).toBe(true);

    await act(async () => {
      reads[1].resolve(response('restored'));
      await flush();
    });
    expect(
      observed.committed && amountsOf(observed.committed.response),
    ).toEqual(['restored']);
    expect(observed.committed?.isLoading).toBe(false);
    view.unmount();
  });

  it('keeps cached rows visible while restarting a read on reveal', async () => {
    const never = new Promise<never>(() => undefined);
    let committed: ReturnType<typeof useEarnPortfolioPositions> | undefined;
    function Positions({ suspend }: { suspend: boolean }) {
      const flow = useEarnPortfolioPositions({ isActive: true });
      useLayoutEffect(() => {
        committed = flow;
      }, [flow]);
      if (suspend) throw never;
      return null;
    }
    const tree = (suspend: boolean) => (
      <Suspense fallback={null}>
        <Positions suspend={suspend} />
      </Suspense>
    );
    const view = render(tree(false));
    await act(flush);
    await act(async () => {
      reads[0].resolve(response('cached'));
      await flush();
    });
    await act(async () => {
      void committed?.refresh({ provider: 'morpho' });
      await flush();
    });
    expect(reads).toHaveLength(2);
    view.rerender(tree(true));
    await act(async () => {
      reads[1].resolve(response('while-hidden'));
      await flush();
    });
    view.rerender(tree(false));
    await act(flush);
    expect(reads).toHaveLength(3);
    expect(committed && amountsOf(committed.response)).toEqual(['cached']);
    expect(committed?.isLoading).toBe(false);
    await act(async () => {
      reads[2].resolve(response('fresh'));
      await flush();
    });
    expect(committed && amountsOf(committed.response)).toEqual(['fresh']);
    view.unmount();
  });

  it('does not publish or restart a read after actual unmount', async () => {
    const view = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    const refresh = view.result.current.refresh;
    view.unmount();
    await act(async () => {
      reads[0].resolve(response('after-unmount'));
      await refresh();
      await flush();
    });
    expect(reads).toHaveLength(1);
    expect(mockLatestCache).toEqual({});
  });

  it('keeps the committed account read current when another account render suspends', async () => {
    const never = new Promise<never>(() => undefined);
    let switchAccount: (value: string) => void = () => undefined;
    const observed: {
      committed?: ReturnType<typeof useEarnPortfolioPositions>;
    } = {};
    let suspended = 0;

    function Positions() {
      const [selected, setSelected] = useState('acc-1');
      switchAccount = setSelected;
      mockAccountId = selected;
      const flow = useEarnPortfolioPositions({ isActive: true });
      useLayoutEffect(() => {
        observed.committed = flow;
      }, [flow]);
      if (selected === 'acc-2') {
        suspended += 1;
        throw never;
      }
      return null;
    }

    const view = render(
      <Suspense fallback={null}>
        <Positions />
      </Suspense>,
    );
    await act(flush);
    expect(reads).toHaveLength(1);
    const accountA = observed.committed;
    await act(async () => {
      startTransition(() => switchAccount('acc-2'));
    });
    expect(suspended).toBeGreaterThan(0);
    expect(observed.committed).toBe(accountA);

    await act(async () => {
      void accountA?.refresh({ provider: 'morpho' });
      await flush();
    });
    expect(reads).toHaveLength(2);

    await act(async () => {
      reads[0].resolve(response('account-a'));
      reads[1].resolve(response('account-a'));
      await flush();
    });
    expect(
      observed.committed?.response.positions['evm--1']?.[0]?.assets[0]?.amount,
    ).toBe('account-a');
    expect(observed.committed?.isLoading).toBe(false);
    expect(mockLatestCache).toMatchObject({
      'wallet-acc-1': { scopes: expect.any(Object) },
    });
    expect(mockLatestCache['wallet-acc-2']).toBeUndefined();
    expect(JSON.stringify(mockLatestCache)).toContain('account-a');
    view.unmount();
  });

  it('rejects an old A request and refresh after committed A to B to A switches', async () => {
    const { result, rerender } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    const oldRefresh = result.current.refresh;

    mockAccountId = 'acc-2';
    mockIndexedAccountId = 'idx-2';
    rerender(undefined);
    await act(flush);
    mockAccountId = 'acc-1';
    mockIndexedAccountId = 'idx-1';
    rerender(undefined);
    await act(flush);
    expect(reads).toHaveLength(3);

    await act(async () => {
      void oldRefresh({ provider: 'morpho' });
      reads[0].resolve(response('old-a'));
      reads[1].resolve(response('old-b'));
      await flush();
    });
    expect(reads).toHaveLength(3);
    expect(amountsOf(result.current.response)).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      reads[2].resolve(response('current-a'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['current-a']);
    expect(result.current.isLoading).toBe(false);
  });

  it('replaces cached positions when an external wallet changes its selected address', async () => {
    const { result, rerender } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve(response('address-a'));
      await flush();
    });
    const refreshFromAddressA = result.current.refresh;
    mockSelectedAddress = 1;
    rerender(undefined);
    expect(amountsOf(result.current.response)).toEqual([]);
    await act(flush);
    expect(reads).toHaveLength(2);
    await act(async () => {
      reads[1].resolve(response('address-b'));
      await flush();
    });
    await act(async () => {
      void refreshFromAddressA({ provider: 'morpho' });
      await flush();
    });
    expect(reads).toHaveLength(2);
    expect(amountsOf(result.current.response)).toEqual(['address-b']);

    rerender(undefined);
    await act(flush);
    expect(reads).toHaveLength(2);

    mockSelectedAddress = 0;
    rerender(undefined);
    expect(amountsOf(result.current.response)).toEqual([]);
    await act(flush);
    expect(reads).toHaveLength(3);
  });

  it('does not show a legacy cache bucket without a matching address scope', async () => {
    mockInitialCache = { 'wallet-acc-1': { legacy: response('legacy') } };
    const { result } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    expect(amountsOf(result.current.response)).toEqual([]);
    await act(flush);
    expect(reads).toHaveLength(1);
  });

  it('does not let a retained account A refresh publish into account B', async () => {
    const { result, rerender } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve(response('account-a'));
      await flush();
    });
    const refreshFromAccountA = result.current.refresh;

    mockAccountId = 'acc-2';
    mockIndexedAccountId = 'idx-2';
    rerender(undefined);
    await act(flush);
    await act(async () => {
      reads[1].resolve(response('account-b'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['account-b']);

    await act(async () => {
      void refreshFromAccountA({ provider: 'morpho' });
      await flush();
    });
    expect(reads).toHaveLength(2);

    await act(async () => {
      void result.current.refresh({ provider: 'morpho' });
      await flush();
    });
    await act(async () => {
      reads[2].resolve(response('account-b-updated'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['account-b-updated']);
  });

  it('ignores an account A response that arrives after account B loads', async () => {
    const { result, rerender } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);

    mockAccountId = 'acc-2';
    mockIndexedAccountId = 'idx-2';
    rerender(undefined);
    await act(flush);
    await act(async () => {
      reads[1].resolve(response('account-b'));
      await flush();
    });
    await act(async () => {
      reads[0].resolve(response('account-a-late'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['account-b']);
  });

  it('keeps the current account position if a partial refresh fails', async () => {
    const { result } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    await act(async () => {
      reads[0].resolve(response('current'));
      await flush();
    });
    await act(async () => {
      void result.current.refresh({ provider: 'morpho' });
      await flush();
    });
    await act(async () => {
      reads[1].reject(new Error('provider unavailable'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['current']);
    expect(result.current.isLoading).toBe(false);
  });

  // The full load's read of the provider went out before the claim, so its
  // balance predates the claim; it must not replace what the claim's
  // partial read, sent later, has shown.
  it('drops a scope read sent earlier than the one the scope shows', async () => {
    const { result } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    expect(reads).toHaveLength(1);

    await act(async () => {
      void result.current.refresh({ provider: 'morpho' });
      await flush();
    });
    expect(reads).toHaveLength(2);

    await act(async () => {
      reads[1].resolve(response('after-claim'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['after-claim']);

    await act(async () => {
      reads[0].resolve(response('before-claim'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['after-claim']);
  });

  it('lets a read sent later replace what an earlier read showed, whichever lands first', async () => {
    const { result } = renderHook(() =>
      useEarnPortfolioPositions({ isActive: true }),
    );
    await act(flush);
    await act(async () => {
      void result.current.refresh({ provider: 'morpho' });
      await flush();
    });
    expect(reads).toHaveLength(2);

    await act(async () => {
      reads[0].resolve(response('before-claim'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['before-claim']);

    await act(async () => {
      reads[1].resolve(response('after-claim'));
      await flush();
    });
    expect(amountsOf(result.current.response)).toEqual(['after-claim']);
    expect(result.current.isLoading).toBe(false);
  });
});
