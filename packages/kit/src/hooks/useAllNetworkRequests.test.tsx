/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { CanceledError } from 'axios';

import type {
  IAllNetworkAccountInfo,
  IAllNetworkAccountsInfoResult,
} from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import * as diagnostics from '@onekeyhq/shared/src/performance/enabled';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAllNetworkRequests } from './useAllNetwork';

jest.mock('@onekeyhq/shared/src/performance/enabled', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/performance/enabled')
  >('@onekeyhq/shared/src/performance/enabled');
  return {
    ...actual,
    isAccountSwitchDiagnosticsEnabled: jest.fn(
      actual.isAccountSwitchDiagnosticsEnabled,
    ),
  };
});
jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceAllNetwork: { getAllNetworkAccountsForHome: jest.fn() } },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [false],
}));
jest.mock('./useRouteIsFocused', () => ({ useRouteIsFocused: () => true }));
// Start runners explicitly so the assertions cover this hook's dispatch and
// latest-owner queue rather than usePromiseResult's separate focus/nonce gates.
jest.mock('./usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<unknown>) => ({
    run: method,
    result: undefined,
    setResult: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isOthersAccount: () => false },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: class extends Error {},
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: {
      allNetworkAccountPerf: { homeTokenListRefreshTrace: jest.fn() },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/performance/mark', () => ({
  perfMark: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/utils/debug/perfUtils', () => ({
  __esModule: true,
  default: {
    createPerf: () => ({
      markStart: jest.fn(),
      markEnd: jest.fn(),
      done: jest.fn(),
    }),
  },
  EPerformanceTimerLogNames: {},
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));
jest.mock('../components/TokenListView/perfTokenListView', () => ({
  perfTokenListView: { markStart: jest.fn(), markEnd: jest.fn() },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function accountsFor(owner: string, count = 21): IAllNetworkAccountsInfoResult {
  const accountsInfo = Array.from({ length: count }, (_, index) => ({
    accountId: `${owner}-chain-${index}`,
    networkId: `evm--${index + 1}`,
    apiAddress: `test-address-${index}`,
    accountXpub: undefined,
    pub: undefined,
    dbAccount: undefined,
    isNftEnabled: true,
    isBackendIndexed: index < 16,
    deriveType: undefined,
    deriveInfo: undefined,
    isTestnet: false,
  }));
  return {
    accountsInfo,
    accountsInfoBackendIndexed: accountsInfo.slice(0, 16),
    accountsInfoBackendNotIndexed: accountsInfo.slice(16),
    allAccountsInfo: accountsInfo,
  };
}

type IRound = { networkId: string };
let setupCount = 0;
function setup({
  warm = true,
  guarded = true,
  isNFTRequests = false,
  cacheBatch,
}: {
  warm?: boolean;
  guarded?: boolean;
  isNFTRequests?: boolean;
  cacheBatch?: (accounts: IAllNetworkAccountInfo[]) => Promise<IRound[]>;
} = {}) {
  setupCount += 1;
  let currentEpoch = 1;
  const fetch = jest.fn(
    async ({ networkId }: { accountId: string; networkId: string }) => ({
      networkId,
    }),
  );
  const cache = jest.fn(async ({ networkId }: { networkId: string }) =>
    warm ? { networkId } : undefined,
  );
  const seed = jest.fn(async () => undefined);
  const started = jest.fn(async (): Promise<void> => undefined);
  const settled = jest.fn();
  const published = jest.fn();
  const accountsData = jest.fn();
  const cacheChecked = jest.fn();
  const finished = jest.fn();
  const hook = renderHook(
    ({ accountId, epoch }: { accountId: string; epoch: number }) =>
      useAllNetworkRequests<IRound>({
        accountId,
        networkId: 'onekeyall--0',
        walletId: `test-wallet-${setupCount}`,
        isAllNetworks: true,
        isNFTRequests,
        isRunCurrent: guarded ? () => epoch === currentEpoch : undefined,
        allNetworkRequests: fetch,
        allNetworkCacheRequests: cache,
        allNetworkCacheRequestsBatch: cacheBatch,
        allNetworkCacheData: seed,
        allNetworkAccountsData: accountsData,
        clearAllNetworkData: jest.fn(),
        clearRetainedResultOnAcceptedRun: true,
        onStarted: started,
        onCacheChecked: cacheChecked,
        onFinished: finished,
        onRequestSettled: settled,
        onResultPublished: published,
      }),
    { initialProps: { accountId: 'a', epoch: 1 } },
  );
  return {
    ...hook,
    fetch,
    cache,
    seed,
    started,
    settled,
    published,
    accountsData,
    cacheChecked,
    finished,
    invalidate: () => {
      currentEpoch += 1;
    },
    switchOwner: (accountId: string) => {
      currentEpoch += 1;
      hook.rerender({ accountId, epoch: currentEpoch });
    },
  };
}

const getAccounts = jest.spyOn(
  backgroundApiProxy.serviceAllNetwork,
  'getAllNetworkAccountsForHome',
);

beforeEach(() => {
  jest.clearAllMocks();
  getAccounts.mockImplementation(
    async ({ accountId }) => accountsFor(accountId).accountsInfo,
  );
});

describe('Home All Networks dispatch ownership', () => {
  it.each([false, true])(
    'preserves dispatch and publication with diagnostics enabled=%s',
    async (enabled) => {
      const enabledSpy = jest
        .mocked(diagnostics.isAccountSwitchDiagnosticsEnabled)
        .mockReturnValue(enabled);
      const trace = jest.spyOn(
        defaultLogger.account.allNetworkAccountPerf,
        'homeTokenListRefreshTrace',
      );
      try {
        const hook = setup({ warm: true });
        await act(() => hook.result.current.run());
        expect(hook.cache).toHaveBeenCalledTimes(21);
        expect(hook.fetch).toHaveBeenCalledTimes(21);
        expect(hook.published.mock.calls[0][0]).toHaveLength(21);
        expect(hook.finished).toHaveBeenCalledTimes(1);
        if (enabled) {
          expect(trace).toHaveBeenCalledWith(
            expect.objectContaining({
              phase: 'all-network-live-dispatch-started',
              accountsCount: 21,
            }),
          );
        } else {
          expect(trace).not.toHaveBeenCalled();
        }
      } finally {
        enabledSpy.mockReturnValue(false);
        trace.mockRestore();
      }
    },
  );

  it('silently retires a canceled cache batch without publishing a cache miss or finishing its successor', async () => {
    const batch = jest
      .fn<Promise<IRound[]>, [IAllNetworkAccountInfo[]]>()
      .mockRejectedValueOnce(new CanceledError('superseded'))
      .mockResolvedValueOnce([{ networkId: 'evm--1' }]);
    const hook = setup({ cacheBatch: batch });
    const errorLog = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      await act(() => hook.result.current.run());
      expect(errorLog).not.toHaveBeenCalled();
      expect(hook.cacheChecked).not.toHaveBeenCalled();
      expect(hook.finished).not.toHaveBeenCalled();
      expect(hook.fetch).not.toHaveBeenCalled();
      expect(hook.published).not.toHaveBeenCalled();

      await act(() => hook.result.current.run());
      expect(batch).toHaveBeenCalledTimes(2);
      expect(hook.cacheChecked).toHaveBeenCalledWith(
        expect.objectContaining({ hasCache: true }),
      );
      expect(hook.fetch).toHaveBeenCalledTimes(21);
      expect(hook.published).toHaveBeenCalledTimes(1);
    } finally {
      errorLog.mockRestore();
    }
  });

  it.each([true, false])(
    'rebuilds all 22 tasks from one account array without changing entries (warm=%s)',
    async (warm) => {
      const accounts = accountsFor('a', 22).accountsInfo;
      accounts[0] = {
        ...accounts[0],
        accountId: '',
        apiAddress: '',
        isBackendIndexed: undefined,
      };
      accounts[1] = { ...accounts[1], deriveType: 'BIP86' };
      accounts.forEach(Object.freeze);
      Object.freeze(accounts);
      getAccounts.mockResolvedValueOnce(accounts);
      const hook = setup({ warm });

      await act(() => hook.result.current.run());

      expect(getAccounts).toHaveBeenCalledWith({
        accountId: 'a',
        networkId: 'onekeyall--0',
        networksEnabledOnly: true,
        excludeTestNetwork: true,
      });
      expect(hook.accountsData).toHaveBeenCalledWith({
        accounts,
        allAccounts: accounts,
      });
      expect(hook.accountsData.mock.calls[0][0].accounts).toBe(accounts);
      expect(hook.accountsData.mock.calls[0][0].allAccounts).toBe(accounts);
      expect(hook.cache.mock.calls.map(([item]) => item.networkId)).toEqual(
        accounts.map((item) => item.networkId),
      );
      const dispatchOrder = warm
        ? accounts
        : [
            ...accounts.filter((item) => item.isBackendIndexed),
            ...accounts.filter((item) => !item.isBackendIndexed),
          ];
      expect(hook.fetch.mock.calls.map(([item]) => item.networkId)).toEqual(
        dispatchOrder.map((item) => item.networkId),
      );
      // The cold path keeps placeholders out of progressive publication.
      expect(hook.settled).toHaveBeenCalledTimes(warm ? 22 : 21);
      expect(hook.published.mock.calls[0][0]).toHaveLength(22);
      expect(accounts[0].accountId).toBe('');
      expect(accounts[1].deriveType).toBe('BIP86');
    },
  );

  it('keeps NFT filtering after rebuilding the shared base partitions', async () => {
    const accounts = accountsFor('a', 22).accountsInfo;
    accounts[1] = { ...accounts[1], isNftEnabled: false };
    accounts[20] = { ...accounts[20], isNftEnabled: false };
    getAccounts.mockResolvedValueOnce(accounts);
    const hook = setup({ warm: false, isNFTRequests: true });

    await act(() => hook.result.current.run());

    const nftAccounts = accounts.filter((item) => item.isNftEnabled);
    expect(hook.accountsData).toHaveBeenCalledWith({
      accounts: nftAccounts,
      allAccounts: nftAccounts,
    });
    expect(hook.fetch.mock.calls.map(([item]) => item.networkId)).toEqual(
      nftAccounts.map((item) => item.networkId),
    );
    expect(accounts).toHaveLength(22);
  });

  it('does not start an obsolete runner or its preflight RPC', async () => {
    const hook = setup();
    hook.invalidate();
    await act(() => hook.result.current.run());
    expect(getAccounts).not.toHaveBeenCalled();
    expect(hook.started).not.toHaveBeenCalled();
    expect(hook.fetch).not.toHaveBeenCalled();
  });

  it('drops an obsolete account preflight before cache or live dispatch', async () => {
    const accounts = deferred<IAllNetworkAccountInfo[]>();
    getAccounts.mockReturnValueOnce(accounts.promise);
    const hook = setup();
    const run = hook.result.current.run();
    hook.invalidate();
    await act(async () => {
      accounts.resolve(accountsFor('a').accountsInfo);
      await run;
    });
    expect(hook.accountsData).not.toHaveBeenCalled();
    expect(hook.cache).not.toHaveBeenCalled();
    expect(hook.fetch).not.toHaveBeenCalled();
    expect(hook.published).not.toHaveBeenCalled();
  });

  it('stops queued cache probes and does not seed their stale results', async () => {
    const cache = deferred<IRound>();
    const hook = setup();
    hook.cache.mockImplementation(() => cache.promise);
    const run = hook.result.current.run();
    await waitFor(() => expect(hook.cache).toHaveBeenCalledTimes(8));
    hook.invalidate();
    await act(async () => {
      cache.resolve({ networkId: 'evm--1' });
      await run;
    });
    expect(hook.cache).toHaveBeenCalledTimes(8);
    expect(hook.seed).not.toHaveBeenCalled();
    expect(hook.fetch).not.toHaveBeenCalled();
    expect(hook.published).not.toHaveBeenCalled();
  });

  it('does not dispatch cache work when ownership changes during the started callback', async () => {
    const started = deferred<void>();
    const hook = setup();
    hook.started.mockImplementation(() => started.promise);
    const run = hook.result.current.run();
    await waitFor(() => expect(hook.accountsData).toHaveBeenCalledTimes(1));
    hook.invalidate();
    await act(async () => {
      started.resolve();
      await run;
    });
    expect(hook.cache).not.toHaveBeenCalled();
    expect(hook.fetch).not.toHaveBeenCalled();
  });

  it.each([
    { warm: true, initialWave: 16 },
    { warm: false, initialWave: 8 },
  ])(
    'stops the old live queue and fully refreshes the latest owner (warm=$warm)',
    async ({ warm, initialWave }) => {
      const pending = deferred<IRound>();
      const hook = setup({ warm });
      hook.fetch.mockImplementation(({ networkId }) =>
        pending.promise.then(() => ({ networkId })),
      );
      const run = hook.result.current.run();
      await waitFor(() =>
        expect(hook.fetch).toHaveBeenCalledTimes(initialWave),
      );
      hook.switchOwner('b');
      await act(() => hook.result.current.run());
      await act(async () => {
        pending.resolve({ networkId: 'evm--1' });
        await run;
      });
      await waitFor(() => expect(hook.published).toHaveBeenCalledTimes(1));
      expect(hook.fetch).toHaveBeenCalledTimes(initialWave + 21);
      expect(hook.settled).toHaveBeenCalledTimes(21);
      expect(hook.published.mock.calls[0][0]).toEqual(
        accountsFor('b').accountsInfo.map(({ networkId }) => ({ networkId })),
      );
      expect(
        hook.fetch.mock.calls
          .slice(initialWave)
          .map(([request]) => request.accountId),
      ).toEqual(
        accountsFor('b').accountsInfo.map(({ accountId }) => accountId),
      );
    },
  );

  it('does not revive an earlier A run after A to B to A', async () => {
    const pending = deferred<IRound>();
    const hook = setup();
    hook.fetch.mockImplementation(({ networkId }) =>
      pending.promise.then(() => ({ networkId })),
    );
    const run = hook.result.current.run();
    await waitFor(() => expect(hook.fetch).toHaveBeenCalledTimes(16));
    hook.switchOwner('b');
    await act(() => hook.result.current.run());
    hook.switchOwner('a');
    await act(() => hook.result.current.run());
    await act(async () => {
      pending.resolve({ networkId: 'evm--1' });
      await run;
    });
    await waitFor(() => expect(hook.published).toHaveBeenCalledTimes(1));
    expect(hook.fetch).toHaveBeenCalledTimes(16 + 21);
    expect(hook.settled).toHaveBeenCalledTimes(21);
    expect(hook.published.mock.calls[0][0]).toEqual(
      accountsFor('a').accountsInfo.map(({ networkId }) => ({ networkId })),
    );
    expect(
      hook.fetch.mock.calls.slice(16).map(([request]) => request.accountId),
    ).toEqual(accountsFor('a').accountsInfo.map(({ accountId }) => accountId));
  });

  it('does not skip a replacement run when the epoch changes but the owner key is unchanged', async () => {
    const pending = deferred<IRound>();
    const hook = setup();
    hook.fetch.mockImplementation(({ networkId }) =>
      pending.promise.then(() => ({ networkId })),
    );
    const run = hook.result.current.run();
    await waitFor(() => expect(hook.fetch).toHaveBeenCalledTimes(16));
    hook.switchOwner('a');
    await act(() => hook.result.current.run());
    await act(async () => {
      pending.resolve({ networkId: 'evm--1' });
      await run;
    });
    await waitFor(() => expect(hook.published).toHaveBeenCalledTimes(1));
    expect(hook.fetch).toHaveBeenCalledTimes(16 + 21);
    expect(hook.settled).toHaveBeenCalledTimes(21);
    expect(hook.published.mock.calls[0][0]).toHaveLength(21);
  });

  it('keeps an explicit queued manual refresh after the current run completes', async () => {
    const pending = deferred<IRound>();
    const hook = setup();
    hook.fetch.mockImplementation(({ networkId }) =>
      pending.promise.then(() => ({ networkId })),
    );
    const run = hook.result.current.run();
    await waitFor(() => expect(hook.fetch).toHaveBeenCalledTimes(16));
    await act(() =>
      hook.result.current.run({
        alwaysSetState: true,
        skipAccountsCache: true,
      }),
    );
    await act(async () => {
      pending.resolve({ networkId: 'evm--1' });
      await run;
    });
    await waitFor(() => expect(hook.published).toHaveBeenCalledTimes(1));
    expect(hook.fetch).toHaveBeenCalledTimes(42);
    expect(getAccounts).toHaveBeenCalledTimes(2);
    expect(hook.published.mock.calls[0][0]).toHaveLength(21);
  });

  it('preserves all requests for consumers without a Home ownership predicate', async () => {
    const pending = deferred<IRound>();
    const hook = setup({ guarded: false });
    hook.fetch.mockImplementation(({ networkId }) =>
      pending.promise.then(() => ({ networkId })),
    );
    const run = hook.result.current.run();
    await waitFor(() => expect(hook.fetch).toHaveBeenCalledTimes(16));
    hook.invalidate();
    await act(async () => {
      pending.resolve({ networkId: 'evm--1' });
      await run;
    });
    expect(hook.fetch).toHaveBeenCalledTimes(21);
    expect(hook.settled).toHaveBeenCalledTimes(21);
    expect(hook.published.mock.calls[0][0]).toHaveLength(21);
  });
});
