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
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

type IAccountParams = { accountId: string; networkId: string };
type IPrivacyChangePayload = { networkId: string; accountIds: string[] };

let mockFocused = true;
let mockEnabled = true;
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
const mockEnableAccount = jest.fn<Promise<void>, [IAccountParams]>();

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
      getLocalWalletSyncProgress: async () => undefined,
      enableLocalWalletAccount: (params: IAccountParams) =>
        mockEnableAccount(params),
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
    storageUnsupportedNetworkIds: [] as string[],
    pausedNetworkIds: [] as string[],
    syncErrorByNetworkId: {} as Record<string, string>,
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
var mockLocalWalletSettings: Record<string, unknown> = {
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
  default: { wait: () => new Promise<void>(() => {}) },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/utils/privacyChainSyncDisplay', () => ({
  formatPrivacyChainSyncError: (kind?: string) =>
    kind ? `sync-error:${kind}` : undefined,
}));
jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/privacyChainSyncPolicy', () => ({
  PRIVACY_CHAIN_SYNC_POLL_MS: 5000,
}));

import {
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
  mockWalletSupport = 'supported';
  mockDisplay = undefined;
  mockListeners.clear();
  mockGetState.mockReset().mockImplementation(async () => ({
    enabled: mockEnabled,
    paused: !mockEnabled,
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
  async function flushMicrotasks() {
    for (let index = 0; index < 5; index += 1) {
      // oxlint-disable-next-line no-await-in-loop
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it('reads the balance as soon as the state allows it, without a timer', async () => {
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushMicrotasks();
    expect(result.current.enabled).toBe(true);
    expect(mockGetBalance).toHaveBeenCalledTimes(1);
    expect(result.current.balance?.pools[0]?.totalParsed).toBe('1');
  });
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

const setPublishedScanState = (state: Partial<IPrivacyChainScanState>) =>
  getDefaultStore().set(privacyChainAtom.atom(), {
    storageUnsupportedNetworkIds: [],
    pausedNetworkIds: [],
    syncErrorByNetworkId: {},
    ...state,
  } as IPrivacyChainScanState);

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

// Background failures never toast; the sync row is where they show.
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

  it('stays quiet about it while the network is paused', async () => {
    setPublishedScanState({
      pausedNetworkIds: [props.networkId],
      syncErrorByNetworkId: { [props.networkId]: 'nodeUnreachable' },
    });
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    expect(result.current.syncStatusText).toBeNull();
  });
});

describe('useLocalWalletPool enable failure', () => {
  // The rejection carries the toast (autoToast from the background); the
  // hook must hand it back and release the button.
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
    // The immediate first read plus the first poll, which flushReads fires.
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

  // `balanceShape` only drives the pool tabs; it must not gate the private UI.
  it('shows the private UI for a single-balance chain', () => {
    mockLocalWalletSettings = SINGLE;
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'xmr--0',
        accountId: 'account-a',
        poolId: 1,
      }),
    );
    expect(result.current.hasPooledBalance).toBe(true);
  });

  it('still shows it for a pooled chain', () => {
    mockLocalWalletSettings = POOLED;
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'zec--0',
        accountId: 'account-a',
        poolId: 4,
      }),
    );
    expect(result.current.hasPooledBalance).toBe(true);
  });

  it('shows nothing for a chain with no local wallet', () => {
    mockLocalWalletSettings = undefined as never;
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'eth--1',
        accountId: 'account-a',
        poolId: undefined,
      }),
    );
    expect(result.current.hasPooledBalance).toBe(false);
  });
});

// No keyring for the wallet type (Monero hardware): no scan toggle offered.
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
    // Settles without waiting on the account reads.
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

  // Otherwise the toggle flashes and disappears.
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

  // The token page passes its own account data; the answer must not depend on it.
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

// A single-balance chain renders no tabs, so its pool must be selected here.
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
