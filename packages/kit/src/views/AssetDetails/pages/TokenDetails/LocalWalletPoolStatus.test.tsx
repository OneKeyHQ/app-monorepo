/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  LocalWalletPoolStatus,
  LocalWalletSyncRow,
} from './LocalWalletPoolStatus';

import type { ILocalWalletPool } from './useLocalWalletPool';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('./LocalWalletPasswordAlert', () => ({
  LocalWalletPasswordAlert: () => null,
}));
jest.mock('./LocalWalletRepairControls', () => ({
  BirthdayDialogForm: () => null,
  LocalWalletDebugControl: () => null,
  PrivacyEnableDisclosure: () => null,
  ScanRepairControl: () => (
    <button
      type="button"
      data-testid="mock-scan-repair"
      aria-label="Repair scan"
    />
  ),
  SetupRepairControl: () => (
    <button
      type="button"
      data-testid="mock-setup-repair"
      aria-label="Retry setup"
    />
  ),
  createEnableBirthdayForm: () => ({ current: {} }),
  getBirthdayInputError: () => 'global.bulk_accounts_page_number_error',
  // `var` below: jest hoists this factory above it.
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  readEnableBirthday: () => mockBirthday,
}));
// eslint-disable-next-line no-var, vars-on-top
var mockBirthday:
  | { birthdayTimestamp?: number; birthdayHeight?: number }
  | undefined;

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  const Button = ({
    children,
    testID,
    loading,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    loading?: boolean;
    disabled?: boolean;
    onPress?: () => unknown;
  }) => (
    <button
      type="button"
      data-testid={testID}
      data-loading={String(Boolean(loading))}
      disabled={disabled || loading}
      onClick={() => {
        void onPress?.();
      }}
    >
      {children}
    </button>
  );
  return {
    Button,
    IconButton: Button,
    Dialog: { confirm: jest.fn() },
    Toast: { error: jest.fn() },
    Divider: () => null,
    Icon: () => null,
    SizableText: Wrapper,
    Stack: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
  };
});

function pool(overrides: Partial<ILocalWalletPool>): ILocalWalletPool {
  return {
    hasPooledBalance: true,
    isReady: true,
    enabled: false,
    isUnsupportedWallet: false,
    isTempWallet: false,
    busy: false,
    pool: { id: 1, source: 'localScan' },
    state: { enabled: false, paused: false },
    ...overrides,
  } as unknown as ILocalWalletPool;
}

describe('LocalWalletPoolStatus for a temp wallet', () => {
  const accountId = 'hw-1-passphrase--0';

  it('says privacy is unavailable and offers no Enable button', () => {
    render(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId={accountId}
        pool={pool({ isUnsupportedWallet: true, isTempWallet: true })}
      />,
    );

    expect(screen.getByTestId('local-wallet-disabled-desc').textContent).toBe(
      ETranslations.privacy_temp_wallet_unavailable__desc,
    );
    expect(screen.queryByTestId('local-wallet-enable-button')).toBeNull();
    expect(screen.queryByTestId('local-wallet-resume-button')).toBeNull();
  });

  it('still offers Enable to a saved wallet', () => {
    render(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId={accountId}
        pool={pool({})}
      />,
    );

    expect(screen.getByTestId('local-wallet-disabled-desc').textContent).toBe(
      'privacy_balance_privacy_off__desc',
    );
    expect(screen.getByTestId('local-wallet-enable-button')).toBeTruthy();
  });
});

describe('LocalWalletPoolStatus for an enabled account', () => {
  it('keeps identity mismatch controls out of the balance area', () => {
    const { container } = render(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enabled: true,
          hasAttemptedBalance: true,
          state: { enabled: true, paused: false, identityMismatch: true },
        })}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('keeps unfinished setup hints out of the balance area', () => {
    const { container } = render(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enabled: true,
          hasAttemptedBalance: true,
          state: { enabled: true, paused: false },
        })}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});

it.each([false, true])(
  'shows preparing without errors or repair controls while registration is pending (settings: %s)',
  (settingsMode) => {
    const pending = pool({
      enabled: true,
      hasAttemptedBalance: true,
      state: { enabled: true, paused: false },
      addresses: { publicAddress: 't1', privateAddress: 'u1' },
      balance: null,
      syncProgress: {
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
      },
      syncStatusText: 'global.preparing',
      isPreparing: true,
    });
    render(
      <>
        <LocalWalletPoolStatus
          networkId="zec--0"
          accountId="hd-1--0"
          pool={pending}
          settingsMode={settingsMode}
        />
        <LocalWalletSyncRow
          networkId="zec--0"
          accountId="hd-1--0"
          pool={pending}
        />
      </>,
    );
    expect(screen.queryByText('global.preparing') !== null).toBe(settingsMode);
    expect(
      screen.queryByText('privacy_error_setup_incomplete__msg'),
    ).toBeNull();
    expect(screen.queryByText('privacy_balance_unavailable__msg')).toBeNull();
    expect(screen.queryByText('DATABASE_ERROR')).toBeNull();
    expect(screen.queryByTestId('mock-setup-repair')).toBeNull();
    expect(screen.queryByTestId('mock-scan-repair')).toBeNull();
  },
);

type IConfirmArgs = {
  onConfirm: (params: { preventClose: () => void }) => Promise<void>;
};

it.each([
  {
    hasSyncError: true,
    isSyncPaused: false,
    syncStatusText: 'background synchronization failed',
  },
  { hasSyncError: false, isSyncPaused: true, syncStatusText: 'global.paused' },
])('shows $syncStatusText without asking for authorization again', (status) => {
  const waiting = pool({
    enabled: true,
    state: { enabled: true, paused: false },
    hasAttemptedBalance: true,
    balance: null,
    addresses: undefined,
    isPreparing: false,
    ...status,
  });
  render(
    <>
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId="hd-1--0"
        pool={waiting}
      />
      <LocalWalletSyncRow
        networkId="zec--0"
        accountId="hd-1--0"
        pool={waiting}
      />
    </>,
  );

  expect(screen.queryByText(status.syncStatusText) !== null).toBe(
    status.hasSyncError,
  );
  expect(screen.getByTestId('local-wallet-refresh-balance-btn')).toBeTruthy();
  expect(screen.queryByTestId('mock-setup-repair')).toBeNull();
  expect(screen.queryByText('privacy_error_setup_incomplete__msg')).toBeNull();
  expect(screen.queryByText('privacy_balance_unavailable__msg')).toBeNull();
});

describe('LocalWalletPoolStatus enable failure', () => {
  const { Dialog } = jest.requireMock<{
    Dialog: { confirm: jest.Mock<void, [IConfirmArgs]> };
  }>('@onekeyhq/components');

  beforeEach(() => {
    Dialog.confirm.mockReset();
    mockBirthday = { birthdayTimestamp: 1_700_000_000_000 };
  });

  function lastDialog(): IConfirmArgs {
    const call = Dialog.confirm.mock.calls.at(-1);
    expect(call).toBeDefined();
    return (call as [IConfirmArgs])[0];
  }

  it.each([undefined, { birthdayHeight: 2_500_000 }])(
    'only enables after valid birthday input',
    async (birthday) => {
      mockBirthday = birthday;
      const enableAccount = jest.fn(async () => undefined);
      render(
        <LocalWalletPoolStatus
          networkId="zec--0"
          accountId="hd-1--0"
          pool={pool({
            enableAccount,
            settings: { accountSetup: { requiresBirthday: true } },
          } as unknown as Partial<ILocalWalletPool>)}
        />,
      );
      fireEvent.click(screen.getByTestId('local-wallet-enable-button'));
      const preventClose = jest.fn();
      await act(async () => {
        await lastDialog().onConfirm({ preventClose });
      });
      if (birthday) {
        expect(enableAccount).toHaveBeenCalledWith(birthday);
        expect(preventClose).not.toHaveBeenCalled();
      } else {
        expect(enableAccount).not.toHaveBeenCalled();
        expect(preventClose).toHaveBeenCalled();
      }
    },
  );

  // The rejection carries the toast (background autoToast); the dialog must not swallow it.
  it('lets a rejected enable reach the user and keeps the dialog open', async () => {
    const failure = Object.assign(new Error('runtime unavailable'), {
      autoToast: true,
    });
    const enableAccount = jest.fn().mockRejectedValue(failure);
    render(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enableAccount,
          settings: { accountSetup: { requiresBirthday: true } },
        } as unknown as Partial<ILocalWalletPool>)}
      />,
    );

    fireEvent.click(screen.getByTestId('local-wallet-enable-button'));
    expect(Dialog.confirm).toHaveBeenCalledTimes(1);

    const preventClose = jest.fn();
    await expect(lastDialog().onConfirm({ preventClose })).rejects.toBe(
      failure,
    );
    expect(enableAccount).toHaveBeenCalledWith(mockBirthday);
    expect(preventClose).not.toHaveBeenCalled();
  });

  it('opens the dialog again after a failed attempt', async () => {
    const enableAccount = jest.fn().mockRejectedValue(new Error('offline'));
    render(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enableAccount,
          settings: { accountSetup: { requiresBirthday: true } },
        } as unknown as Partial<ILocalWalletPool>)}
      />,
    );
    const button = screen.getByTestId('local-wallet-enable-button');

    fireEvent.click(button);
    await lastDialog()
      .onConfirm({ preventClose: jest.fn() })
      .catch(() => undefined);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(button);

    expect(Dialog.confirm).toHaveBeenCalledTimes(2);
  });

  it('shows the loading state only while the hook is busy', () => {
    const { rerender } = render(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({ busy: true })}
      />,
    );
    expect(
      screen.getByTestId('local-wallet-enable-button').dataset.loading,
    ).toBe('true');

    rerender(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({ busy: false })}
      />,
    );
    expect(
      screen.getByTestId('local-wallet-enable-button').dataset.loading,
    ).toBe('false');
  });

  it('resumes a legacy paused account without a birthday prompt and handles its failure', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const enableAccount = jest.fn().mockRejectedValue(new Error('offline'));
    render(
      <LocalWalletPoolStatus
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enableAccount,
          state: { enabled: false, paused: true },
          settings: { accountSetup: { requiresBirthday: true } },
        } as unknown as Partial<ILocalWalletPool>)}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('local-wallet-enable-button'));
      await Promise.resolve();
    });

    expect(enableAccount).toHaveBeenCalledWith({});
    expect(screen.getByTestId('local-wallet-enable-button').textContent).toBe(
      'global.resume',
    );
    expect(Dialog.confirm).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[privacyChain] enable failed',
      expect.objectContaining({ error: 'offline' }),
    );
    consoleError.mockRestore();
  });
});

describe('LocalWalletSyncRow balance refresh', () => {
  it('offers Resume for a paused account without changing its last successful time', async () => {
    const enableAccount = jest.fn(async () => undefined);
    const refreshBalanceNow = jest.fn(async () => undefined);
    render(
      <LocalWalletSyncRow
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enabled: true,
          state: { enabled: false, paused: true },
          enableAccount,
          refreshBalanceNow,
          lastSyncedAt: 1_700_000_000_000,
        })}
      />,
    );
    const time = screen.getByTestId('local-wallet-last-synced-at').textContent;
    const button = screen.getByTestId('local-wallet-refresh-balance-btn');
    expect(button.textContent).toBe('global.resume');
    await act(async () => fireEvent.click(button));
    expect(enableAccount).toHaveBeenCalledWith({});
    expect(refreshBalanceNow).not.toHaveBeenCalled();
    expect(screen.getByTestId('local-wallet-last-synced-at').textContent).toBe(
      time,
    );
    expect(screen.queryByTestId('local-wallet-disabled-card')).toBeNull();
  });

  // The light closes on pause, so the token page is where a paused chain resumes.
  it('offers Resume for a paused chain and resumes it', async () => {
    const resumeNetworkSync = jest.fn(async () => undefined);
    const refreshBalanceNow = jest.fn(async () => undefined);
    render(
      <LocalWalletSyncRow
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enabled: true,
          state: { enabled: true, paused: false },
          isNetworkPaused: true,
          resumeNetworkSync,
          refreshBalanceNow,
        })}
      />,
    );
    const button = screen.getByTestId('local-wallet-refresh-balance-btn');
    expect(button.textContent).toBe('global.resume');
    await act(async () => fireEvent.click(button));
    expect(resumeNetworkSync).toHaveBeenCalledTimes(1);
    expect(refreshBalanceNow).not.toHaveBeenCalled();
  });

  it('does not invent a successful update while a refresh is being scheduled', async () => {
    const refreshBalanceNow = jest.fn(async () => undefined);
    render(
      <LocalWalletSyncRow
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enabled: true,
          refreshBalanceNow,
          syncStatusText: 'scanning 30%',
        })}
      />,
    );
    expect(screen.getByTestId('local-wallet-last-synced-at').textContent).toBe(
      '—',
    );
    expect(screen.queryByText('scanning 30%')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId('local-wallet-refresh-balance-btn'));
    });
    expect(refreshBalanceNow).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('local-wallet-last-synced-at').textContent).toBe(
      '—',
    );
  });

  it('shows only the recorded successful time and hides private controls on the public pool', () => {
    const lw = pool({ enabled: true, lastSyncedAt: 1_700_000_000_000 });
    const { rerender } = render(
      <LocalWalletSyncRow networkId="zec--0" accountId="hd-1--0" pool={lw} />,
    );
    expect(
      screen.getByTestId('local-wallet-last-synced-at').textContent,
    ).not.toBe('—');
    rerender(
      <LocalWalletSyncRow
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          ...lw,
          pool: { id: 0, source: 'backend' },
        } as Partial<ILocalWalletPool>)}
      />,
    );
    expect(screen.queryByTestId('local-wallet-sync-row')).toBeNull();
  });

  it('keeps errors that require user action visible alongside the last successful time', () => {
    render(
      <LocalWalletSyncRow
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enabled: true,
          hasSyncError: true,
          syncStatusText: 'storage permission required',
          lastSyncedAt: 1_700_000_000_000,
        })}
      />,
    );
    expect(screen.getByText('storage permission required')).toBeTruthy();
    expect(
      screen.getByTestId('local-wallet-last-synced-at').textContent,
    ).not.toBe('—');
  });
});
