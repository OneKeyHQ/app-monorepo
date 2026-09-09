/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountActivityNotificationSettings } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityNotificationSettings';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ManageAccountActivityPage from './ManageAccountActivity';

let mockWallets: IDBWallet[] = [];
let mockWalletsLoading = false;
let mockRefreshWallets: (() => void) | undefined;
let mockSettings: IAccountActivityNotificationSettings = {};
const mockSaveSettings = jest.fn<
  Promise<void>,
  [IAccountActivityNotificationSettings | undefined]
>();
const mockConfirm = jest.fn<void, unknown[]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  const Page = Object.assign(Stack, { Header: () => null, Body: Stack });
  const Accordion = Object.assign(
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    {
      Item: Stack,
      Trigger: ({
        children,
      }: {
        children: (state: { open: boolean }) => React.ReactNode;
      }) =>
        React.createElement(
          'div',
          { 'data-testid': 'wallet-switch-row' },
          children({ open: true }),
        ),
      Content: Stack,
      HeightAnimator: Stack,
    },
  );
  return {
    Accordion,
    Alert: () => null,
    Dialog: { confirm: (...args: unknown[]) => mockConfirm(...args) },
    Icon: () => null,
    Page,
    SizableText: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    Skeleton: Object.assign(Stack, { Group: Stack, BodyLg: () => null }),
    Switch: ({
      value,
      onChange,
    }: {
      value: boolean;
      onChange: (value: boolean) => void;
    }) =>
      React.createElement('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': value,
        onClick: () => onChange(!value),
      }),
    XStack: Stack,
    YStack: Stack,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      saveAccountActivityNotificationSettings: (
        settings: IAccountActivityNotificationSettings | undefined,
      ) => mockSaveSettings(settings),
      registerClientWithOverrideAllAccounts: jest.fn(),
    },
    simpleDb: {
      notificationSettings: {
        getRawData: async () => ({ accountActivity: mockSettings }),
        updateBackupPrimeAccountActivityNotificationSettings: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [, refresh] = React.useReducer((value: number) => value + 1, 0);
    mockRefreshWallets = refresh;
    return { result: mockWallets, isLoading: mockWalletsLoading };
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/notifications', () => ({
  useNotificationsAtom: () => [{ maxAccountCount: 20 }],
}));

jest.mock('@onekeyhq/shared/src/utils/notificationsUtils', () => ({
  NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_ENABLED: false,
  NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT: 20,
}));

jest.mock('@onekeyhq/kit/src/components/AccountAvatar', () => ({
  AccountAvatar: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/WalletAvatar', () => ({
  WalletAvatar: () => null,
}));

jest.mock(
  '../../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/EmptyView',
  () => ({ EmptyNoWalletView: () => null }),
);

jest.mock('../Tab/settingsSurface', () => ({
  SETTINGS_PAGE_BODY_INSET_X: 0,
}));

function buildWallet(id: string, accountIds: string[]): IDBWallet {
  return {
    id,
    name: id,
    type: 'hd',
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
    dbIndexedAccounts: accountIds.map((accountId, index) => ({
      id: accountId,
      name: accountId,
      walletId: id,
      index,
      idHash: accountId,
    })),
  };
}

function buildSettings(
  enabledIds: string[],
  disabledIds: string[] = [],
): IAccountActivityNotificationSettings[string] {
  const accounts: IAccountActivityNotificationSettings[string]['accounts'] = {};
  for (const id of enabledIds) {
    accounts[id] = { enabled: true };
  }
  for (const id of disabledIds) {
    accounts[id] = { enabled: false };
  }
  return { enabled: true, accounts };
}

function getLastSavedSettings() {
  const calls = mockSaveSettings.mock.calls;
  const settings = calls[calls.length - 1]?.[0];
  if (!settings) {
    throw new OneKeyLocalError('Expected notification settings to be saved');
  }
  return settings;
}

function getRowSwitch(element: HTMLElement, isWallet = false) {
  const row = isWallet
    ? element.closest('[data-testid="wallet-switch-row"]')
    : element.parentElement;
  if (!(row instanceof HTMLElement)) {
    throw new OneKeyLocalError('Expected a notification account or wallet row');
  }
  return within(row).getByRole('switch');
}

describe('ManageAccountActivity stale account settings', () => {
  beforeEach(() => {
    mockWallets = [];
    mockWalletsLoading = false;
    mockRefreshWallets = undefined;
    mockSettings = {};
    mockSaveSettings.mockReset();
    mockSaveSettings.mockResolvedValue(undefined);
    mockConfirm.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps saved preferences while the wallet list is still loading', async () => {
    mockWalletsLoading = true;
    mockSettings = { wallet: buildSettings(['kept'], ['disabled']) };
    const screen = render(<ManageAccountActivityPage />);
    await act(async () => undefined);
    expect(mockSaveSettings).not.toHaveBeenCalled();

    act(() => {
      mockWallets = [buildWallet('wallet', ['kept', 'disabled'])];
      mockWalletsLoading = false;
      mockRefreshWallets?.();
    });

    await waitFor(() => expect(screen.getByText('(1/2)')).toBeTruthy());
    expect(
      getRowSwitch(screen.getByText('kept')).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      getRowSwitch(screen.getByText('disabled')).getAttribute('aria-checked'),
    ).toBe('false');
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('keeps all 20 live accounts enabled after replacing two removed accounts and reopening the wallet', async () => {
    const originalIds = Array.from(
      { length: 20 },
      (_, i) => `account-${i + 1}`,
    );
    const liveIds = [...originalIds.slice(2), 'new-first', 'new-second'];
    mockWallets = [buildWallet('wallet', liveIds)];
    mockSettings = {
      wallet: buildSettings(originalIds, ['new-first', 'new-second']),
    };
    const { getByText } = render(<ManageAccountActivityPage />);
    await waitFor(() => expect(getByText('(18/20)')).toBeTruthy());

    fireEvent.click(getRowSwitch(getByText('new-first')));
    await waitFor(() => expect(getByText('(19/20)')).toBeTruthy());
    expect(getLastSavedSettings().wallet.accounts).not.toHaveProperty(
      'account-1',
    );
    expect(getLastSavedSettings().wallet.accounts).not.toHaveProperty(
      'account-2',
    );

    fireEvent.click(getRowSwitch(getByText('new-second')));
    await waitFor(() => expect(getByText('(20/20)')).toBeTruthy());
    fireEvent.click(getRowSwitch(getByText('wallet'), true));
    await waitFor(() => expect(getByText('(0/20)')).toBeTruthy());
    fireEvent.click(getRowSwitch(getByText('wallet'), true));
    await waitFor(() => expect(getByText('(20/20)')).toBeTruthy());

    expect(getLastSavedSettings()).toEqual({ wallet: buildSettings(liveIds) });
    for (const id of liveIds) {
      expect(getRowSwitch(getByText(id)).getAttribute('aria-checked')).toBe(
        'true',
      );
    }
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('preserves disabled choices and other wallet quota while pruning hidden and removed accounts', async () => {
    const otherIds = Array.from({ length: 17 }, (_, i) => `other-${i + 1}`);
    const wallet = buildWallet('wallet', ['kept', 'disabled', 'last']);
    wallet.hiddenWallets = [buildWallet('hidden-wallet', ['hidden-kept'])];
    mockWallets = [wallet, buildWallet('other-wallet', otherIds)];
    mockSettings = {
      wallet: {
        ...buildSettings(['kept', 'removed', 'last'], ['disabled']),
        enabled: false,
      },
      'hidden-wallet': buildSettings(['hidden-kept', 'hidden-removed']),
      'other-wallet': buildSettings(otherIds),
      'removed-wallet': buildSettings(['removed-account']),
    };
    const { getByText } = render(<ManageAccountActivityPage />);
    await waitFor(() => expect(getByText('(0/3)')).toBeTruthy());
    fireEvent.click(getRowSwitch(getByText('wallet'), true));
    await waitFor(() => expect(getByText('(2/3)')).toBeTruthy());

    expect(getLastSavedSettings()).toEqual({
      wallet: buildSettings(['kept', 'last'], ['disabled']),
      'hidden-wallet': buildSettings(['hidden-kept']),
      'other-wallet': buildSettings(otherIds),
    });
    expect(getRowSwitch(getByText('last')).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      getRowSwitch(getByText('disabled')).getAttribute('aria-checked'),
    ).toBe('false');
  });
});
