/* eslint-disable import/first */

import type { Dispatch, SetStateAction } from 'react';

import { act, renderHook } from '@testing-library/react-native';

import type { IPrivacyChainPoolDisplayData } from '@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool';
import type {
  ILocalWalletAccountAddresses,
  ILocalWalletAccountBalance,
  ILocalWalletAccountState,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';

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
      // jest hoists this factory above the `var` declarations below.
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      isLocalWalletAccountSupported: async () => mockWalletSupported,
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrivacyChainAtom: () => [
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    { storageUnsupportedNetworkIds: mockStorageUnsupportedNetworkIds },
  ],
}));
jest.mock('@onekeyhq/kit/src/hooks/useAccountData', () => ({
  useAccountData: ({ accountId }: IAccountParams) => ({
    account: { id: accountId, address: `t-${accountId}` },
    vaultSettings: {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      localWallet: mockLocalWalletSettings,
    },
  }),
}));
// Mutable so one test can describe a single-balance chain. Declared with
// `var` because jest hoists the factory above `const` initialization.
// Whether the chain has a keyring for this wallet type; a chain with no
// hardware keyring (Monero) answers false for a hardware account.
// eslint-disable-next-line no-var, vars-on-top
var mockWalletSupported = true;
// eslint-disable-next-line no-var, vars-on-top
var mockStorageUnsupportedNetworkIds: string[] = [];
// eslint-disable-next-line no-var, vars-on-top
var mockLocalWalletSettings: Record<string, unknown> = {
  balanceShape: 'pooled',
  pools: [{ id: 4, key: 'ironwood', kind: 'private', label: 'Ironwood' }],
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
jest.mock('@onekeyhq/kit/src/utils/privacyChainSyncDisplay', () => ({}));
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
  mockWalletSupported = true;
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

// An outdated WebView never produces progress; without this the row would
// read "— / —" forever.
describe('useLocalWalletPool on a device that cannot store the database', () => {
  afterEach(() => {
    mockStorageUnsupportedNetworkIds = [];
  });

  it('says to update the WebView instead of showing sync progress', async () => {
    mockStorageUnsupportedNetworkIds = [props.networkId];
    const { result } = renderHook(useLocalWalletPool, { initialProps: props });
    await flushReads();
    expect(result.current.syncStatusText).toBe(
      'privacy_error_webview_outdated__msg',
    );
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

  // Returning to the page used to clear the state while it revalidated, and
  // the whole private UI collapsed until the answer came back.
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

  // Switching tabs toggles `isActive`; the reads already on screen must
  // survive it.
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
    for (let index = 0; index < 5; index += 1) {
      emitPrivacyChange(undefined, EAppEventBusNames.RefreshTokenList);
      await flushReads();
    }
    expect(mockGetState).toHaveBeenCalledTimes(1);
    expect(mockGetAddresses).toHaveBeenCalledTimes(1);
    expect(mockGetBalance).toHaveBeenCalledTimes(1);
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
    pools: [{ id: 4, key: 'ironwood', kind: 'private', label: 'Ironwood' }],
  };
  const SINGLE = {
    balanceShape: 'single',
    pools: [{ id: 1, key: 'private', kind: 'private', label: 'Monero' }],
  };

  afterEach(() => {
    mockLocalWalletSettings = POOLED;
  });

  /**
   * **Regression.** `hasPooledBalance` gates the whole private UI -- scan
   * toggle, sync progress, pool status, repair controls -- but it used to be
   * `balanceShape === 'pooled'`.
   *
   * `balanceShape` means "distinct balances the user can move between", which
   * is what drives the per-pool tabs and nothing else. Monero has one kind of
   * output and nothing to move between, so it correctly declares `single` --
   * and every piece of its local-wallet UI silently vanished. The chain looked
   * like it had no local wallet at all, with nothing in the logs.
   */
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

/**
 * A wallet the chain has no keyring for must not be offered the scan toggle.
 * Monero declares no hardware keyring at all, so a hardware account there can
 * never scan -- offering the toggle and failing on press is the shape this
 * prevents.
 */
describe('a wallet the chain cannot serve', () => {
  afterEach(() => {
    mockWalletSupported = true;
  });

  it('reports itself unsupported and settles immediately', async () => {
    mockWalletSupported = false;
    const { result } = renderHook(() =>
      useLocalWalletPool({
        networkId: 'xmr--0',
        accountId: 'hw-2c435a9b--0',
        poolId: 1,
      }),
    );
    await flushReads();
    expect(result.current.isUnsupportedWallet).toBe(true);
    // Settled without waiting on the four account reads, so the UI renders
    // its one line instead of sitting on a spinner forever.
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

  /**
   * The support answer has to land before `isReady`, or the toggle renders
   * for a beat and then disappears -- which reads as a bug and, worse, is
   * long enough to press.
   */
  it('is not ready until the support answer lands', () => {
    mockWalletSupported = false;
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
});

/**
 * **Regression.** The scan toggle, sync line and pool status all key off a
 * selected pool, and only the pool tabs select one. Monero declares `single`
 * and so renders no tabs: nothing selected its pool, and the token page never
 * showed the toggle. The only way to start scanning was Settings.
 */
describe('resolveSelectedPoolId', () => {
  const POOLED = {
    balanceShape: 'pooled',
    pools: [
      { id: 0, key: 'transparent', kind: 'public', label: 'Transparent' },
      {
        id: 4,
        key: 'ironwood',
        kind: 'private',
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
        { id: 0, key: 'transparent', kind: 'public', label: 'Transparent' },
        { id: 4, key: 'ironwood', kind: 'private', label: 'Ironwood' },
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
