/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

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
  readEnableBirthday: () => undefined,
}));

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Button: Wrapper,
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
