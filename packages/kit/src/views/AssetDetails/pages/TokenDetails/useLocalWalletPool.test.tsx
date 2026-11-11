/* eslint-disable import/first */

import type { Dispatch, SetStateAction } from 'react';

import { act, renderHook } from '@testing-library/react-native';
import { getDefaultStore } from 'jotai';

import type { IPrivacyChainPoolDisplayData } from '@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool';
import { privacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletAccountAddresses,
  ILocalWalletAccountBalance,
  ILocalWalletAccountState,
  ILocalWalletAccountSupport,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

type IAccountParams = { accountId: string; networkId: string };
type IPrivacyChangePayload = { networkId: string; accountIds: string[] };

let mockFocused = true;
let mockEnabled = true;
let mockPaused = false;
let mockDisplay: IPrivacyChainPoolDisplayData | undefined;
const mockSetDisplay: Dispatch<
  SetStateAction<IPrivacyChainPoolDisplayData | undefined>
> = (value) => {
  mockDisplay = typeof value === 'function' ? value(mockDisplay) : value;
};
const mockListeners = new Map<
  string,
  Set<(payload: IPrivacyChangePayload) => void>
>();
const mockGetState = jest.fn<
  Promise<ILocalWalletAccountState>,
  [IAccountParams]
>();
const mockGetAddresses = jest.fn<
  Promise<ILocalWalletAccountAddresses>,
  [IAccountParams]
>();
const mockGetBalance = jest.fn<
  Promise<ILocalWalletAccountBalance>,
  [IAccountParams]
>();
const mockGetLastSyncedAt = jest.fn<
  Promise<number | undefined>,
  [IAccountParams]
>();
type IRefreshResult = {
  scanRequested: boolean;
  afterSequence?: number;
  sessionId?: string;
};
const mockRefreshAccount = jest.fn<
  Promise<IRefreshResult | undefined>,
  [IAccountParams]
>();
const mockPageOpened = jest.fn<Promise<void>, [{ networkId: string }]>();
const mockEnableAccount = jest.fn<Promise<void>, [IAccountParams]>();
const mockPauseScan = jest.fn<Promise<void>, [{ networkId: string }]>();
const mockGetSyncProgress = jest.fn<
  Promise<ILocalWalletSyncProgress | undefined>,
  [IAccountParams]
>();
const mockTimerWait = jest.fn<Promise<void>, [number]>();

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: {
    on: (event: string, listener: (payload: IPrivacyChangePayload) => void) => {
      let listeners = mockListeners.get(event);
      if (!listeners) {
        listeners = new Set();
        mockListeners.set(event, listeners);
      }
      listeners.add(listener);
    },
    off: (event: string, listener: (payload: IPrivacyChangePayload) => void) =>
      mockListeners.get(event)?.delete(listener),
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      getLocalWalletAccountState: (params: IAccountParams) =>
        mockGetState(params),
      getLocalWalletAccountAddresses: (params: IAccountParams) =>
        mockGetAddresses(params),
      getLocalWalletAccountBalance: (params: IAccountParams) =>
        mockGetBalance(params),
      getLocalWalletLastSyncedAt: (params: IAccountParams) =>
        mockGetLastSyncedAt(params),
      refreshLocalWalletAccount: (params: IAccountParams) =>
        mockRefreshAccount(params),
      onLocalWalletPageOpened: (params: { networkId: string }) =>
        mockPageOpened(params),
      getLocalWalletSyncProgress: (params: IAccountParams) =>
        mockGetSyncProgress(params),
      enableLocalWalletAccount: (params: IAccountParams) =>
        mockEnableAccount(params),
      pauseLocalWalletScan: (params: { networkId: string }) =>
        mockPauseScan(params),
      // jest hoists this factory above the `var` declarations below.
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      getLocalWalletAccountSupport: async () => mockWalletSupport,
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { atom } = jest.requireActual<typeof import('jotai')>('jotai');
  const privacyChainAtomValue = atom({
    boostingNetworkIds: [] as string[],
    storageUnsupportedNetworkIds: [] as string[],
    pausedNetworkIds: [] as string[],
    preparingAccountKeys: [] as string[],
    dataBlockedNetworkIds: [] as string[],
    syncErrorByNetworkId: {} as Record<string, string>,
    progress: {},
  });
  return { privacyChainAtom: { atom: () => privacyChainAtomValue } };
});
jest.mock('@onekeyhq/kit/src/hooks/useAccountData', () => ({
  useAccountData: ({ accountId }: IAccountParams) => ({
    account: { id: accountId, address: `t-${accountId}` },
    vaultSettings: {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      localWallet: mockLocalWalletSettings,
    },
  }),
}));
// `var`: jest hoists the mock factory above `const` initialization.
// eslint-disable-next-line no-var, vars-on-top
var mockWalletSupport: ILocalWalletAccountSupport = 'supported';
// eslint-disable-next-line no-var, vars-on-top
var mockLocalWalletSettings: Record<string, unknown> | undefined = {
  balanceShape: 'pooled',
  pools: [
    {
      id: 4,
      key: 'ironwood',
      kind: 'private',
      source: 'localScan',
      label: 'Ironwood',
    },
  ],
};

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool', () => ({
  privacyChainPoolOwnerKey: ({
    accountId,
    networkId,
    poolId,
  }: IAccountParams & { poolId?: number }) =>
    `${accountId}_${networkId}_${poolId ?? ''}`,
  usePrivacyChainPoolDisplayAtom: () => [mockDisplay, mockSetDisplay],
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
  useRouteIsFocusedWhenEnabled: ({ enabled }: { enabled: boolean }) =>
    enabled ? mockFocused : true,
}));
jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => {},
  useNetInfo: () => ({}),
  useDeferredPromise: jest.requireActual(
    '../../../../../../components/src/hooks/useDeferredPromise',
  ).useDeferredPromise,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual<{ default: object }>(
      '@onekeyhq/shared/src/utils/timerUtils',
    ).default,
    wait: (delay: number) => mockTimerWait(delay),
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/utils/privacyChainSyncDisplay', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit/src/utils/privacyChainSyncDisplay')
  >('@onekeyhq/kit/src/utils/privacyChainSyncDisplay'),
  formatPrivacyChainSyncError: (kind?: string) =>
    kind ? `sync-error:${kind}` : undefined,
}));
jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/privacyChainSyncPolicy', () => ({
  ...jest.requireActual<object>(
    '@onekeyhq/shared/src/utils/privacyChainSyncPolicy',
  ),
  PRIVACY_CHAIN_TIP_POLL_MS: 300_000,
  isTipLagWorthMentioning: () => false,
}));

import {
  preloadLocalWalletPool,
  resetLocalWalletPoolLastSeen,
  resolveSelectedPoolId,
  useLocalWalletPool,
} from './useLocalWalletPool';

const props = {
  accountId: 'account-a',
  networkId: 'zec--0',
  poolId: 4,
  isActive: true,
};

async function flushReads() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
}

async function flushMicrotasks() {
  for (let index = 0; index < 5; index += 1) {
    // oxlint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function emitPrivacyChange(
  payload = { networkId: props.networkId, accountIds: [props.accountId] },
  event = EAppEventBusNames.LocalWalletAccountsChanged,
) {
  act(() => mockListeners.get(event)?.forEach((listener) => listener(payload)));
}

beforeEach(() => {
  resetLocalWalletPoolLastSeen();
  jest.useFakeTimers();
  mockFocused = true;
  mockEnabled = true;
  mockPaused = false;
  mockWalletSupport = 'supported';
  mockDisplay = undefined;
  mockListeners.clear();
  mockGetSyncProgress.mockReset().mockResolvedValue(undefined);
  mockTimerWait.mockReset().mockImplementation(() => new Promise(() => {}));
  mockGetLastSyncedAt.mockReset().mockResolvedValue(undefined);
  mockRefreshAccount.mockReset().mockResolvedValue({
    scanRequested: true,
    afterSequence: 0,
    sessionId: 'refresh-session',
  });
  mockPageOpened.mockReset().mockResolvedValue(undefined);
  mockPauseScan.mockReset().mockResolvedValue(undefined);
  mockGetState.mockReset().mockImplementation(async () => ({
    enabled: mockEnabled,
    paused: mockPaused,
  }));
  mockGetAddresses.mockReset().mockImplementation(async ({ accountId }) => ({
    publicAddress: `t-${accountId}`,
    privateAddress: mockEnabled ? `u-${accountId}` : undefined,
  }));
  mockGetBalance.mockReset().mockResolvedValue({
    pools: [
      {
        key: 'ironwood',
        totalParsed: '1',
        hints: [],
        move: { type: 'withdraw', amountParsed: '1', enabled: true },
      },
    ],
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// An open token page wants fresh data, not after the full startup quiet window.
describe('useLocalWalletPool wakes the scan', () => {
  it.each([
    [true, false, 1],
    [false, false, 0],
    [true, true, 0],
  ])(
    'when the page opens (enabled: %s, paused: %s)',
    async (enabled, paused, calls) => {
      mockEnabled = enabled;
      mockPaused = paused;
      renderHook(useLocalWalletPool, { initialProps: props });
      await flushReads();
      expect(mockPageOpened).toHaveBeenCalledTimes(calls);
      if (calls) {
        expect(mockPageOpened).toHaveBeenCalledWith({
          networkId: props.networkId,
        });
      }
    },
  );
});

describe('useLocalWalletPool address shows quickly', () => {
  it('reads the address alongside the state, not after it', async () => {
    mockGetState.mockImplementation(() => new Promise(() => {}));
    renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    expect(mockGetAddresses).toHaveBeenCalled();
  });

  it('shows the last address at once when the page opens again', async () => {
    const first = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    first.unmount();

    mockGetState.mockImplementation(() => new Promise(() => {}));
    mockGetAddresses.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    expect(result.current.addresses?.privateAddress).toBe('u-account-a');
  });
});

describe('useLocalWalletPool first balance read', () => {
  it('reads the balance as soon as the state allows it, without a timer', async () => {
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    expect(result.current.enabled).toBe(true);
    expect(mockGetBalance).toHaveBeenCalledTimes(1);
    expect(result.current.balance?.pools[0]?.totalParsed).toBe('1');
  });
});

const setPublishedScanState = (state: Partial<IPrivacyChainScanState>) =>
  getDefaultStore().set(privacyChainAtom.atom(), {
    boostingNetworkIds: [],
    storageUnsupportedNetworkIds: [],
    pausedNetworkIds: [],
    preparingAccountKeys: [],
    dataBlockedNetworkIds: [],
    syncErrorByNetworkId: {},
    progress: {},
    ...state,
  } as IPrivacyChainScanState);

describe('useLocalWalletPool balance refresh cadence', () => {
  const progress: ILocalWalletSyncProgress = {
    birthdayHeight: 1,
    backfillScannedHeight: 100,
    backfillTargetHeight: 100,
    backfillProgress: 1,
    backfillRemainingBlocks: 0,
    isBackfillComplete: true,
    tipScannedHeight: 100,
    chainTip: 100,
    tipLag: 0,
    isTipCaughtUp: true,
    isSyncing: false,
  };

  async function advanceTime(ms: number) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
    await flushMicrotasks();
  }

  // What the scheduler publishes after a pass.
  function publishProgress(next: ILocalWalletSyncProgress) {
    act(() => {
      setPublishedScanState({
        progress: { [`${props.networkId}:${props.accountId}`]: next },
      });
    });
  }

  afterEach(() => {
    setPublishedScanState({});
  });

  beforeEach(() => {
    mockTimerWait.mockImplementation(
      (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
    );
    mockGetSyncProgress.mockImplementation(async () => ({ ...progress }));
  });

  it('reads progress once and keeps unchanged balances until five minutes', async () => {
    renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    const balanceReads = mockGetBalance.mock.calls.length;
    const progressReads = mockGetSyncProgress.mock.calls.length;
    await advanceTime(24_000);
    expect(mockGetSyncProgress).toHaveBeenCalledTimes(progressReads);
    expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads);

    await advanceTime(276_000);
    expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads + 1);
  });

  it('keeps saved balances visible while account pause stops polling', async () => {
    mockEnabled = false;
    mockPaused = true;
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    expect(result.current.enabled).toBe(true);
    expect(result.current.isSyncPaused).toBe(true);
    expect(result.current.isPreparing).toBe(false);
    expect(mockDisplay?.balanceParsed).toBe('1');
    expect(result.current.balance?.pools[0]?.totalParsed).toBe('1');
    const balanceReads = mockGetBalance.mock.calls.length;
    await advanceTime(300_000);
    expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads);
    expect(mockGetSyncProgress).not.toHaveBeenCalled();
  });

  it('refreshes an initially cached balance when the first known progress arrives', async () => {
    let resolveProgress: (value: ILocalWalletSyncProgress) => void = () => {};
    mockGetSyncProgress.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProgress = resolve;
        }),
    );
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    expect(result.current.balance?.pools[0]?.totalParsed).toBe('1');
    mockGetBalance.mockResolvedValue({
      pools: [{ key: 'ironwood', totalParsed: '2', hints: [] }],
    });
    await act(async () => resolveProgress(progress));
    await flushMicrotasks();
    expect(result.current.balance?.pools[0]?.totalParsed).toBe('2');
    expect(mockGetBalance).toHaveBeenCalledTimes(2);
  });

  it.each([101, 99])(
    'refreshes when scanned height changes to %s',
    async (height) => {
      renderHook(useLocalWalletPool, { initialProps: props });
      await flushMicrotasks();
      const balanceReads = mockGetBalance.mock.calls.length;
      publishProgress({ ...progress, tipScannedHeight: height });
      await flushMicrotasks();
      expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads + 1);
    },
  );

  it('refreshes when a gap is scanned without advancing the highest scanned block', async () => {
    mockGetSyncProgress.mockResolvedValue({
      ...progress,
      backfillRemainingBlocks: 20,
      isBackfillComplete: false,
    });
    renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    const balanceReads = mockGetBalance.mock.calls.length;
    publishProgress({
      ...progress,
      backfillRemainingBlocks: 10,
      isBackfillComplete: false,
    });
    await flushMicrotasks();
    expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads + 1);
  });

  it('keeps first progress refresh scoped to the selected account', async () => {
    const { rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushMicrotasks();
    rerender({ ...props, accountId: 'account-b' });
    await flushMicrotasks();
    const accountReads = mockGetBalance.mock.calls.filter(
      ([params]) => params.accountId === 'account-b',
    );
    expect(accountReads).toHaveLength(2);
    await advanceTime(0);
    const balanceReads = mockGetBalance.mock.calls.length;
    await advanceTime(24_000);
    expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads);
    expect(mockGetBalance).toHaveBeenLastCalledWith({
      networkId: props.networkId,
      accountId: 'account-b',
    });
  });

  it('refreshes on focus return and action completion without waiting for the timer', async () => {
    const { rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushMicrotasks();
    const balanceReads = mockGetBalance.mock.calls.length;
    mockFocused = false;
    rerender(props);
    mockFocused = true;
    rerender(props);
    await flushMicrotasks();
    expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads + 1);
    act(() => mockDisplay?.action?.onDone?.());
    await flushMicrotasks();
    expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads + 2);
  });
});

it('shows a pending registration as preparing and keeps private sending disabled', async () => {
  mockGetSyncProgress.mockResolvedValue({
    birthdayHeight: 2_000_000,
    backfillScannedHeight: null,
    backfillTargetHeight: null,
    backfillProgress: 0,
    isBackfillComplete: false,
    tipScannedHeight: null,
    chainTip: null,
    tipLag: null,
    isTipCaughtUp: false,
    isSyncing: true,
  });
  mockGetBalance.mockResolvedValue({
    pools: [
      {
        key: 'ironwood',
        hints: [],
        move: { type: 'withdraw', enabled: false },
      },
    ],
  });
  const { result } = renderHook(useLocalWalletPool, { initialProps: props });
  await flushReads();
  expect(result.current.enabled).toBe(true);
  expect(result.current.isReady).toBe(true);
  expect(result.current.syncStatusText).toBe('global.preparing');
  expect(result.current.poolBalance?.totalParsed).toBeUndefined();
  expect(mockDisplay?.action?.disabled).toBe(true);
});

describe('useLocalWalletPool with account data from the caller', () => {
  it('reads the account and settings it was given', async () => {
    const { result } = renderHook(useLocalWalletPool, {
      initialProps: {
        ...props,
        accountData: {
          account: {
            id: props.accountId,
            address: 'caller-address',
          } as INetworkAccount,
          vaultSettings: {
            localWallet: mockLocalWalletSettings,
          } as unknown as IVaultSettings,
        },
      },
    });
    await flushReads();
    expect(result.current.hasPooledBalance).toBe(true);
    expect(mockDisplay?.action?.fromAddress).toBe('caller-address');
  });
});

describe('useLocalWalletPool before the caller has settings', () => {
  it.each([
    ['privacy chain', 'xmr--0', false],
    ['other chain', 'evm--1', true],
  ])('%s: ready = %s', async (_name, networkId, isReady) => {
    const { result } = renderHook(useLocalWalletPool, {
      initialProps: {
        ...props,
        networkId,
        poolId: undefined,
        accountData: { account: undefined, vaultSettings: undefined },
      },
    });
    await flushReads();
    expect(result.current.hasPooledBalance).toBe(false);
    expect(result.current.isReady).toBe(isReady);
  });
});

describe('useLocalWalletPool after the page preloaded the account', () => {
  it.each([true, false])(
    'knows on its first render whether privacy is on (on: %s)',
    async (enabled) => {
      mockEnabled = enabled;
      await act(async () => {
        await preloadLocalWalletPool({
          networkId: props.networkId,
          accountId: props.accountId,
        });
      });
      // The page's own reads have not landed yet.
      mockGetState.mockImplementation(() => new Promise(() => {}));
      const { result } = renderHook(useLocalWalletPool, {
        initialProps: props,
      });
      expect(result.current.isReady).toBe(true);
      expect(result.current.enabled).toBe(enabled);
    },
  );

  it('waits for its own reads without a preload', () => {
    mockGetState.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    expect(result.current.isReady).toBe(false);
  });
});

describe('useLocalWalletPool on a device that cannot store the database', () => {
  const setStorageUnsupportedNetworkIds = (networkIds: string[]) =>
    setPublishedScanState({ storageUnsupportedNetworkIds: networkIds });
  afterEach(() => {
    setStorageUnsupportedNetworkIds([]);
  });

  it('says to update the WebView instead of showing sync progress', async () => {
    setStorageUnsupportedNetworkIds([props.networkId]);
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    expect(result.current.syncStatusText).toBe(
      'privacy_error_webview_outdated__msg',
    );
  });
});

describe('useLocalWalletPool after a failed background sync', () => {
  afterEach(() => {
    setPublishedScanState({});
  });

  it('says why instead of showing stale figures', async () => {
    setPublishedScanState({
      syncErrorByNetworkId: { [props.networkId]: 'runtimeUnavailable' },
    });
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    expect(result.current.syncStatusText).toBe('sync-error:runtimeUnavailable');
  });

  it('exposes a sync failure before any runtime read completes without inventing a balance', async () => {
    setPublishedScanState({
      syncErrorByNetworkId: { [props.networkId]: 'runtimeUnavailable' },
    });
    mockGetBalance.mockImplementation(() => new Promise(() => undefined));
    mockGetAddresses.mockImplementation(() => new Promise(() => undefined));
    mockGetSyncProgress.mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();

    expect(result.current.isReady).toBe(true);
    expect(result.current.syncStatusText).toBe('sync-error:runtimeUnavailable');
    expect(result.current.balance).toBeUndefined();
    expect(mockDisplay?.balanceParsed).toBeUndefined();
    expect(mockDisplay?.balanceSettled).toBe(true);
    expect(mockDisplay?.action).toBeUndefined();
  });

  it('stays quiet about it while the network is paused', async () => {
    setPublishedScanState({
      pausedNetworkIds: [props.networkId],
      syncErrorByNetworkId: { [props.networkId]: 'nodeUnreachable' },
    });
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    expect(result.current.syncStatusText).toBe('syncing_paused__title');
  });

  it('stays quiet about it while the scan waits for Wi-Fi', async () => {
    setPublishedScanState({
      dataBlockedNetworkIds: [props.networkId],
      syncErrorByNetworkId: { [props.networkId]: 'nodeUnreachable' },
    });
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    expect(result.current.syncStatusText).not.toBe(
      'sync-error:nodeUnreachable',
    );
  });
});

it('shows preparing after authorization while the first runtime reads are pending', async () => {
  mockGetBalance.mockImplementation(() => new Promise(() => undefined));
  mockGetAddresses.mockImplementation(() => new Promise(() => undefined));
  mockGetSyncProgress.mockImplementation(() => new Promise(() => undefined));
  const { result } = renderHook(useLocalWalletPool, { initialProps: props });
  await flushReads();

  expect(result.current.isReady).toBe(true);
  expect(result.current.syncStatusText).toBe('global.preparing');
  expect(result.current.balance).toBeUndefined();
  expect(mockDisplay?.action).toBeUndefined();
});

describe('useLocalWalletPool enable failure', () => {
  it('rejects and ends the busy state', async () => {
    const failure = new Error('privacy runtime unavailable');
    mockEnableAccount.mockRejectedValueOnce(failure);
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();

    let settled: Promise<void> | undefined;
    act(() => {
      settled = result.current.enableAccount({ birthdayTimestamp: 1 });
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      await expect(settled).rejects.toBe(failure);
    });
    expect(result.current.busy).toBe(false);
  });
});

describe('useLocalWalletPool pause', () => {
  it.each([false, true])(
    'uses the existing network pause and clears the control busy state (failure: %s)',
    async (fails) => {
      let resolvePause: (() => void) | undefined;
      let rejectPause: ((error: Error) => void) | undefined;
      mockPauseScan.mockImplementation(
        () =>
          new Promise<void>((resolve, reject) => {
            resolvePause = resolve;
            rejectPause = reject;
          }),
      );
      const { result } = renderHook(useLocalWalletPool, {
        initialProps: props,
      });
      await flushReads();
      let pending: Promise<void> | undefined;
      act(() => {
        pending = result.current.pauseSync();
      });
      expect(mockPauseScan).toHaveBeenCalledWith({
        networkId: props.networkId,
      });
      expect(result.current.actionBusy).toBe(true);
      await act(async () => {
        if (fails) {
          const error = new Error('Pause failed');
          rejectPause?.(error);
          await expect(pending).rejects.toBe(error);
        } else {
          resolvePause?.();
          await pending;
        }
      });
      expect(result.current.actionBusy).toBe(false);
    },
  );
});

describe('useLocalWalletPool retained-page lifecycle', () => {
  it('revalidates authoritative privacy state when returning from settings', async () => {
    const { result, rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushReads();
    expect(mockDisplay?.address).toBe('u-account-a');
    expect(mockDisplay?.action?.disabled).toBe(false);

    mockFocused = false;
    rerender(props);
    mockEnabled = false;
    mockFocused = true;
    rerender(props);
    await flushReads();

    expect(mockGetState).toHaveBeenCalledTimes(2);
    expect(result.current.enabled).toBe(false);
    expect(result.current.addresses).toBeUndefined();
    expect(result.current.poolAddress).toBeUndefined();
    expect(mockDisplay).toBeUndefined();
  });

  it.each([false, true])(
    'invalidates on a privacy lifecycle event even if route focus stays %s',
    async (focused) => {
      const { result, rerender } = renderHook(useLocalWalletPool, {
        initialProps: props,
      });
      await flushReads();
      expect(mockDisplay?.address).toBe('u-account-a');

      mockFocused = focused;
      rerender(props);
      mockEnabled = false;
      emitPrivacyChange();
      expect(result.current.addresses).toBeUndefined();
      expect(mockDisplay).toBeUndefined();
      await flushReads();

      mockFocused = true;
      rerender(props);
      await flushReads();
      expect(result.current.enabled).toBe(false);
      expect(result.current.isStateSettled).toBe(true);
      expect(mockDisplay).toBeUndefined();
    },
  );

  it.each([
    { networkId: props.networkId, accountIds: ['account-b'] },
    { networkId: 'another-network', accountIds: [props.accountId] },
  ])(
    'does not invalidate for an unrelated privacy scope %j',
    async (payload) => {
      renderHook(useLocalWalletPool, { initialProps: props });
      await flushReads();
      emitPrivacyChange(payload);
      await flushReads();
      expect(mockGetState).toHaveBeenCalledTimes(1);
      expect(mockDisplay?.address).toBe('u-account-a');
    },
  );

  it('stays ready while revalidating on return to the page', async () => {
    const { result, rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushReads();
    expect(result.current.isStateSettled).toBe(true);

    let answer: (state: ILocalWalletAccountState) => void = () => {};
    mockGetState.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    mockFocused = false;
    rerender(props);
    mockFocused = true;
    rerender(props);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isStateSettled).toBe(true);
    expect(result.current.enabled).toBe(true);

    await act(async () => {
      answer({ enabled: true, paused: false });
    });
  });

  it('keeps what it read across a tab switch', async () => {
    const { result, rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushReads();
    rerender({ ...props, isActive: false });
    rerender(props);
    expect(result.current.poolAddress).toBe('u-account-a');
    expect(result.current.hasAttemptedBalance).toBe(true);
  });

  it('does not restart account reads or clear the display on ordinary token refreshes', async () => {
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    const display = mockDisplay;
    const balanceReads = mockGetBalance.mock.calls.length;
    for (let index = 0; index < 5; index += 1) {
      emitPrivacyChange(undefined, EAppEventBusNames.RefreshTokenList);
      await flushReads();
    }
    expect(mockGetState).toHaveBeenCalledTimes(1);
    expect(mockGetAddresses).toHaveBeenCalledTimes(1);
    expect(mockGetBalance).toHaveBeenCalledTimes(balanceReads);
    expect(result.current.hasAttemptedBalance).toBe(true);
    expect(mockDisplay).toBe(display);
  });

  it('fails closed if the privacy-state revalidation fails', async () => {
    const { result, rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushReads();
    mockFocused = false;
    rerender(props);
    mockGetState.mockRejectedValueOnce(new Error('unavailable'));
    mockFocused = true;
    rerender(props);
    await flushReads();
    expect(result.current.enabled).toBe(false);
    expect(result.current.isStateSettled).toBe(false);
    expect(mockDisplay).toBeUndefined();
  });

  it('never publishes a prior account address or action under the next owner', async () => {
    const { result, rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushReads();
    let resolveAddresses: (
      value: ILocalWalletAccountAddresses,
    ) => void = () => {};
    mockGetAddresses.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAddresses = resolve;
        }),
    );
    act(() => result.current.refresh());
    await flushReads();

    mockGetState.mockImplementationOnce(() => new Promise(() => {}));
    rerender({ ...props, accountId: 'account-b' });
    expect(result.current.addresses).toBeUndefined();
    expect(result.current.balance).toBeUndefined();
    expect(result.current.hasAttemptedBalance).toBe(false);
    expect(mockDisplay).toBeUndefined();

    await act(async () => {
      resolveAddresses({
        publicAddress: 't-account-a',
        privateAddress: 'u-late-account-a',
      });
    });
    expect(result.current.poolAddress).toBeUndefined();
    expect(mockDisplay).toBeUndefined();

    emitPrivacyChange({
      networkId: props.networkId,
      accountIds: ['account-b'],
    });
    await flushReads();
    expect(result.current.poolAddress).toBe('u-account-b');
    expect(mockDisplay?.address).toBe('u-account-b');
    expect(mockDisplay?.ownerKey).toBe('account-b_zec--0_4');
    expect(mockDisplay?.action?.fromAddress).toBe('t-account-b');
  });

  it('does not let a late balance read settle the next account', async () => {
    const resolveBalance: Record<
      string,
      (value: ILocalWalletAccountBalance) => void
    > = {};
    mockGetBalance.mockImplementation(
      ({ accountId }) =>
        new Promise((resolve) => {
          resolveBalance[accountId] = resolve;
        }),
    );
    const { result, rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushReads();
    expect(resolveBalance['account-a']).toBeDefined();

    rerender({ ...props, accountId: 'account-b' });
    await flushReads();
    expect(resolveBalance['account-b']).toBeDefined();
    await act(async () => resolveBalance['account-a']({ pools: [] }));
    expect(result.current.hasAttemptedBalance).toBe(false);
    expect(result.current.balance).toBeUndefined();

    await act(async () => resolveBalance['account-b']({ pools: [] }));
    expect(result.current.hasAttemptedBalance).toBe(true);
    expect(result.current.balance).toEqual({ pools: [] });
  });
});

describe('a chain with one kind of balance still gets its local wallet UI', () => {
  const POOLED = {
    balanceShape: 'pooled',
    pools: [
      {
        id: 4,
        key: 'ironwood',
        kind: 'private',
        source: 'localScan',
        label: 'Ironwood',
      },
    ],
  };
  const SINGLE = {
    balanceShape: 'single',
    pools: [
      {
        id: 1,
        key: 'private',
        kind: 'private',
        source: 'localScan',
        label: 'Monero',
      },
    ],
  };

  afterEach(() => {
    mockLocalWalletSettings = POOLED;
  });

  it.each([
    {
      title: 'shows the private UI for a single-balance chain',
      settings: SINGLE,
      networkId: 'xmr--0',
      poolId: 1,
      expected: true,
    },
    {
      title: 'still shows it for a pooled chain',
      settings: POOLED,
      networkId: 'zec--0',
      poolId: 4,
      expected: true,
    },
    {
      title: 'shows nothing for a chain with no local wallet',
      settings: undefined,
      networkId: 'eth--1',
      poolId: undefined,
      expected: false,
    },
  ])('$title', ({ settings, networkId, poolId, expected }) => {
    mockLocalWalletSettings = settings;
    const { result } = renderHook(() =>
      useLocalWalletPool({ networkId, accountId: 'account-a', poolId }),
    );
    expect(result.current.hasPooledBalance).toBe(expected);
  });
});

describe('a wallet the chain cannot serve', () => {
  afterEach(() => {
    mockWalletSupport = 'supported';
  });

  it('reports itself unsupported and settles immediately', async () => {
    mockWalletSupport = 'unsupported';
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'xmr--0',
        accountId: 'hw-2c435a9b--0',
        poolId: 1,
      }),
    );
    await flushReads();
    expect(result.current.isUnsupportedWallet).toBe(true);
    expect(result.current.isReady).toBe(true);
  });

  it('leaves a supported wallet alone', async () => {
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'xmr--0',
        accountId: 'hd-1--0',
        poolId: 1,
      }),
    );
    await flushReads();
    expect(result.current.isUnsupportedWallet).toBe(false);
  });

  it('is not ready until the support answer lands', () => {
    mockWalletSupport = 'unsupported';
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'xmr--0',
        accountId: 'hw-2c435a9b--0',
        poolId: 1,
      }),
    );
    expect(result.current.isWalletSupported).toBeUndefined();
    expect(result.current.isReady).toBe(false);
  });

  it('reports a temp wallet as unsupported, with its own reason', async () => {
    mockWalletSupport = 'tempWallet';
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'zec--0',
        accountId: 'hw-2c435a9b-passphrase--0',
        poolId: 1,
        accountData: {
          account: undefined,
          vaultSettings: {
            localWallet: mockLocalWalletSettings,
          } as unknown as IVaultSettings,
        },
      }),
    );
    await flushReads();
    expect(result.current.isUnsupportedWallet).toBe(true);
    expect(result.current.isTempWallet).toBe(true);
    expect(result.current.isReady).toBe(true);
  });

  // Kept from Wallet settings: the page reads again without unmounting, and keeps its answer
  // meanwhile instead of blanking.
  it('reads again once a temp wallet is kept', async () => {
    mockWalletSupport = 'tempWallet';
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    expect(result.current.isTempWallet).toBe(true);

    mockWalletSupport = 'supported';
    emitPrivacyChange();
    expect(result.current.isReady).toBe(true);
    expect(result.current.isTempWallet).toBe(true);
    await flushReads();

    expect(result.current.isTempWallet).toBe(false);
    expect(result.current.isUnsupportedWallet).toBe(false);
  });

  it('does not call a wallet of an unsupported type temp', async () => {
    mockWalletSupport = 'unsupported';
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'xmr--0',
        accountId: 'hw-2c435a9b--0',
        poolId: 1,
      }),
    );
    await flushReads();
    expect(result.current.isUnsupportedWallet).toBe(true);
    expect(result.current.isTempWallet).toBe(false);
  });
});

describe('resolveSelectedPoolId', () => {
  const POOLED = {
    balanceShape: 'pooled',
    pools: [
      {
        id: 0,
        key: 'transparent',
        kind: 'public',
        source: 'backend',
        label: 'Transparent',
      },
      {
        id: 4,
        key: 'ironwood',
        kind: 'private',
        source: 'localScan',
        label: 'Ironwood',
        isDefaultPrivate: true,
      },
    ],
  } as never;
  const SINGLE = {
    balanceShape: 'single',
    pools: [
      {
        id: 1,
        key: 'private',
        kind: 'private',
        source: 'localScan',
        label: 'Monero',
        isDefaultPrivate: true,
      },
    ],
  } as never;

  it('selects the one pool of a single-balance chain with no tabs', () => {
    expect(
      resolveSelectedPoolId({ settings: SINGLE, selectedPoolId: undefined }),
    ).toBe(1);
  });

  it('leaves a pooled chain to its tabs', () => {
    expect(
      resolveSelectedPoolId({ settings: POOLED, selectedPoolId: undefined }),
    ).toBeUndefined();
    expect(resolveSelectedPoolId({ settings: POOLED, selectedPoolId: 4 })).toBe(
      4,
    );
  });

  it('never overrides an explicit selection', () => {
    expect(resolveSelectedPoolId({ settings: SINGLE, selectedPoolId: 9 })).toBe(
      9,
    );
  });

  it('selects nothing for a chain with no local wallet', () => {
    expect(
      resolveSelectedPoolId({ settings: undefined, selectedPoolId: undefined }),
    ).toBeUndefined();
  });
});

it.each([true, false])(
  'transparent pool publishes indexer balance when privacy enabled=%s',
  async (enabled) => {
    mockEnabled = enabled;
    mockLocalWalletSettings = {
      balanceShape: 'pooled',
      pools: [
        {
          id: 0,
          key: 'transparent',
          kind: 'public',
          source: 'backend',
          label: 'Transparent',
        },
        {
          id: 4,
          key: 'ironwood',
          kind: 'private',
          source: 'localScan',
          label: 'Ironwood',
        },
      ],
    };
    mockGetBalance.mockResolvedValue({
      pools: [{ key: 'transparent', totalParsed: '0', hints: [] }],
    });
    renderHook(useLocalWalletPool, { initialProps: { ...props, poolId: 0 } });
    await flushReads();
    await flushReads();
    expect(mockGetBalance).toHaveBeenCalled();
    expect(mockDisplay?.balanceParsed).toBe('0');
  },
);

it('schedules a manual refresh without turning its request time into a success time', async () => {
  mockGetLastSyncedAt.mockResolvedValue(1_700_000_000_000);
  const { result } = renderHook(useLocalWalletPool, { initialProps: props });
  await flushReads();
  expect(result.current.lastSyncedAt).toBe(1_700_000_000_000);
  await act(async () => {
    await result.current.refreshBalanceNow();
  });
  expect(mockRefreshAccount).toHaveBeenCalledWith({
    networkId: props.networkId,
    accountId: props.accountId,
  });
  expect(result.current.busy).toBe(true);
  expect(result.current.lastSyncedAt).toBe(1_700_000_000_000);
});

describe('manual refresh follows the account scan completion', () => {
  const progress: ILocalWalletSyncProgress = {
    birthdayHeight: 1,
    backfillScannedHeight: 100,
    backfillTargetHeight: 100,
    backfillProgress: 1,
    isBackfillComplete: true,
    tipScannedHeight: 100,
    chainTip: 100,
    tipLag: 0,
    isTipCaughtUp: true,
    isSyncing: false,
    lastSyncedAt: 1000,
  };
  const publish = (state: Partial<IPrivacyChainScanState> = {}) => {
    act(() => {
      setPublishedScanState({
        progress: { [`${props.networkId}:${props.accountId}`]: progress },
        completedScanByAccount: {
          [`${props.networkId}:${props.accountId}`]: {
            sessionId: 'refresh-session',
            sequence: 3,
          },
        },
        ...state,
      });
    });
  };
  beforeEach(() => {
    mockRefreshAccount.mockResolvedValue({
      scanRequested: true,
      afterSequence: 3,
      sessionId: 'refresh-session',
    });
    publish();
  });
  afterEach(() => {
    setPublishedScanState({});
  });

  it('deduplicates presses and waits for a newer completion even at the same timestamp', async () => {
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    await act(async () => {
      await Promise.all([
        result.current.refreshBalanceNow(),
        result.current.refreshBalanceNow(),
      ]);
    });
    await act(async () => result.current.refreshBalanceNow());
    expect(mockRefreshAccount).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
    for (const sequence of [3, 2]) {
      publish({
        progress: {
          [`${props.networkId}:${props.accountId}`]: {
            ...progress,
            lastSyncedAt: 2000,
          },
        },
        completedScanByAccount: {
          [`${props.networkId}:${props.accountId}`]: {
            sessionId: 'refresh-session',
            sequence,
          },
          [`${props.networkId}:other`]: {
            sessionId: 'refresh-session',
            sequence: 20,
          },
        },
      });
      expect(result.current.busy).toBe(true);
    }
    const reads = mockGetBalance.mock.calls.length;
    publish({
      completedScanByAccount: {
        [`${props.networkId}:${props.accountId}`]: {
          sessionId: 'refresh-session',
          sequence: 4,
        },
      },
    });
    await flushMicrotasks();
    expect(result.current.busy).toBe(false);
    expect(result.current.lastSyncedAt).toBe(1000);
    expect(mockGetBalance.mock.calls.length).toBeGreaterThan(reads);
  });

  it('recognizes completion that was published before the scheduling RPC returned', async () => {
    let resolveRefresh: (value: IRefreshResult) => void = () => {};
    mockRefreshAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    let request: Promise<void> | undefined;
    act(() => {
      request = result.current.refreshBalanceNow();
    });
    publish({
      completedScanByAccount: {
        [`${props.networkId}:${props.accountId}`]: {
          sessionId: 'refresh-session',
          sequence: 4,
        },
      },
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      resolveRefresh({
        scanRequested: true,
        afterSequence: 3,
        sessionId: 'refresh-session',
      });
      await request;
    });
    expect(result.current.busy).toBe(false);
  });

  it('finishes from authoritative completion without a published position', async () => {
    publish({ progress: {}, completedScanByAccount: undefined });
    mockGetSyncProgress.mockResolvedValue(progress);
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    await act(async () => result.current.refreshBalanceNow());
    expect(result.current.busy).toBe(true);
    publish({
      progress: {},
      completedScanByAccount: {
        [`${props.networkId}:${props.accountId}`]: {
          sessionId: 'refresh-session',
          sequence: 4,
        },
      },
    });
    expect(result.current.busy).toBe(false);
  });

  it('does not mistake an old UI completion for success after the background restarts', async () => {
    mockRefreshAccount.mockResolvedValueOnce({
      scanRequested: true,
      afterSequence: 0,
      sessionId: 'new-background',
    });
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    await act(async () => result.current.refreshBalanceNow());
    expect(result.current.busy).toBe(true);
    publish({
      completedScanByAccount: {
        [`${props.networkId}:${props.accountId}`]: {
          sessionId: 'new-background',
          sequence: 1,
        },
      },
    });
    expect(result.current.busy).toBe(false);
  });

  it('ends an outstanding wait when another background session publishes completion', async () => {
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    await act(async () => result.current.refreshBalanceNow());
    expect(result.current.busy).toBe(true);
    publish({
      completedScanByAccount: {
        [`${props.networkId}:${props.accountId}`]: {
          sessionId: 'new-background',
          sequence: 1,
        },
      },
    });
    expect(result.current.busy).toBe(false);
  });

  it.each([
    { pausedNetworkIds: [props.networkId] },
    { storageUnsupportedNetworkIds: [props.networkId] },
    { syncErrorByNetworkId: { [props.networkId]: 'nodeUnreachable' } },
    { scanAllowed: false },
  ] satisfies Partial<IPrivacyChainScanState>[])(
    'ends waiting when scanning stops: %j',
    async (state) => {
      const { result } = renderHook(useLocalWalletPool, {
        initialProps: props,
      });
      await flushMicrotasks();
      await act(async () => result.current.refreshBalanceNow());
      expect(result.current.busy).toBe(true);
      publish(state);
      expect(result.current.busy).toBe(false);
      expect(result.current.lastSyncedAt).toBe(1000);
    },
  );

  it.each([false, true])(
    'ends waiting when the account stops (paused: %s)',
    async (paused) => {
      const { result } = renderHook(useLocalWalletPool, {
        initialProps: props,
      });
      await flushMicrotasks();
      await act(async () => result.current.refreshBalanceNow());
      mockEnabled = false;
      mockPaused = paused;
      emitPrivacyChange();
      await flushMicrotasks();
      expect(result.current.busy).toBe(false);
    },
  );

  it('does not let a previous account RPC end the new account refresh', async () => {
    let resolveOld: (value: IRefreshResult) => void = () => {};
    mockRefreshAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const { result, rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushMicrotasks();
    let previous: Promise<void> | undefined;
    act(() => {
      previous = result.current.refreshBalanceNow();
    });
    rerender({ ...props, accountId: 'account-b' });
    await flushMicrotasks();
    expect(result.current.busy).toBe(false);
    await act(async () => result.current.refreshBalanceNow());
    expect(result.current.busy).toBe(true);
    await act(async () => {
      resolveOld({ scanRequested: false });
      await previous;
    });
    expect(result.current.busy).toBe(true);
    publish({
      completedScanByAccount: {
        [`${props.networkId}:account-b`]: {
          sessionId: 'refresh-session',
          sequence: 4,
        },
      },
    });
    expect(result.current.busy).toBe(false);
  });

  it.each([{ scanRequested: false }, undefined])(
    'does not wait when no scan was accepted: %j',
    async (response) => {
      mockRefreshAccount.mockResolvedValueOnce(response);
      const { result } = renderHook(useLocalWalletPool, {
        initialProps: props,
      });
      await flushMicrotasks();
      await act(async () => result.current.refreshBalanceNow());
      expect(result.current.busy).toBe(false);
    },
  );

  it('clears a rejected request so it can be retried', async () => {
    const error = new Error('request failed');
    mockRefreshAccount.mockRejectedValueOnce(error);
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    await act(async () => {
      await expect(result.current.refreshBalanceNow()).rejects.toBe(error);
    });
    expect(result.current.busy).toBe(false);
    await act(async () => result.current.refreshBalanceNow());
    expect(result.current.busy).toBe(true);
    expect(mockRefreshAccount).toHaveBeenCalledTimes(2);
  });

  it('clears pending on leaving the page and permits a fresh request on return', async () => {
    const { result, rerender } = renderHook(useLocalWalletPool, {
      initialProps: props,
    });
    await flushMicrotasks();
    await act(async () => result.current.refreshBalanceNow());
    expect(result.current.busy).toBe(true);
    rerender({ ...props, isActive: false });
    expect(result.current.busy).toBe(false);
    rerender(props);
    await flushMicrotasks();
    await act(async () => result.current.refreshBalanceNow());
    expect(result.current.busy).toBe(true);
    expect(mockRefreshAccount).toHaveBeenCalledTimes(2);
  });
});

it('keeps the balance available if optional refresh metadata cannot be read', async () => {
  mockGetLastSyncedAt.mockRejectedValue(new Error('metadata unavailable'));
  const { result } = renderHook(useLocalWalletPool, { initialProps: props });
  await flushReads();
  expect(result.current.balance?.pools[0]?.totalParsed).toBe('1');
  expect(result.current.lastSyncedAt).toBeUndefined();
});
