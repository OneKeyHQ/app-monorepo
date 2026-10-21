/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { LocalWalletPoolStatus } from './LocalWalletPoolStatus';

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

jest.mock('./LocalWalletFrozenLines', () => ({
  LocalWalletFrozenLines: () => null,
}));
jest.mock('./LocalWalletPasswordAlert', () => ({
  LocalWalletPasswordAlert: () => null,
}));
jest.mock('./LocalWalletRepairControls', () => ({
  BirthdayDialogForm: () => null,
  LocalWalletDebugControl: () => null,
  PrivacyEnableDisclosure: () => null,
  ScanRepairControl: () => null,
  SetupRepairControl: () => null,
  createEnableBirthdayForm: () => ({ current: {} }),
  // `var` below: jest hoists this factory above it.
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  readEnableBirthday: () => mockBirthday,
}));
// eslint-disable-next-line no-var, vars-on-top
var mockBirthday: { birthdayTimestamp?: number } | undefined;

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
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    loading?: boolean;
    onPress?: () => unknown;
  }) => (
    <button
      type="button"
      data-testid={testID}
      data-loading={String(Boolean(loading))}
      onClick={() => {
        void onPress?.();
      }}
    >
      {children}
    </button>
  );
  return {
    Button,
    Dialog: { confirm: jest.fn() },
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

    expect(
      screen.getByTestId('local-wallet-disabled-desc').textContent,
    ).toContain('hidden wallets');
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

describe('LocalWalletPoolStatus for an identity mismatch', () => {
  it('names the way out and offers Delete instead of Retry', () => {
    render(
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

    expect(
      screen.getByTestId('local-wallet-identity-mismatch').textContent,
    ).toContain('delete its privacy data');
    expect(screen.getByTestId('local-wallet-identity-delete-btn')).toBeTruthy();
  });

  it('keeps Retry for an ordinary unfinished setup', () => {
    render(
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

    expect(screen.queryByTestId('local-wallet-identity-mismatch')).toBeNull();
    expect(screen.queryByTestId('local-wallet-identity-delete-btn')).toBeNull();
  });
});

type IConfirmArgs = {
  onConfirm: (params: { preventClose: () => void }) => Promise<void>;
};

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

  // QA: the Worker crashed at load, enable timed out its handshake, and the
  // dialog showed nothing. The rejection is what carries the toast (the
  // background marks it autoToast); the dialog must not swallow it.
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

  it('handles a failed resume without an unhandled rejection', async () => {
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
        } as unknown as Partial<ILocalWalletPool>)}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('local-wallet-resume-button'));
      await Promise.resolve();
    });

    expect(enableAccount).toHaveBeenCalledWith({});
    expect(consoleError).toHaveBeenCalledWith(
      '[privacyChain] resume failed',
      expect.objectContaining({ error: 'offline' }),
    );
    consoleError.mockRestore();
  });
});
