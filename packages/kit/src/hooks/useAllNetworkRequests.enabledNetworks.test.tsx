/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// Slack 09-23 QA report: after unchecking a network (SUI) under All Networks,
// the home list and total kept the network while the token fan-out that was
// already running finished, and pull-to-refresh did not drop it either.

jest.mock('../background/instance/backgroundApiProxy', () => {
  const getAllNetworkAccountsForHome = jest.fn();
  (globalThis as any).__enabledNetworksTestMocks = {
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

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useAllNetworkRequests } from './useAllNetwork';

/*
yarn jest packages/kit/src/hooks/useAllNetworkRequests.enabledNetworks.test.tsx
*/

const { getAllNetworkAccountsForHome } = (
  globalThis as unknown as {
    __enabledNetworksTestMocks: { getAllNetworkAccountsForHome: jest.Mock };
  }
).__enabledNetworksTestMocks;

type IResp = { networkId: string };

let ownerSeq = 0;

function setup({
  withCache = false,
  holdFinished = false,
}: { withCache?: boolean; holdFinished?: boolean } = {}) {
  // A distinct owner per test keeps the module-level accounts cache apart.
  ownerSeq += 1;
  const walletId = `hd-${ownerSeq}`;
  const eth = { accountId: `${walletId}--eth`, networkId: 'evm--1' };
  const sui = { accountId: `${walletId}--sui`, networkId: 'sui--mainnet' };
  let enabled = [eth, sui];
  getAllNetworkAccountsForHome.mockImplementation(async () =>
    enabled.map((a) => ({
      ...a,
      apiAddress: `${a.accountId}-address`,
      dbAccount: {},
      isBackendIndexed: true,
    })),
  );
  const pending: Array<{ resolve: () => void; reject: (e: Error) => void }> =
    [];
  const finishedResolvers: Array<() => void> = [];
  const fanOuts: string[][] = [];
  // isRunCurrent handed to each request, per fan-out.
  const requestRunChecks: Array<Array<() => boolean>> = [];
  const settled: string[] = [];
  // isRunCurrent handed to onStarted / allNetworkCacheData, per run.
  const startedRunChecks: Array<() => boolean> = [];
  const cacheDataRunChecks: Array<() => boolean> = [];
  const clearAllNetworkData = jest.fn();
  const abortSupersededRequests = jest.fn();
  const published: Array<IResp[] | null | undefined> = [];
  const hook = renderHook(() =>
    useAllNetworkRequests<IResp>({
      accountId: `${walletId}--allnet`,
      networkId: 'onekeyall--0',
      walletId,
      isAllNetworks: true,
      allNetworkRequests: ({
        networkId,
        isRunCurrent,
      }: {
        networkId: string;
        isRunCurrent?: () => boolean;
      }) => {
        fanOuts[fanOuts.length - 1].push(networkId);
        requestRunChecks[requestRunChecks.length - 1].push(
          isRunCurrent ?? (() => true),
        );
        return new Promise<IResp>((resolve, reject) => {
          pending.push({ resolve: () => resolve({ networkId }), reject });
        });
      },
      allNetworkCacheRequests: async ({ networkId }: { networkId: string }) =>
        withCache ? { networkId } : null,
      allNetworkCacheData: async ({
        isRunCurrent,
      }: {
        isRunCurrent?: () => boolean;
      }) => {
        cacheDataRunChecks.push(isRunCurrent ?? (() => true));
      },
      onStarted: async ({ isRunCurrent }: { isRunCurrent?: () => boolean }) => {
        startedRunChecks.push(isRunCurrent ?? (() => true));
      },
      onFinished: holdFinished
        ? () =>
            new Promise<void>((resolve) => {
              finishedResolvers.push(resolve);
            })
        : undefined,
      allNetworkAccountsData: () => {
        fanOuts.push([]);
        requestRunChecks.push([]);
      },
      clearAllNetworkData,
      abortSupersededRequests,
      onRequestSettled: (result) => {
        settled.push(result.networkId);
      },
      onResultPublished: (result) => {
        published.push(result);
      },
      clearRetainedResultOnAcceptedRun: true,
    }),
  );
  const tick = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
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
  const releaseFinished = async () => {
    await act(async () => {
      finishedResolvers.splice(0).forEach((resolve) => resolve());
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
  return {
    hook,
    fanOuts,
    requestRunChecks,
    startedRunChecks,
    cacheDataRunChecks,
    settled,
    published,
    clearAllNetworkData,
    abortSupersededRequests,
    waitForFanOuts: (count: number) =>
      waitFor(() => expect(fanOuts.length).toBe(count)),
    waitForFirstFanOut: () => waitFor(() => expect(pending.length).toBe(2)),
    uncheckSui: () => {
      enabled = [eth];
      act(() => {
        appEventBus.emit(EAppEventBusNames.EnabledNetworksChanged, undefined);
      });
    },
    // A refresh runner enters the debounce window synchronously (no fan-out
    // is running), and the change lands while it waits there.
    uncheckSuiWhileRefreshDebounced: () => {
      act(() => {
        void hook.result.current.run();
        enabled = [eth];
        appEventBus.emit(EAppEventBusNames.EnabledNetworksChanged, undefined);
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
    releaseFinished,
    tick,
  };
}

describe('useAllNetworkRequests: enabled networks change during a fan-out', () => {
  beforeEach(() => {
    getAllNetworkAccountsForHome.mockReset();
  });

  it('supersedes the running fan-out and fetches the new set right away', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(1);

    ctx.uncheckSui();
    // No waiting for the old fan-out: the new set is requested immediately,
    // from an empty view, and the old requests are cancelled.
    await ctx.waitForFanOuts(2);
    expect(ctx.fanOuts).toEqual([['evm--1', 'sui--mainnet'], ['evm--1']]);
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(2);
    expect(ctx.abortSupersededRequests).toHaveBeenCalledTimes(1);
    expect(ctx.requestRunChecks[0].map((check) => check())).toEqual([
      false,
      false,
    ]);
    expect(ctx.requestRunChecks[1].map((check) => check())).toEqual([true]);

    await ctx.settleRequests();

    // Late responses of the superseded fan-out land nowhere.
    expect(ctx.settled).toEqual(['evm--1']);
    expect(ctx.published).toEqual([[{ networkId: 'evm--1' }]]);
  });

  it('folds a queued pull-to-refresh into the new fan-out', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();

    await ctx.manualRefresh();
    ctx.uncheckSui();
    await ctx.waitForFanOuts(2);
    await ctx.settleRequests();
    await ctx.settleRequests();

    expect(ctx.fanOuts).toEqual([['evm--1', 'sui--mainnet'], ['evm--1']]);
    expect(ctx.published).toEqual([[{ networkId: 'evm--1' }]]);
  });

  it('keeps refreshing normally after a superseded fan-out ends', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    ctx.uncheckSui();
    await ctx.waitForFanOuts(2);
    await ctx.settleRequests();

    await ctx.manualRefresh();
    await ctx.waitForFanOuts(3);
    await ctx.settleRequests();

    expect(ctx.fanOuts[2]).toEqual(['evm--1']);
    expect(ctx.published).toEqual([
      [{ networkId: 'evm--1' }],
      [{ networkId: 'evm--1' }],
    ]);
    // The refresh after the change stays warm.
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(2);
  });

  it('hands the started and cache-seed callbacks a run check that turns false once superseded', async () => {
    const ctx = setup({ withCache: true });
    await ctx.waitForFirstFanOut();
    expect(ctx.startedRunChecks).toHaveLength(1);
    expect(ctx.cacheDataRunChecks).toHaveLength(1);
    expect(ctx.startedRunChecks[0]()).toBe(true);
    expect(ctx.cacheDataRunChecks[0]()).toBe(true);

    ctx.uncheckSui();
    // The consumers re-check these after their own awaits, so a cache seed or
    // refreshing state of the superseded run is never written.
    expect(ctx.startedRunChecks[0]()).toBe(false);
    expect(ctx.cacheDataRunChecks[0]()).toBe(false);

    await ctx.waitForFanOuts(2);
    expect(ctx.startedRunChecks[1]()).toBe(true);
  });

  it('lets a runner waiting in the debounce window absorb the change instead of queuing a second fan-out', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    await ctx.settleRequests();
    expect(ctx.published).toEqual([
      [{ networkId: 'evm--1' }, { networkId: 'sui--mainnet' }],
    ]);

    ctx.uncheckSuiWhileRefreshDebounced();
    await ctx.waitForFanOuts(2);
    await ctx.settleRequests();
    await ctx.settleRequests();

    // One fan-out for the new set, published as soon as it settles: the
    // waiting runner took the must-run flag, so nothing queued behind it.
    expect(ctx.fanOuts).toEqual([['evm--1', 'sui--mainnet'], ['evm--1']]);
    expect(ctx.published).toEqual([
      [{ networkId: 'evm--1' }, { networkId: 'sui--mainnet' }],
      [{ networkId: 'evm--1' }],
    ]);
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(2);
  });

  it('leaves the lock with the replacing run when the change lands while onFinished waits', async () => {
    const ctx = setup({ holdFinished: true });
    await ctx.waitForFirstFanOut();
    // The first fan-out is done and its run is waiting inside `onFinished`.
    await ctx.settleRequests();
    expect(ctx.published).toEqual([]);

    ctx.uncheckSui();
    await ctx.waitForFanOuts(2);
    // The superseded run resumes after the replacement started: it must not
    // release `isFetching` on the replacement's behalf.
    await ctx.releaseFinished();
    await ctx.manualRefresh();
    await ctx.tick();
    expect(ctx.fanOuts).toHaveLength(2);

    await ctx.settleRequests();
    await ctx.releaseFinished();
    await ctx.waitForFanOuts(3);
    await ctx.settleRequests();
    await ctx.releaseFinished();
    expect(ctx.fanOuts).toEqual([
      ['evm--1', 'sui--mainnet'],
      ['evm--1'],
      ['evm--1'],
    ]);
    expect(ctx.published).toEqual([[{ networkId: 'evm--1' }]]);
  });

  it('does not restore the pre-change snapshot when every request of the rerun fails', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    await ctx.settleRequests();
    expect(ctx.hook.result.current.result).toEqual([
      { networkId: 'evm--1' },
      { networkId: 'sui--mainnet' },
    ]);

    ctx.uncheckSui();
    await ctx.waitForFanOuts(2);
    await ctx.failRequests();

    // The last-good snapshot still lists SUI; the failed rerun must not bring
    // it back to the list and the total.
    expect(ctx.hook.result.current.result).toBeUndefined();
    expect(ctx.published).toEqual([
      [{ networkId: 'evm--1' }, { networkId: 'sui--mainnet' }],
    ]);
  });

  it('keeps a plain pull-to-refresh queued and warm', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();

    await ctx.manualRefresh();
    await ctx.settleRequests();
    await ctx.settleRequests();

    expect(ctx.fanOuts).toEqual([
      ['evm--1', 'sui--mainnet'],
      ['evm--1', 'sui--mainnet'],
    ]);
    expect(ctx.abortSupersededRequests).not.toHaveBeenCalled();
    // Only the first run cleared; the refresh updates the view in place.
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(1);
  });
});
