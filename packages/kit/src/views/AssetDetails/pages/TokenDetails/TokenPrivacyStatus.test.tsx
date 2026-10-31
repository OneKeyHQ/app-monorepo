import { act, renderHook } from '@testing-library/react-native';

import type { ILocalWalletSyncStatus } from '@onekeyhq/kit-bg/src/vaults/localWallet/syncStatus';
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
    busy: false,
    accountName: 'Account #1',
    isTempWallet: false,
    refresh: jest.fn(),
    refreshBalanceNow: jest.fn(async () => undefined),
    startSync: jest.fn(async () => undefined),
    enableAccount: jest.fn(async () => undefined),
    deleteLocalData: jest.fn(async () => undefined),
    ...overrides,
  };
}

function renderStatus(value: ILocalWalletPool) {
  return renderHook(() => useTokenPrivacyStatus({ pool: value }));
}

beforeEach(() => {
  mockSetAllowCellularSync.mockClear();
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
    expect(syncing.onStop).toBeUndefined();
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
