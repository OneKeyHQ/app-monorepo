/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// Slack 09-23 QA report: after unchecking a network (SUI) under All Networks,
// the home list and total kept the network while the token fan-out that was
// already running finished, and pull-to-refresh did not drop it either.

jest.mock('../background/instance/backgroundApiProxy', () => {
  const getAllNetworkAccounts = jest.fn();
  (globalThis as any).__enabledNetworksTestMocks = { getAllNetworkAccounts };
  return {
    __esModule: true,
    default: {
      serviceAllNetwork: { getAllNetworkAccounts },
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

const { getAllNetworkAccounts } = (
  globalThis as unknown as {
    __enabledNetworksTestMocks: { getAllNetworkAccounts: jest.Mock };
  }
).__enabledNetworksTestMocks;

type IResp = { networkId: string };

let ownerSeq = 0;

function setup() {
  // A distinct owner per test keeps the module-level accounts cache apart.
  ownerSeq += 1;
  const walletId = `hd-${ownerSeq}`;
  const eth = { accountId: `${walletId}--eth`, networkId: 'evm--1' };
  const sui = { accountId: `${walletId}--sui`, networkId: 'sui--mainnet' };
  let enabled = [eth, sui];
  getAllNetworkAccounts.mockImplementation(async () => {
    const accountsInfo = enabled.map((a) => ({ ...a, dbAccount: {} }));
    return {
      accountsInfo,
      accountsInfoBackendIndexed: accountsInfo,
      accountsInfoBackendNotIndexed: [],
      allAccountsInfo: accountsInfo,
    };
  });
  const pending: Array<() => void> = [];
  const fanOuts: string[][] = [];
  const clearAllNetworkData = jest.fn();
  const published: Array<IResp[] | null | undefined> = [];
  const hook = renderHook(() =>
    useAllNetworkRequests<IResp>({
      accountId: `${walletId}--allnet`,
      networkId: 'onekeyall--0',
      walletId,
      isAllNetworks: true,
      allNetworkRequests: ({ networkId }: { networkId: string }) => {
        fanOuts[fanOuts.length - 1].push(networkId);
        return new Promise<IResp>((resolve) => {
          pending.push(() => resolve({ networkId }));
        });
      },
      allNetworkCacheRequests: async () => null,
      allNetworkCacheData: async () => {},
      allNetworkAccountsData: () => {
        fanOuts.push([]);
      },
      clearAllNetworkData,
      onResultPublished: (result) => {
        published.push(result);
      },
      clearRetainedResultOnAcceptedRun: true,
    }),
  );
  const settleRequests = async () => {
    await act(async () => {
      pending.splice(0).forEach((resolve) => resolve());
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  };
  return {
    hook,
    fanOuts,
    published,
    clearAllNetworkData,
    waitForFirstFanOut: () => waitFor(() => expect(pending.length).toBe(2)),
    uncheckSui: () => {
      enabled = [eth];
      act(() => {
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
  };
}

describe('useAllNetworkRequests: enabled networks change during a fan-out', () => {
  beforeEach(() => {
    getAllNetworkAccounts.mockReset();
  });

  it('fetches the new set from scratch once the running fan-out ends', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(1);

    ctx.uncheckSui();
    await ctx.settleRequests();
    await ctx.settleRequests();

    expect(ctx.fanOuts).toEqual([['evm--1', 'sui--mainnet'], ['evm--1']]);
    // The rerun starts from an empty view instead of merging into the one
    // that still holds the unchecked network.
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(2);
    // The fan-out for the old set is superseded, never published.
    expect(ctx.published).toEqual([[{ networkId: 'evm--1' }]]);
  });

  it('still starts from scratch when a pull-to-refresh is also queued', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();

    ctx.uncheckSui();
    await ctx.manualRefresh();
    await ctx.settleRequests();
    await ctx.settleRequests();

    expect(ctx.fanOuts).toEqual([['evm--1', 'sui--mainnet'], ['evm--1']]);
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(2);
    expect(ctx.published).toEqual([[{ networkId: 'evm--1' }]]);
  });

  it('keeps a plain pull-to-refresh warm', async () => {
    const ctx = setup();
    await ctx.waitForFirstFanOut();

    await ctx.manualRefresh();
    await ctx.settleRequests();
    await ctx.settleRequests();

    expect(ctx.fanOuts).toEqual([
      ['evm--1', 'sui--mainnet'],
      ['evm--1', 'sui--mainnet'],
    ]);
    // Only the first run cleared; the refresh updates the view in place.
    expect(ctx.clearAllNetworkData).toHaveBeenCalledTimes(1);
  });
});
