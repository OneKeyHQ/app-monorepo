import { act, renderHook } from '@testing-library/react-native';

import type { ILocalWalletSyncStatus } from '@onekeyhq/kit-bg/src/utils/privacyChainSyncStatus';
import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenPrivacyStatus } from './TokenPrivacyStatus';

import type { ILocalWalletPool } from './useLocalWalletPool';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values ? `${id}:${JSON.stringify(values)}` : id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({
    formatDate: (date: Date) => `date(${date.getTime()})`,
  }),
}));

jest.mock('@onekeyhq/components', () => ({ Button: () => null }));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

const mockSetAllowCellularSync = jest.fn(
  async (_params: { allow: boolean }) => undefined,
);
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      setAllowCellularSync: (params: { allow: boolean }) =>
        mockSetAllowCellularSync(params),
    },
  },
}));

const syncingProgress: ILocalWalletSyncProgress = {
  birthdayHeight: 100,
  backfillScannedHeight: 150,
  backfillTargetHeight: 200,
  backfillProgress: 0.5,
  isBackfillComplete: false,
  tipScannedHeight: 150,
  chainTip: 200,
  tipLag: 50,
  isTipCaughtUp: false,
  isSyncing: true,
};

function pool(
  syncStatus: ILocalWalletSyncStatus | undefined,
  overrides: Partial<ILocalWalletPool> = {},
): ILocalWalletPool {
  return {
    settings: undefined,
    hasPooledBalance: true,
    isWalletSupported: true,
    isUnsupportedWallet: false,
    pool: undefined,
    state: { enabled: true, paused: false },
    isStateSettled: true,
    isReady: true,
    enabled: true,
    balance: undefined,
    lastSyncedAt: undefined,
    poolBalance: undefined,
    poolAddress: undefined,
    addresses: undefined,
    syncProgress: undefined,
    syncStatusText: null,
    syncStatus,
    isPreparing: false,
    isSyncPaused: false,
    isNetworkPaused: false,
    hasSyncError: false,
    hasAttemptedBalance: true,
    actionBusy: false,
    busy: false,
    accountName: 'Account #1',
    isTempWallet: false,
    refresh: jest.fn(),
    refreshBalanceNow: jest.fn(async () => undefined),
    startSync: jest.fn(async () => undefined),
    pauseSync: jest.fn(async () => undefined),
    enableAccount: jest.fn(async () => undefined),
    ...overrides,
  };
}

function renderStatus(
  value: ILocalWalletPool,
  ownerKey = 'xmr:account-1:private',
) {
  return renderHook(
    (props: { value: ILocalWalletPool; ownerKey: string }) =>
      useTokenPrivacyStatus({ pool: props.value, ownerKey: props.ownerKey }),
    { initialProps: { value, ownerKey } },
  );
}

function deferredControl() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockSetAllowCellularSync.mockClear();
});

describe('token privacy control transitions', () => {
  const ownerKey = 'xmr:account-1:private';

  it.each([ownerKey, 'zec:account-1:private'])(
    '%s keeps the paused panel through transient resume progress until the request settles',
    async (testOwnerKey) => {
      const control = deferredControl();
      const value = pool('accountPaused', {
        state: { enabled: false, paused: true },
        lastSyncedAt: 1_700_000_000_000,
        enableAccount: jest.fn(() => control.promise),
      });
      const { result, rerender } = renderStatus(value, testOwnerKey);
      const updatedAtLabel = result.current.updatedAtLabel;
      act(() => result.current.onSync?.());

      const frames = [
        { syncStatus: 'preparing', actionBusy: true, busy: true },
        {
          syncStatus: 'syncing',
          syncStatusText: '3,777,387 / 3,804,854',
          syncProgress: syncingProgress,
          actionBusy: true,
          busy: true,
        },
        { syncStatus: 'preparing', actionBusy: false, busy: false },
      ] satisfies Partial<ILocalWalletPool>[];
      for (const frame of frames) {
        rerender({
          ownerKey: testOwnerKey,
          value: {
            ...value,
            state: { enabled: true, paused: false },
            ...frame,
          },
        });
        expect(result.current).toMatchObject({
          state: 'stopped',
          detail: undefined,
          progress: undefined,
          updatedAtLabel,
          busy: true,
        });
        expect(result.current.onSync).toBeDefined();
        expect(result.current.onStop).toBeUndefined();
      }

      await act(async () => {
        control.resolve();
        await control.promise;
      });
      expect(result.current).toMatchObject({
        state: 'preparing',
        detail: undefined,
        progress: undefined,
        updatedAtLabel: undefined,
        busy: false,
      });
      expect(result.current.onStop).toBeDefined();
    },
  );

  it.each([ownerKey, 'zec:account-1:private'])(
    '%s keeps the running figures and Pause action while the pause request settles',
    async (testOwnerKey) => {
      const control = deferredControl();
      const value = pool('syncing', {
        syncStatusText: '150 / 200',
        syncProgress: syncingProgress,
        busy: true,
        pauseSync: jest.fn(() => control.promise),
      });
      const { result, rerender } = renderStatus(value, testOwnerKey);
      expect(result.current.busy).toBe(false);
      act(() => result.current.onStop?.());
      expect(value.pauseSync).toHaveBeenCalledTimes(1);
      rerender({
        ownerKey: testOwnerKey,
        value: {
          ...value,
          state: { enabled: false, paused: true },
          syncStatus: 'accountPaused',
          syncStatusText: null,
          syncProgress: undefined,
          lastSyncedAt: 1_700_000_000_000,
          busy: false,
        },
      });
      expect(result.current).toMatchObject({
        state: 'syncing',
        detail: '150 / 200',
        progress: 50,
        updatedAtLabel: undefined,
        busy: true,
      });
      expect(result.current.onStop).toBeDefined();

      await act(async () => {
        control.resolve();
        await control.promise;
      });
      expect(result.current).toMatchObject({
        state: 'stopped',
        detail: undefined,
        progress: undefined,
        busy: false,
      });
      expect(result.current.updatedAtLabel).toContain('date(1700000000000)');
      expect(result.current.onStop).toBeUndefined();
      expect(result.current.onSync).toBeDefined();
    },
  );

  it.each(['pause', 'resume'] as const)(
    'deduplicates same-frame %s presses before busy props update',
    async (action) => {
      const control = deferredControl();
      const operation = jest.fn(() => control.promise);
      const value = pool(
        action === 'pause' ? 'syncing' : 'accountPaused',
        action === 'pause'
          ? { pauseSync: operation }
          : { enableAccount: operation },
      );
      const { result, rerender } = renderStatus(value);
      const press =
        action === 'pause' ? result.current.onStop : result.current.onSync;
      act(() => {
        press?.();
        press?.();
      });
      expect(operation).toHaveBeenCalledTimes(1);
      expect(result.current.busy).toBe(true);

      rerender({ value: { ...value }, ownerKey });
      act(() => {
        result.current.onSync?.();
        result.current.onStop?.();
      });
      expect(operation).toHaveBeenCalledTimes(1);
      expect(value.refreshBalanceNow).not.toHaveBeenCalled();
      await act(async () => {
        control.resolve();
        await control.promise;
      });
      await act(async () => {
        const nextPress =
          action === 'pause' ? result.current.onStop : result.current.onSync;
        nextPress?.();
      });
      expect(operation).toHaveBeenCalledTimes(2);
    },
  );

  it('drops another owner snapshot and ignores its late completion during a new request', async () => {
    const first = deferredControl();
    const second = deferredControl();
    const { result, rerender } = renderStatus(
      pool('accountPaused', {
        lastSyncedAt: 1_700_000_000_000,
        enableAccount: jest.fn(() => first.promise),
      }),
    );
    act(() => result.current.onSync?.());

    const nextOwnerKey = 'xmr:account-2:private';
    const nextValue = pool('syncing', {
      syncStatusText: '175 / 200',
      syncProgress: { ...syncingProgress, backfillProgress: 0.75 },
      pauseSync: jest.fn(() => second.promise),
    });
    rerender({ value: nextValue, ownerKey: nextOwnerKey });
    expect(result.current).toMatchObject({
      state: 'syncing',
      detail: '175 / 200',
      progress: 75,
      updatedAtLabel: undefined,
      busy: false,
    });
    act(() => result.current.onStop?.());
    expect(nextValue.pauseSync).toHaveBeenCalledTimes(1);
    rerender({
      ownerKey: nextOwnerKey,
      value: {
        ...nextValue,
        state: { enabled: false, paused: true },
        syncStatus: 'accountPaused',
        syncProgress: undefined,
      },
    });

    await act(async () => {
      first.resolve();
      await first.promise;
    });
    expect(result.current).toMatchObject({
      state: 'syncing',
      detail: '175 / 200',
      progress: 75,
      busy: true,
    });
    expect(result.current.onStop).toBeDefined();
    await act(async () => {
      second.resolve();
      await second.promise;
    });
    expect(result.current).toMatchObject({ state: 'stopped', busy: false });
  });

  it.each([
    ['error', pool('error', { syncStatusText: 'Node unavailable' }), 'error'],
    ['storage unsupported', pool('storageUnsupported'), 'error'],
    ['disabled', pool('off', { enabled: false }), 'disabled'],
    ['unavailable', pool('unavailable'), 'disabled'],
    [
      'unsupported wallet',
      pool('syncing', { isUnsupportedWallet: true }),
      'disabled',
    ],
    ['state invalidated', pool(undefined, { isReady: false }), 'preparing'],
  ] as const)(
    'permanently discards the pending snapshot when %s is observed',
    async (_reason, invalidValue, expectedState) => {
      const control = deferredControl();
      const { result, rerender } = renderStatus(
        pool('accountPaused', {
          lastSyncedAt: 1_700_000_000_000,
          enableAccount: jest.fn(() => control.promise),
        }),
      );
      act(() => result.current.onSync?.());
      rerender({ value: invalidValue, ownerKey });
      expect(result.current.state).toBe(expectedState);
      expect(result.current.updatedAtLabel).toBeUndefined();
      if (invalidValue.syncStatus === 'error') {
        expect(result.current.detail).toBe('Node unavailable');
      }

      const recovered = pool('syncing', {
        syncStatusText: '175 / 200',
        syncProgress: { ...syncingProgress, backfillProgress: 0.75 },
      });
      rerender({ value: recovered, ownerKey });
      expect(result.current).toMatchObject({
        state: 'syncing',
        detail: '175 / 200',
        progress: 75,
        updatedAtLabel: undefined,
      });
      await act(async () => {
        control.resolve();
        await control.promise;
      });
      expect(result.current.state).toBe('syncing');
    },
  );

  it('releases a rejected control request and allows a retry with the current state', async () => {
    const control = deferredControl();
    const operation = jest.fn(() => control.promise);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      const { result, rerender } = renderStatus(
        pool('accountPaused', { enableAccount: operation }),
      );
      act(() => result.current.onSync?.());
      const retry = jest.fn(async () => undefined);
      rerender({
        ownerKey,
        value: pool('error', {
          syncStatusText: 'Node unavailable',
          startSync: retry,
        }),
      });
      expect(result.current.state).toBe('error');
      await act(async () => {
        control.reject(new OneKeyLocalError('Resume failed'));
        await control.promise.catch(() => undefined);
      });
      expect(result.current).toMatchObject({
        state: 'error',
        detail: 'Node unavailable',
        busy: false,
      });
      expect(consoleError).toHaveBeenCalledWith(
        '[privacyChain] refresh failed',
        { error: 'Resume failed' },
      );
      await act(async () => result.current.onSync?.());
      expect(retry).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('token privacy status', () => {
  it.each([
    ['unavailable', 'disabled'],
    ['off', 'disabled'],
    ['enabling', 'preparing'],
    ['accountPaused', 'stopped'],
    ['chainPaused', 'stopped'],
    ['storageUnsupported', 'error'],
    ['waitingWifi', 'waitingWifi'],
    ['error', 'error'],
    ['preparing', 'preparing'],
    ['syncing', 'syncing'],
    ['synced', 'synced'],
  ] as const)('shows %s as the %s panel', (syncStatus, panelState) => {
    expect(renderStatus(pool(syncStatus)).result.current.state).toBe(
      panelState,
    );
  });

  it('prepares until the account is known', () => {
    const { result } = renderStatus(
      pool('synced', { isReady: false, isWalletSupported: undefined }),
    );
    expect(result.current.state).toBe('preparing');
    expect(result.current.onSync).toBeUndefined();
  });

  it('offers nothing to do while the server has privacy off', () => {
    const { result } = renderStatus(
      pool('unavailable', {
        enabled: false,
        state: { enabled: false, paused: false, privacyDisabled: true },
      }),
    );
    expect(result.current.description).toBe(ETranslations.global_not_available);
    expect(result.current.enableUnavailable).toBe(true);
    expect(result.current.onSync).toBeUndefined();
  });

  it('explains why a wallet cannot scan here', () => {
    expect(
      renderStatus(pool(undefined, { isUnsupportedWallet: true })).result
        .current.description,
    ).toBe(ETranslations.privacy_balance_wallet_not_supported__desc);
    expect(
      renderStatus(
        pool(undefined, { isUnsupportedWallet: true, isTempWallet: true }),
      ).result.current.description,
    ).toBe(ETranslations.privacy_temp_wallet_unavailable__desc);
  });

  it('offers no retry until an outdated WebView is updated', () => {
    expect(
      renderStatus(pool('storageUnsupported')).result.current.onSync,
    ).toBeUndefined();
  });

  it('shows figures while syncing and the reason for an error', () => {
    const syncing = renderStatus(
      pool('syncing', {
        syncProgress: syncingProgress,
        syncStatusText: '150 / 200 · 50.0%',
      }),
    ).result.current;
    expect(syncing.detail).toBe('150 / 200 · 50.0%');
    expect(syncing.progress).toBe(50);
    expect(syncing.onStop).toBeDefined();
    expect(
      renderStatus(
        pool('error', {
          syncStatusText: 'The current node could not be reached.',
        }),
      ).result.current.detail,
    ).toBe('The current node could not be reached.');
  });

  it('offers mobile data while it waits for Wi-Fi', async () => {
    const { result } = renderStatus(pool('waitingWifi'));
    await act(async () => {
      result.current.onAllowMobileData?.();
    });
    expect(mockSetAllowCellularSync).toHaveBeenCalledWith({ allow: true });
  });

  it.each(['syncing', 'preparing'] as const)(
    'pauses an enabled account while %s through the pool',
    async (status) => {
      const value = pool(status);
      const { result } = renderStatus(value);
      await act(async () => result.current.onStop?.());
      expect(value.pauseSync).toHaveBeenCalledTimes(1);
      expect(value.enableAccount).not.toHaveBeenCalled();
      expect(value.refreshBalanceNow).not.toHaveBeenCalled();
    },
  );

  it('allows Pause while refresh waits for scan completion, but not while a control request is pending', () => {
    const pendingRefresh = renderStatus(pool('syncing', { busy: true }));
    expect(pendingRefresh.result.current.onStop).toBeDefined();
    expect(pendingRefresh.result.current.busy).toBe(false);
    expect(
      renderStatus(pool('syncing', { busy: true, actionBusy: true })).result
        .current.busy,
    ).toBe(true);
  });

  it.each([
    pool('enabling'),
    pool('preparing', { isReady: false }),
    pool('preparing', { enabled: false }),
    pool('preparing', {
      state: { enabled: true, paused: false, pendingOperation: 'enable' },
    }),
    pool('unavailable'),
  ])(
    'withholds Pause until setup is complete and scanning can run (%#)',
    (value) => {
      expect(renderStatus(value).result.current.onStop).toBeUndefined();
    },
  );

  it.each([
    ['accountPaused', 'enableAccount'],
    ['chainPaused', 'startSync'],
    ['synced', 'refreshBalanceNow'],
    ['error', 'startSync'],
  ] as const)('acts on %s through %s', async (syncStatus, operation) => {
    const value = pool(syncStatus);
    const { result } = renderStatus(value);
    await act(async () => {
      result.current.onSync?.();
    });
    for (const name of [
      'enableAccount',
      'startSync',
      'refreshBalanceNow',
    ] as const) {
      expect(value[name]).toHaveBeenCalledTimes(name === operation ? 1 : 0);
    }
  });

  // The balance is only as new as the last sync; Resume restarts it.
  it('shows a paused account as paused since its last sync', () => {
    const { result } = renderStatus(
      pool('accountPaused', { lastSyncedAt: 1_700_000_000_000 }),
    );
    expect(result.current.updatedAtLabel).toBe(
      `${ETranslations.backup_updated_time}:${JSON.stringify({
        time: 'date(1700000000000)',
      })}`,
    );
    expect(result.current.detail).toBeUndefined();
  });

  it('keeps the last sync time off a running account', () => {
    expect(
      renderStatus(pool('synced', { lastSyncedAt: 1_700_000_000_000 })).result
        .current.updatedAtLabel,
    ).toBeUndefined();
  });

  it('logs a rejected operation instead of leaving it unhandled', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      const { result } = renderStatus(
        pool('chainPaused', {
          startSync: jest.fn(async () => {
            throw new OneKeyLocalError('Network resume failed');
          }),
        }),
      );
      await act(async () => {
        result.current.onSync?.();
      });
      expect(consoleError).toHaveBeenCalledWith(
        '[privacyChain] refresh failed',
        { error: 'Network resume failed' },
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
