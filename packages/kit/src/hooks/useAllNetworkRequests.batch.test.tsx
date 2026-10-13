/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';

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

type IRound = { networkId: string };
type IBatchArgs = Parameters<
  NonNullable<
    Parameters<
      typeof useAllNetworkRequests<IRound>
    >[0]['allNetworkRequestsBatch']
  >
>[0];

function account(
  networkId: string,
  extra: Partial<IAllNetworkAccountInfo> = {},
): IAllNetworkAccountInfo {
  return {
    accountId: 'hd-1--evm',
    networkId,
    apiAddress: '0xshared',
    accountXpub: undefined,
    pub: undefined,
    dbAccount: undefined,
    isNftEnabled: true,
    isBackendIndexed: true,
    deriveType: undefined,
    deriveInfo: undefined,
    isTestnet: false,
    ...extra,
  };
}

let setupCount = 0;
function setup({
  warm,
  requestBatchSize,
  batchImpl,
}: {
  warm: boolean;
  requestBatchSize?: number;
  batchImpl?: (args: IBatchArgs) => Promise<Array<IRound | undefined>>;
}) {
  setupCount += 1;
  const fetch = jest.fn(async ({ networkId }: { networkId: string }) => ({
    networkId,
  }));
  const batch = jest.fn(
    batchImpl ??
      (async ({ batch: b }: IBatchArgs) =>
        b.items.map(({ networkId }) => ({ networkId }))),
  );
  const cache = jest.fn(async ({ networkId }: { networkId: string }) =>
    warm ? { networkId } : undefined,
  );
  const settled = jest.fn();
  const published = jest.fn();
  const finished = jest.fn();
  const hook = renderHook(() =>
    useAllNetworkRequests<IRound>({
      accountId: 'a',
      networkId: 'onekeyall--0',
      walletId: `test-wallet-${setupCount}`,
      isAllNetworks: true,
      isDeFiRequests: false,
      allNetworkRequests: fetch,
      allNetworkRequestsBatch: batch,
      requestBatchSize,
      allNetworkCacheRequests: cache,
      allNetworkCacheData: jest.fn(async () => undefined),
      clearAllNetworkData: jest.fn(),
      clearRetainedResultOnAcceptedRun: true,
      onFinished: finished,
      onRequestSettled: settled,
      onResultPublished: published,
    }),
  );
  return { ...hook, fetch, batch, settled, published, finished };
}

const getAccounts = jest.spyOn(
  backgroundApiProxy.serviceAllNetwork,
  'getAllNetworkAccountsForHome',
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAllNetworkRequests batch mode', () => {
  it.each([true, false])(
    'issues batched requests instead of per-account ones (warm=%s)',
    async (warm) => {
      getAccounts.mockResolvedValueOnce([
        ...Array.from({ length: 12 }, (_, i) => account(`evm--${i + 1}`)),
        account('sol--101', { accountId: 'hd-1--sol', apiAddress: 'So1' }),
      ]);
      const hook = setup({ warm });
      await act(() => hook.result.current.run());

      expect(hook.fetch).not.toHaveBeenCalled();
      expect(
        hook.batch.mock.calls.map(([args]) =>
          args.batch.items.map((i) => i.networkId),
        ),
      ).toEqual([
        [
          'evm--1',
          'evm--10',
          'evm--11',
          'evm--12',
          'evm--2',
          'evm--3',
          'evm--4',
          'evm--5',
          'evm--6',
          'evm--7',
        ],
        ['evm--8', 'evm--9'],
        ['sol--101'],
      ]);
      expect(hook.batch.mock.calls[0][0].allNetworkDataInit).toBe(warm);
      expect(hook.settled).toHaveBeenCalledTimes(13);
      expect(hook.published.mock.calls[0][0]).toHaveLength(13);
      expect(hook.finished).toHaveBeenCalledTimes(1);
    },
  );

  it('runs backend-indexed batches before the rest on the cold path', async () => {
    getAccounts.mockResolvedValueOnce([
      account('evm--1'),
      account('evm--2'),
      account('evm--3', { isBackendIndexed: false }),
      account('evm--4', { isBackendIndexed: false }),
    ]);
    const first = deferred<Array<IRound | undefined>>();
    const hook = setup({
      warm: false,
      requestBatchSize: 2,
      batchImpl: jest
        .fn<Promise<Array<IRound | undefined>>, [IBatchArgs]>()
        .mockImplementationOnce(() => first.promise)
        .mockImplementation(async ({ batch: b }) =>
          b.items.map(({ networkId }) => ({ networkId })),
        ),
    });
    const run = act(() => hook.result.current.run());
    await waitFor(() => expect(hook.batch).toHaveBeenCalledTimes(1));
    expect(
      hook.batch.mock.calls[0][0].batch.items.map((i) => i.networkId),
    ).toEqual(['evm--1', 'evm--2']);
    first.resolve([{ networkId: 'evm--1' }, { networkId: 'evm--2' }]);
    await run;
    expect(
      hook.batch.mock.calls[1][0].batch.items.map((i) => i.networkId),
    ).toEqual(['evm--3', 'evm--4']);
    expect(hook.published.mock.calls[0][0]).toHaveLength(4);
  });

  it('skips undefined entries and does not publish them', async () => {
    getAccounts.mockResolvedValueOnce([account('evm--1'), account('evm--2')]);
    const hook = setup({
      warm: true,
      batchImpl: async () => [{ networkId: 'evm--1' }, undefined],
    });
    await act(() => hook.result.current.run());
    expect(hook.settled).toHaveBeenCalledTimes(1);
    expect(hook.published.mock.calls[0][0]).toEqual([{ networkId: 'evm--1' }]);
  });
});
