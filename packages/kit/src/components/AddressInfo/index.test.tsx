/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { SwitchHomeAccountButton } from '.';

import { act, render } from '@testing-library/react';

const mockConfirmAccountSelect = jest.fn(async (_params: unknown) => false);
const mockToastError = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  popStack: jest.fn(),
};
let capturedPress: (() => void | Promise<void>) | undefined;
let capturedConfirm: (() => void | Promise<void>) | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => '' }),
}));

jest.mock('@onekeyhq/components', () => ({
  Badge: ({ children }: { children?: ReactNode }) => children ?? null,
  Dialog: {
    show: ({ onConfirm }: { onConfirm?: () => void | Promise<void> }) => {
      capturedConfirm = onConfirm;
    },
  },
  Stack: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void | Promise<void>;
  }) => {
    capturedPress = onPress;
    return children ?? null;
  },
  Toast: {
    error: (params: unknown) => {
      mockToastError(params);
    },
  },
  XStack: ({ children }: { children?: ReactNode }) => children ?? null,
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getDBAccountSafe: async () => ({ id: 'account-1' }),
      getIndexedAccountByAccount: async () => ({ id: 'hd-1--0' }),
      getIndexedAccountSafe: async () => undefined,
    },
  },
}));

jest.mock('../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));

jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
}));

jest.mock('../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: {
      confirmAccountSelect: (params: unknown) =>
        mockConfirmAccountSelect(params),
    },
  }),
}));

jest.mock('../AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children ?? null,
}));

jest.mock('../AddressBadge', () => ({ AddressBadge: () => null }));

describe('SwitchHomeAccountButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    capturedPress = undefined;
    capturedConfirm = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('silently aborts when a superseded account selection returns false', async () => {
    render(
      <SwitchHomeAccountButton
        accountId="account-1"
        walletAccountName="Account 1"
      >
        account
      </SwitchHomeAccountButton>,
    );

    await act(async () => {
      await capturedPress?.();
      await capturedConfirm?.();
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockConfirmAccountSelect).toHaveBeenCalledTimes(1);
    expect(mockConfirmAccountSelect).toHaveBeenCalledWith(
      expect.objectContaining({ throwOnError: true }),
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('shows an error when account selection throws', async () => {
    mockConfirmAccountSelect.mockRejectedValueOnce(
      new Error('wallet unavailable'),
    );
    render(
      <SwitchHomeAccountButton
        accountId="account-1"
        walletAccountName="Account 1"
      >
        account
      </SwitchHomeAccountButton>,
    );

    await act(async () => {
      await capturedPress?.();
      await capturedConfirm?.();
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
  });
});
