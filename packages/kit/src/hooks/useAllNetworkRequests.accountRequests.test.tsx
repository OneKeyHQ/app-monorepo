/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// After a transaction under All Networks, history reports the account whose
// transactions changed and only that network is fetched again. Its result
// must reach `onRequestSettled` (the consumer's LWW view), or the sent token
// keeps its old balance in the home list until the next full fan-out.

jest.mock('../background/instance/backgroundApiProxy', () => {
  const getAllNetworkAccountsForHome = jest.fn();
  (globalThis as any).__accountRequestsTestMocks = {
    getAllNetworkAccountsForHome,
  };
  return {
    __esModule: true,
    default: {
      serviceAllNetwork: { getAllNetworkAccountsForHome },
      serviceDeFi: { getDeFiEnabledNetworksMap: jest.fn(async () => ({})) },
    },
  };
});
jest.mock('@onekeyhq/components', () => ({
  useDeferredPromise: () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useMemo } = require('react') as typeof import('react');
    return useMemo(() => {
      const deferred: {
        promise?: Promise<unknown>;
        status?: string;
        resolve?: (value: unknown) => void;
        reject?: (reason: unknown) => void;
        reset?: () => void;
      } = {};
      const build = () => {
        deferred.promise = new Promise((resolve, reject) => {
          deferred.status = 'pending';
          deferred.resolve = (value) => {
            deferred.status = 'resolved';
            resolve(value);
          };
          deferred.reject = (reason) => {
            deferred.status = 'rejected';
            reject(reason);
          };
        });
      };
      build();
      deferred.reset = () => {
        if (deferred.status !== 'pending') build();
      };
      return deferred;
    }, []);
  },
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useNetInfo: () => ({ isInternetReachable: true }),
}));
jest.mock('./useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [false],
}));
jest.mock('@onekeyhq/shared/src/consts/walletConsts', () => ({
  ...(jest.requireActual('@onekeyhq/shared/src/consts/walletConsts') as Record<
    string,
    unknown
  >),
  POLLING_DEBOUNCE_INTERVAL: 0,
}));

import { act, renderHook, waitFor } from '@testing-library/react';

import { useAllNetworkRequests } from './useAllNetwork';

/*
yarn jest packages/kit/src/hooks/useAllNetworkRequests.accountRequests.test.tsx
*/

const { getAllNetworkAccountsForHome } = (
  globalThis as unknown as {
    __accountRequestsTestMocks: { getAllNetworkAccountsForHome: jest.Mock };
  }
).__accountRequestsTestMocks;

type IResp = { networkId: string };

let ownerSeq = 0;

function setup({ holdAccounts = false }: { holdAccounts?: boolean } = {}) {
  // A distinct owner per test keeps the module-level accounts cache apart.
  ownerSeq += 1;
  const walletId = `hd-${ownerSeq}`;
  const eth = { accountId: `${walletId}--eth`, networkId: 'evm--1' };
  const sui = { accountId: `${walletId}--sui`, networkId: 'sui--mainnet' };
  const enabled = [eth, sui];
  const accountsResolvers: Array<() => void> = [];
  getAllNetworkAccountsForHome.mockImplementation(async () => {
    if (holdAccounts) {
      await new Promise<void>((resolve) => {
        accountsResolvers.push(resolve);
      });
    }
    return enabled.map((a) => ({
      ...a,
      apiAddress: `${a.accountId}-address`,
      dbAccount: {},
      isBackendIndexed: true,
    }));
  });
  const pending: Array<{ resolve: () => void; reject: (e: Error) => void }> =
    [];
  // Every request the hook issues, fan-out and per-account refresh alike.
  const requests: Array<{
    networkId: string;
    allNetworkDataInit?: boolean;
    isRunCurrent: () => boolean;
  }> = [];
  const fanOutCount = { current: 0 };
  const settled: Array<[string, number]> = [];
  const published: Array<IResp[] | null | undefined> = [];
  const hook = renderHook(
    ({ accountId }: { accountId: string }) =>
      useAllNetworkRequests<IResp>({
        accountId,
        networkId: 'onekeyall--0',
        walletId,
        isAllNetworks: true,
        allNetworkRequests: ({
          networkId,
          allNetworkDataInit,
          isRunCurrent,
        }: {
          networkId: string;
          allNetworkDataInit?: boolean;
          isRunCurrent?: () => boolean;
        }) => {
          requests.push({
            networkId,
            allNetworkDataInit,
            isRunCurrent: isRunCurrent ?? (() => true),
          });
          return new Promise<IResp>((resolve, reject) => {
            pending.push({ resolve: () => resolve({ networkId }), reject });
          });
        },
        allNetworkCacheRequests: async () => null,
        allNetworkCacheData: async () => {},
        allNetworkAccountsData: () => {
          fanOutCount.current += 1;
        },
        clearAllNetworkData: () => {},
        onRequestSettled: (result, generation) => {
          settled.push([result.networkId, generation]);
        },
        onResultPublished: (result) => {
          published.push(result);
        },
        clearRetainedResultOnAcceptedRun: true,
      }),
    { initialProps: { accountId: `${walletId}--allnet` } },
  );
  const settleRequests = async () => {
    await act(async () => {
      pending.splice(0).forEach((request) => request.resolve());
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
  const failRequests = async () => {
    await act(async () => {
      pending.splice(0).forEach((request) => {
        request.reject(new Error('network'));
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
  return {
    hook,
    eth,
    sui,
    walletId,
    requests,
    settled,
    published,
    pending,
    fanOutCount,
    waitForFirstFanOut: () => waitFor(() => expect(pending.length).toBe(2)),
    waitForPending: (count: number) =>
      waitFor(() => expect(pending.length).toBe(count)),
    // Not wrapped in `act`: the batch renders nothing itself, and a pending
    // async act scope would defer the `rerender` / `run` acts nested in it.
    refreshAccounts: (accounts: { accountId: string; networkId: string }[]) =>
      hook.result.current.runAccountRequests(accounts),
    releaseAccounts: async () => {
      await act(async () => {
        accountsResolvers.splice(0).forEach((resolve) => resolve());
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
    },
    flush: async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
    },
    manualRefresh: async () => {
      await act(async () => {
        void hook.result.current.run({
          alwaysSetState: true,
          skipAccountsCache: true,
        });
      });
    },
    settleRequests,
    failRequests,
  };
}

describe('useAllNetworkRequests: per-account refresh outside a fan-out', () => {
  beforeEach(() => {
    getAllNetworkAccountsForHome.mockReset();
  });

  it('publishes the account result under the completed fan-out generation', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    await ctx.settleRequests();
    expect(ctx.settled).toEqual([
      ['evm--1', 1],
      ['sui--mainnet', 1],
    ]);

    const batch = ctx.refreshAccounts([ctx.eth]);
    await ctx.waitForPending(1);
    expect(ctx.requests[2]).toMatchObject({
      networkId: 'evm--1',
      allNetworkDataInit: false,
    });
    expect(ctx.requests[2].isRunCurrent()).toBe(true);
    await ctx.settleRequests();
    await batch;

    // Same generation as the view's rounds: the LWW view replaces ETH in
    // place. No new fan-out, no new published result.
    expect(ctx.settled).toEqual([
      ['evm--1', 1],
      ['sui--mainnet', 1],
      ['evm--1', 1],
    ]);
    expect(ctx.fanOutCount.current).toBe(1);
    expect(ctx.published).toHaveLength(1);
  });

  it('refreshes the accounts one after another and survives one failed network', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    await ctx.settleRequests();

    const batch = ctx.refreshAccounts([ctx.eth, ctx.sui]);
    await ctx.waitForPending(1);
    expect(ctx.requests[2].networkId).toBe('evm--1');
    await ctx.failRequests();
    await ctx.waitForPending(1);
    expect(ctx.requests[3].networkId).toBe('sui--mainnet');
    await ctx.settleRequests();
    await batch;

    expect(ctx.settled).toEqual([
      ['evm--1', 1],
      ['sui--mainnet', 1],
      ['sui--mainnet', 1],
    ]);
  });

  it('drops the account result once a new fan-out has started', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    await ctx.settleRequests();

    const batch = ctx.refreshAccounts([ctx.eth]);
    await ctx.waitForPending(1);
    await ctx.manualRefresh();
    await ctx.waitForPending(3);
    // The refresh that overtook the account request owns the view now.
    expect(ctx.requests[2].isRunCurrent()).toBe(false);
    await ctx.settleRequests();
    await batch;

    expect(ctx.settled).toEqual([
      ['evm--1', 1],
      ['sui--mainnet', 1],
      ['evm--1', 2],
      ['sui--mainnet', 2],
    ]);
  });

  it('drops the account result once the owner changed', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    await ctx.settleRequests();

    const batch = ctx.refreshAccounts([ctx.eth]);
    await ctx.waitForPending(1);
    ctx.hook.rerender({ accountId: `${ctx.walletId}--allnet-2` });
    expect(ctx.requests[2].isRunCurrent()).toBe(false);
    await ctx.settleRequests();
    await batch;

    expect(ctx.settled.filter(([, generation]) => generation === 1)).toEqual([
      ['evm--1', 1],
      ['sui--mainnet', 1],
    ]);
  });

  it('skips a batch issued before the owner fan-out initialized the view', async () => {
    const ctx = setup({ holdAccounts: true });
    await ctx.flush();
    // The accounts read of the first fan-out has not resolved yet: that
    // fan-out covers the account once it does.
    await ctx.refreshAccounts([ctx.eth]);
    expect(ctx.requests).toEqual([]);

    await ctx.releaseAccounts();
    await ctx.waitForFirstFanOut();
    // Only the fan-out's own requests.
    expect(ctx.requests.map((request) => request.networkId)).toEqual([
      'evm--1',
      'sui--mainnet',
    ]);
  });
});
