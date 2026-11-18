/** @jest-environment jsdom */
import type { ReactElement, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  LocalWalletPoolStatus,
  LocalWalletSyncRow,
} from './LocalWalletPoolStatus';
import { TokenPrivacyPanel } from './TokenPrivacyPanel';

import type { createPrivacyEnableForm } from './PrivacyEnableContent';
import type { ILocalWalletPool } from './useLocalWalletPool';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
  Easing:
    jest.requireActual<typeof import('react-native')>('react-native').Easing,
}));

const mockAssertAdmission = jest.fn(
  async (_params: unknown): Promise<void> => undefined,
);
const mockTwinBirthday = jest.fn(
  async (_params: unknown): Promise<{ birthdayHeight: number } | undefined> =>
    undefined,
);
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      assertLocalWalletAccountAdmission: (params: unknown) =>
        mockAssertAdmission(params),
      getLocalWalletTwinBirthday: (params: unknown) => mockTwinBirthday(params),
    },
  },
}));
const mockShowSlotsFull = jest.fn((_params: unknown) => undefined);
jest.mock('@onekeyhq/kit/src/utils/privacyChainSlotsFullDialog', () => ({
  showPrivacyChainSlotsFullDialog: (params: unknown) =>
    mockShowSlotsFull(params),
}));

// What the background throws when the network already holds its most accounts.
const slotsFullError = Object.assign(new Error('full'), {
  key: ETranslations.privacy_slots_delete__desc,
  autoToast: false,
});

jest.mock('./LocalWalletPasswordAlert', () => ({
  LocalWalletPasswordAlert: () => null,
}));
jest.mock('./LocalWalletRepairControls', () => ({
  BirthdayDialogForm: () => null,
  PrivacyEnableDisclosure: () => null,
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
    Dialog: { show: jest.fn() },
    Toast: { error: jest.fn() },
    Divider: () => null,
    Icon: () => null,
    Progress: () => null,
    Spinner: () => null,
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

  it.each(['zec--0', 'xmr--0'])(
    'withholds Enable and Resume when %s is disabled by the server',
    (networkId) => {
      render(
        <LocalWalletPoolStatus
          networkId={networkId}
          accountId={accountId}
          pool={pool({
            state: { enabled: false, paused: false, privacyDisabled: true },
          })}
        />,
      );
      expect(screen.getByTestId('local-wallet-disabled-desc').textContent).toBe(
        ETranslations.global_not_available,
      );
      expect(screen.queryByTestId('local-wallet-enable-button')).toBeNull();
      expect(screen.queryByTestId('local-wallet-resume-button')).toBeNull();
    },
  );

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

  it.each(['tokenDetails', 'home'] as const)(
    'also withholds authorization in the %s presentation',
    (presentation) => {
      render(
        <LocalWalletPoolStatus
          networkId="zec--0"
          accountId={accountId}
          pool={pool({ isUnsupportedWallet: true, isTempWallet: true })}
          presentation={presentation}
        />,
      );

      expect(
        screen.getByText(ETranslations.privacy_temp_wallet_unavailable__desc),
      ).toBeTruthy();
      expect(screen.queryByTestId('token-privacy-action')).toBeNull();
    },
  );

  it.each([
    { isUnsupportedWallet: true },
    { isTempWallet: true },
    { state: { enabled: true, paused: false, privacyDisabled: true } },
  ])(
    'withholds Home authorization even if an unavailable account retains enabled intent (%j)',
    (unavailable) => {
      render(
        <LocalWalletPoolStatus
          networkId="xmr--0"
          accountId="hd-1--0"
          presentation="home"
          pool={pool({ enabled: true, ...unavailable })}
        />,
      );
      expect(screen.getByTestId('token-privacy-status').textContent).toBe(
        ETranslations.global_not_available,
      );
      expect(screen.queryByTestId('token-privacy-action')).toBeNull();
    },
  );
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

it('shows no error while registration is pending', () => {
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
      />
      <LocalWalletSyncRow
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pending}
      />
    </>,
  );
  expect(screen.queryByText('privacy_error_setup_incomplete__msg')).toBeNull();
  expect(screen.queryByText('privacy_balance_unavailable__msg')).toBeNull();
  expect(screen.queryByText('DATABASE_ERROR')).toBeNull();
});

type IConfirmArgs = {
  renderContent: ReactElement<{
    formRef: ReturnType<typeof createPrivacyEnableForm>;
  }>;
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
  expect(screen.queryByText('privacy_error_setup_incomplete__msg')).toBeNull();
  expect(screen.queryByText('privacy_balance_unavailable__msg')).toBeNull();
});

describe('LocalWalletPoolStatus enable failure', () => {
  const { Dialog } = jest.requireMock<{
    Dialog: { show: jest.Mock<void, [IConfirmArgs]> };
  }>('@onekeyhq/components');

  beforeEach(() => {
    Dialog.show.mockReset();
    mockAssertAdmission.mockReset().mockResolvedValue(undefined);
    mockTwinBirthday.mockReset().mockResolvedValue(undefined);
    mockShowSlotsFull.mockClear();
    mockBirthday = { birthdayTimestamp: 1_700_000_000_000 };
  });

  it.each([undefined, 'home'] as const)(
    'lists a full network’s accounts to delete before the birthday form (%s)',
    async (presentation) => {
      mockAssertAdmission.mockRejectedValue(slotsFullError);
      const enableAccount = jest.fn(async () => undefined);
      render(
        <LocalWalletPoolStatus
          networkId="zec--0"
          accountId="hd-1--0"
          presentation={presentation}
          pool={pool({
            enableAccount,
            settings: { accountSetup: { requiresBirthday: true } },
          } as unknown as Partial<ILocalWalletPool>)}
        />,
      );
      await act(async () => {
        fireEvent.click(
          screen.getByTestId(
            presentation === 'home'
              ? 'token-privacy-action'
              : 'local-wallet-enable-button',
          ),
        );
      });

      expect(Dialog.show).not.toHaveBeenCalled();
      expect(enableAccount).not.toHaveBeenCalled();
      expect(mockShowSlotsFull).toHaveBeenCalledWith(
        expect.objectContaining({ networkId: 'zec--0' }),
      );
    },
  );

  it('explains a network that filled up while the form was open', async () => {
    const enableAccount = jest.fn().mockRejectedValue(slotsFullError);
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
    await act(async () => {
      fireEvent.click(screen.getByTestId('local-wallet-enable-button'));
    });
    // The limit closes this dialog and opens its own.
    await act(async () => {
      await lastDialog().onConfirm({ preventClose: jest.fn() });
    });

    expect(mockShowSlotsFull).toHaveBeenCalledTimes(1);
  });

  function lastDialog(): IConfirmArgs {
    const call = Dialog.show.mock.calls.at(-1);
    expect(call).toBeDefined();
    return (call as [IConfirmArgs])[0];
  }

  it.each([
    { presentation: undefined, birthday: undefined },
    { presentation: undefined, birthday: { birthdayHeight: 2_500_000 } },
    { presentation: 'tokenDetails' as const, birthday: undefined },
    {
      presentation: 'tokenDetails' as const,
      birthday: { birthdayHeight: 2_500_000 },
    },
    { presentation: 'home' as const, birthday: undefined },
    {
      presentation: 'home' as const,
      birthday: { birthdayHeight: 2_500_000 },
    },
  ])(
    'only enables after valid birthday input ($presentation)',
    async ({ presentation, birthday }) => {
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
          presentation={presentation}
        />,
      );
      await act(async () => {
        fireEvent.click(
          screen.getByTestId(
            presentation === 'tokenDetails' || presentation === 'home'
              ? 'token-privacy-action'
              : 'local-wallet-enable-button',
          ),
        );
      });
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

  it('turns a twin of a scanning account on at its start without asking', async () => {
    mockTwinBirthday.mockResolvedValue({ birthdayHeight: 3_400_000 });
    const enableAccount = jest.fn(async () => undefined);
    render(
      <LocalWalletPoolStatus
        networkId="xmr--0"
        accountId="hw-1--0"
        pool={pool({
          enableAccount,
          settings: { accountSetup: { requiresBirthday: true } },
        } as unknown as Partial<ILocalWalletPool>)}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('local-wallet-enable-button'));
    });

    expect(mockTwinBirthday).toHaveBeenCalledWith({
      networkId: 'xmr--0',
      accountId: 'hw-1--0',
    });
    expect(enableAccount).toHaveBeenCalledWith({ birthdayHeight: 3_400_000 });
    expect(Dialog.show).not.toHaveBeenCalled();
  });

  it('prefills a twin birthday on Home but waits for explicit confirmation', async () => {
    mockTwinBirthday.mockResolvedValue({ birthdayHeight: 3_400_000 });
    mockBirthday = { birthdayHeight: 3_400_000 };
    const enableAccount = jest.fn(async () => undefined);
    const page = render(
      <LocalWalletPoolStatus
        networkId="xmr--0"
        accountId="hd-1--0"
        presentation="home"
        pool={pool({
          enableAccount,
          settings: { accountSetup: { requiresBirthday: true } },
        } as unknown as Partial<ILocalWalletPool>)}
      />,
    );
    expect(enableAccount).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByTestId('token-privacy-action'));
    });
    expect(enableAccount).not.toHaveBeenCalled();
    expect(lastDialog().renderContent.props.formRef.current).toMatchObject({
      mode: 'height',
      height: '3400000',
      startChoice: 'height',
    });
    await act(async () => {
      await lastDialog().onConfirm({ preventClose: jest.fn() });
    });
    expect(enableAccount).toHaveBeenCalledTimes(1);
    expect(enableAccount).toHaveBeenCalledWith({ birthdayHeight: 3_400_000 });
    page.unmount();
  });

  it('does not open the previous account enable dialog after an account switch', async () => {
    let resolveAdmission: (() => void) | undefined;
    mockAssertAdmission.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAdmission = resolve;
        }),
    );
    const enableAccount = jest.fn(async () => undefined);
    const homePool = pool({
      enableAccount,
      settings: { accountSetup: { requiresBirthday: true } },
    } as unknown as Partial<ILocalWalletPool>);
    const page = render(
      <LocalWalletPoolStatus
        networkId="xmr--0"
        accountId="hd-1--0"
        presentation="home"
        pool={homePool}
      />,
    );
    fireEvent.click(screen.getByTestId('token-privacy-action'));
    page.rerender(
      <LocalWalletPoolStatus
        networkId="xmr--0"
        accountId="hd-1--1"
        presentation="home"
        pool={homePool}
      />,
    );
    await act(async () => {
      resolveAdmission?.();
    });
    expect(mockTwinBirthday).not.toHaveBeenCalled();
    expect(Dialog.show).not.toHaveBeenCalled();
    expect(enableAccount).not.toHaveBeenCalled();
  });

  it('closes the Home confirmation on unmount and rejects a stale confirmation', async () => {
    const close = jest.fn();
    Dialog.show.mockImplementation(() => ({
      close,
      isExist: () => true,
      getForm: () => undefined,
    }));
    const enableAccount = jest.fn(async () => undefined);
    const page = render(
      <LocalWalletPoolStatus
        networkId="xmr--0"
        accountId="hd-1--0"
        presentation="home"
        pool={pool({
          enableAccount,
          settings: { accountSetup: { requiresBirthday: true } },
        } as unknown as Partial<ILocalWalletPool>)}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('token-privacy-action'));
    });
    const dialog = lastDialog();
    page.unmount();
    expect(close).toHaveBeenCalledTimes(1);
    await dialog.onConfirm({ preventClose: jest.fn() });
    expect(enableAccount).not.toHaveBeenCalled();
  });

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

    await act(async () => {
      fireEvent.click(screen.getByTestId('local-wallet-enable-button'));
    });
    expect(Dialog.show).toHaveBeenCalledTimes(1);

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

    await act(async () => {
      fireEvent.click(button);
    });
    await lastDialog()
      .onConfirm({ preventClose: jest.fn() })
      .catch(() => undefined);
    await act(async () => {
      fireEvent.click(button);
    });

    expect(Dialog.show).toHaveBeenCalledTimes(2);
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
    expect(Dialog.show).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[privacyChain] enable failed',
      expect.objectContaining({ error: 'offline' }),
    );
    consoleError.mockRestore();
  });

  it.each(['accountPaused', 'chainPaused'] as const)(
    'renders the Home Enable trigger for %s and resumes without birthday setup',
    async (syncStatus) => {
      const enableAccount = jest.fn(async () => undefined);
      const startSync = jest.fn(async () => undefined);
      render(
        <LocalWalletPoolStatus
          networkId="xmr--0"
          accountId="hd-1--0"
          presentation="home"
          pool={pool({
            enabled: true,
            isSyncPaused: true,
            syncStatus,
            state: {
              enabled: syncStatus === 'chainPaused',
              paused: syncStatus === 'accountPaused',
            },
            enableAccount,
            startSync,
            settings: { accountSetup: { requiresBirthday: true } },
          } as unknown as Partial<ILocalWalletPool>)}
          renderEnableTrigger={({ onPress, disabled }) => (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void onPress()}
            >
              Enable
            </button>
          )}
        />,
      );
      await act(async () => fireEvent.click(screen.getByText('Enable')));
      expect(enableAccount).toHaveBeenCalledTimes(
        syncStatus === 'accountPaused' ? 1 : 0,
      );
      if (syncStatus === 'accountPaused') {
        expect(enableAccount).toHaveBeenCalledWith({});
      }
      expect(startSync).toHaveBeenCalledTimes(
        syncStatus === 'chainPaused' ? 1 : 0,
      );
      expect(mockAssertAdmission).not.toHaveBeenCalled();
      expect(mockTwinBirthday).not.toHaveBeenCalled();
      expect(Dialog.show).not.toHaveBeenCalled();
    },
  );
});

describe('TokenPrivacyPanel pause action', () => {
  it.each(['syncing', 'preparing'] as const)(
    'shows a working Pause button for %s',
    (state) => {
      const onStop = jest.fn();
      render(<TokenPrivacyPanel state={state} onStop={onStop} />);
      fireEvent.click(screen.getByText(ETranslations.global_pause));
      expect(onStop).toHaveBeenCalledTimes(1);
    },
  );

  it('does not substitute Refresh for Pause during incomplete setup', () => {
    render(<TokenPrivacyPanel state="preparing" onSync={jest.fn()} />);
    expect(screen.queryByTestId('token-privacy-action')).toBeNull();
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
          syncStatus: 'accountPaused',
          isSyncPaused: true,
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
    expect(screen.queryByTestId('local-wallet-open-settings-btn')).toBeNull();
  });

  it('offers Resume for a paused chain and resumes it', async () => {
    const startSync = jest.fn(async () => undefined);
    const refreshBalanceNow = jest.fn(async () => undefined);
    render(
      <LocalWalletSyncRow
        networkId="zec--0"
        accountId="hd-1--0"
        pool={pool({
          enabled: true,
          state: { enabled: true, paused: false },
          syncStatus: 'chainPaused',
          isSyncPaused: true,
          isNetworkPaused: true,
          startSync,
          refreshBalanceNow,
        })}
      />,
    );
    const button = screen.getByTestId('local-wallet-refresh-balance-btn');
    expect(button.textContent).toBe('global.resume');
    await act(async () => fireEvent.click(button));
    expect(startSync).toHaveBeenCalledTimes(1);
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
