import { act, renderHook } from '@testing-library/react-native';
import { getDefaultStore } from 'jotai';

import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenPrivacyStatus } from './TokenPrivacyStatus';

import type { ILocalWalletPool } from './useLocalWalletPool';
import type { PrimitiveAtom } from 'jotai';

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

const mockPushModal = jest.fn();

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const { atom } = jest.requireActual<typeof import('jotai')>('jotai');
  const testPrivacyChainAtom = atom({
    dataBlockedNetworkIds: [] as string[],
    preparingNetworkIds: [] as string[],
  });
  return {
    privacyChainAtom: { atom: () => testPrivacyChainAtom },
    testPrivacyChainAtom,
  };
});

const { testPrivacyChainAtom } = jest.requireMock<{
  testPrivacyChainAtom: PrimitiveAtom<{
    dataBlockedNetworkIds: string[];
    preparingNetworkIds: string[];
  }>;
}>('@onekeyhq/kit-bg/src/states/jotai/atoms');

const completedProgress: ILocalWalletSyncProgress = {
  birthdayHeight: 100,
  backfillScannedHeight: 200,
  backfillTargetHeight: 200,
  backfillProgress: 1,
  isBackfillComplete: true,
  tipScannedHeight: 200,
  chainTip: 200,
  tipLag: 0,
  isTipCaughtUp: true,
  isSyncing: false,
};

function pool(overrides: Partial<ILocalWalletPool> = {}): ILocalWalletPool {
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
    syncProgress: completedProgress,
    syncStatusText: null,
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
    resumeNetworkSync: jest.fn(async () => undefined),
    enableAccount: jest.fn(async () => undefined),
    deleteLocalData: jest.fn(async () => undefined),
    ...overrides,
  };
}

function renderStatus(value: ILocalWalletPool) {
  return renderHook(() =>
    useTokenPrivacyStatus({
      networkId: 'zec--0',
      pool: value,
    }),
  );
}

beforeEach(() => {
  getDefaultStore().set(testPrivacyChainAtom, {
    dataBlockedNetworkIds: [],
    preparingNetworkIds: [],
  });
  mockPushModal.mockClear();
});

describe('token privacy status', () => {
  it('does not offer Sync or Enable while disabled by the server', () => {
    const { result } = renderStatus(
      pool({
        enabled: false,
        state: { enabled: false, paused: false, privacyDisabled: true },
      }),
    );
    expect(result.current.state).toBe('disabled');
    expect(result.current.description).toBe(ETranslations.global_not_available);
    expect(result.current.enableUnavailable).toBe(true);
    expect(result.current.onSync).toBeUndefined();
  });
  it('keeps an opted-in paused account stopped without requiring setup again', () => {
    const { result } = renderStatus(
      pool({
        state: { enabled: false, paused: true },
        enabled: true,
        isSyncPaused: true,
        syncProgress: undefined,
        syncStatusText: ETranslations.syncing_paused__title,
      }),
    );

    expect(result.current.state).toBe('stopped');
    // The title already says paused; the line is not repeated.
    expect(result.current.detail).toBeUndefined();
    expect(result.current.onSync).toBeDefined();
    expect(result.current.onEnable).toBeUndefined();
    expect(result.current.onStop).toBeUndefined();
  });

  it('keeps a paused detail that says more than the title', () => {
    const { result } = renderStatus(
      pool({
        state: { enabled: false, paused: true },
        isSyncPaused: true,
        hasSyncError: true,
        syncProgress: undefined,
        syncStatusText: ETranslations.privacy_error_webview_outdated__msg,
      }),
    );

    expect(result.current.state).toBe('stopped');
    expect(result.current.detail).toBe(
      ETranslations.privacy_error_webview_outdated__msg,
    );
  });

  it('waits for wallet support even when a remembered account state exists', () => {
    const { result } = renderStatus(
      pool({ isReady: false, isWalletSupported: undefined }),
    );

    expect(result.current.state).toBe('preparing');
    expect(result.current.onSync).toBeUndefined();
  });

  it('keeps pending initialization preparing despite a previous completed scan', () => {
    const { result } = renderStatus(pool({ isPreparing: true }));

    expect(result.current.state).toBe('preparing');
  });

  it('shows network preparation until the manual start publishes its next position', () => {
    getDefaultStore().set(testPrivacyChainAtom, {
      dataBlockedNetworkIds: [],
      preparingNetworkIds: ['zec--0'],
    });
    const { result } = renderStatus(pool());

    expect(result.current.state).toBe('preparing');

    act(() => {
      getDefaultStore().set(testPrivacyChainAtom, {
        dataBlockedNetworkIds: [],
        preparingNetworkIds: [],
      });
    });

    expect(result.current.state).toBe('synced');
  });

  it('only reports synced after both backfill and tip have caught up', () => {
    const { result } = renderStatus(pool());

    expect(result.current.state).toBe('synced');
    expect(result.current.progress).toBeUndefined();
  });

  it('shows an active scan even when the previous progress reached the tip', () => {
    const { result } = renderStatus(
      pool({ syncProgress: { ...completedProgress, isSyncing: true } }),
    );

    expect(result.current.state).toBe('syncing');
    expect(result.current.onStop).toBeUndefined();
  });

  it('preserves the shared hook error message instead of replacing it with preparing', () => {
    const { result } = renderStatus(
      pool({
        hasSyncError: true,
        syncProgress: undefined,
        syncStatusText: 'The current node could not be reached.',
      }),
    );

    expect(result.current.state).toBe('error');
    expect(result.current.detail).toBe(
      'The current node could not be reached.',
    );
  });

  it('explains a data-policy wait without presenting stale completed progress', () => {
    getDefaultStore().set(testPrivacyChainAtom, {
      dataBlockedNetworkIds: ['zec--0'],
      preparingNetworkIds: [],
    });
    const { result } = renderStatus(pool());

    expect(result.current.state).toBe('preparing');
    expect(result.current.detail).toBe(
      ETranslations.privacy_sync_waiting_wifi__msg,
    );
  });

  it.each([false, true])(
    'uses the existing refresh or resume operation (account paused: %s)',
    async (paused) => {
      const enableAccount = jest.fn(async () => undefined);
      const refreshBalanceNow = jest.fn(async () => undefined);
      const resumeNetworkSync = jest.fn(async () => undefined);
      const { result } = renderStatus(
        pool({
          state: { enabled: !paused, paused },
          isSyncPaused: paused,
          enableAccount,
          refreshBalanceNow,
          resumeNetworkSync,
        }),
      );

      await act(async () => {
        result.current.onSync?.();
      });

      if (paused) {
        expect(enableAccount).toHaveBeenCalledWith({});
        expect(refreshBalanceNow).not.toHaveBeenCalled();
      } else {
        expect(refreshBalanceNow).toHaveBeenCalledTimes(1);
        expect(enableAccount).not.toHaveBeenCalled();
      }
      expect(resumeNetworkSync).not.toHaveBeenCalled();
    },
  );

  it('resumes a paused network through manual boost instead of account refresh', async () => {
    const enableAccount = jest.fn(async () => undefined);
    const refreshBalanceNow = jest.fn(async () => undefined);
    const resumeNetworkSync = jest.fn(async () => undefined);
    const { result } = renderStatus(
      pool({
        state: { enabled: true, paused: false },
        isSyncPaused: true,
        isNetworkPaused: true,
        enableAccount,
        refreshBalanceNow,
        resumeNetworkSync,
      }),
    );

    expect(result.current.state).toBe('stopped');
    await act(async () => {
      result.current.onSync?.();
    });

    expect(resumeNetworkSync).toHaveBeenCalledTimes(1);
    expect(enableAccount).not.toHaveBeenCalled();
    expect(refreshBalanceNow).not.toHaveBeenCalled();
  });

  it('handles a rejected network resume without falling through to account refresh', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const resumeNetworkSync = jest.fn(async () => {
      throw new OneKeyLocalError('Network resume failed');
    });
    const refreshBalanceNow = jest.fn(async () => undefined);
    try {
      const { result } = renderStatus(
        pool({
          isSyncPaused: true,
          isNetworkPaused: true,
          resumeNetworkSync,
          refreshBalanceNow,
        }),
      );

      await act(async () => {
        result.current.onSync?.();
      });

      expect(consoleError).toHaveBeenCalledWith(
        '[privacyChain] refresh failed',
        { error: 'Network resume failed' },
      );
      expect(resumeNetworkSync).toHaveBeenCalledTimes(1);
      expect(refreshBalanceNow).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  // A manual pause and a rotation out of the sync slots read the same: the
  // balance is only as new as the last sync, and Resume restarts it.
  it('shows a paused account as paused since its last sync, never as synced', async () => {
    const enableAccount = jest.fn(async () => undefined);
    const { result } = renderStatus(
      pool({
        state: { enabled: false, paused: true },
        isSyncPaused: true,
        syncProgress: undefined,
        lastSyncedAt: 1_700_000_000_000,
        enableAccount,
      }),
    );

    expect(result.current.state).toBe('stopped');
    expect(result.current.updatedAtLabel).toBe(
      `${ETranslations.backup_updated_time}:${JSON.stringify({
        time: 'date(1700000000000)',
      })}`,
    );

    await act(async () => {
      result.current.onSync?.();
    });

    expect(enableAccount).toHaveBeenCalledWith({});
  });

  it('has no last sync time to show for an account that never synced', () => {
    const { result } = renderStatus(
      pool({
        state: { enabled: false, paused: true },
        isSyncPaused: true,
        syncProgress: undefined,
      }),
    );

    expect(result.current.state).toBe('stopped');
    expect(result.current.updatedAtLabel).toBeUndefined();
  });

  it('keeps the last sync time off a running account', () => {
    const { result } = renderStatus(pool({ lastSyncedAt: 1_700_000_000_000 }));

    expect(result.current.state).toBe('synced');
    expect(result.current.updatedAtLabel).toBeUndefined();
  });

  it('keeps a chain paused from the sync light stopped despite a last catch-up', () => {
    const { result } = renderStatus(
      pool({
        isSyncPaused: true,
        isNetworkPaused: true,
        lastSyncedAt: 1_700_000_000_000,
      }),
    );

    expect(result.current.state).toBe('stopped');
  });

  it.each([false, true])(
    'handles an operation rejection without an unhandled promise (account paused: %s)',
    async (paused) => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const operation = jest.fn(async () => {
        throw new OneKeyLocalError('Sync failed');
      });
      try {
        const { result } = renderStatus(
          pool({
            state: { enabled: !paused, paused },
            isSyncPaused: paused,
            enableAccount: operation,
            refreshBalanceNow: operation,
          }),
        );

        await act(async () => {
          result.current.onSync?.();
        });

        expect(operation).toHaveBeenCalledTimes(1);
        expect(consoleError).toHaveBeenCalledWith(
          '[privacyChain] refresh failed',
          {
            error: 'Sync failed',
          },
        );
      } finally {
        consoleError.mockRestore();
      }
    },
  );
});
