/** @jest-environment jsdom */
import type { ReactElement, ReactNode } from 'react';

import PrivacyNetworkSettings from '.';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IBirthdayFormState } from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
import type { ILocalWalletAccountListItem } from '@onekeyhq/kit-bg/src/services/ServicePrivacyChain';
import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletAccountState,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// eslint-disable-next-line no-var, vars-on-top
var mockAccounts: ILocalWalletAccountListItem[] = [];
// eslint-disable-next-line no-var, vars-on-top
var mockAccountStates: Record<string, ILocalWalletAccountState> = {};
// eslint-disable-next-line no-var, vars-on-top
var mockUnsupportedNetworks: string[] = [];
// eslint-disable-next-line no-var, vars-on-top
var mockProgress: IPrivacyChainScanState['progress'] = {};
// eslint-disable-next-line no-var, vars-on-top
var mockPausedNetworks: string[] = [];
// eslint-disable-next-line no-var, vars-on-top
var mockBoostingNetworks: string[] = [];
const mockDelete = jest.fn<
  Promise<void>,
  [{ accountId: string; networkId: string }]
>();
const mockEnable = jest.fn<
  Promise<void>,
  [{ accountId: string; networkId: string }]
>();
const mockDisable = jest.fn<
  Promise<void>,
  [{ accountId: string; networkId: string }]
>();
const mockRepair = jest.fn(async (_params: unknown) => undefined);
const mockAdmission = jest.fn(async (_params: unknown) => undefined);
const mockShowSlotsFull = jest.fn((_params: unknown) => undefined);
jest.mock('@onekeyhq/kit/src/utils/privacyChainSlotsFullDialog', () => ({
  showPrivacyChainSlotsFullDialog: (params: unknown) =>
    mockShowSlotsFull(params),
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: jest.requireActual<
    typeof import('@onekeyhq/shared/src/eventBus/appEventBusNames')
  >('@onekeyhq/shared/src/eventBus/appEventBusNames').EAppEventBusNames,
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: { walletId: undefined } }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useCallback, useEffect, useState } =
    jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (fn: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = useState<unknown>();
      const run = useCallback(async () => {
        setResult(await fn());
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      useEffect(() => {
        void run();
      }, [run]);
      return { result, run };
    },
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
  usePrivacyChainAtom: () => [
    {
      dataBlockedNetworkIds: [],
      pausedNetworkIds: mockPausedNetworks,
      preparingNetworkIds: [],
      boostingNetworkIds: mockBoostingNetworks,
      storageUnsupportedNetworkIds: mockUnsupportedNetworks,
      syncErrorByNetworkId: {},
      progress: mockProgress,
    },
  ],
}));

jest.mock('@onekeyhq/kit/src/components/LazyLoadPage', () => ({
  LazyLoadPage: () => () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls',
  () => ({
    BirthdayDialogForm: () => null,
    PrivacyEnableDisclosure: () => null,
    createEnableBirthdayForm: () => ({ current: {} }),
    getBirthdayInputError: () => 'global.bulk_accounts_page_number_error',
    readEnableBirthday: jest.fn(() => ({ birthdayHeight: 100 })),
  }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getNetworkSafe: async () => undefined,
      getVaultSettings: async () => ({ localWallet: undefined }),
    },
    servicePrivacyChain: {
      listLocalWalletAccounts: async () => mockAccounts,
      getLocalWalletAccountState: async ({
        accountId,
      }: {
        accountId: string;
      }): Promise<ILocalWalletAccountState> =>
        mockAccountStates[accountId] ?? { enabled: false, paused: false },
      enableLocalWalletAccount: (params: {
        accountId: string;
        networkId: string;
      }) => mockEnable(params),
      assertLocalWalletAccountAdmission: (params: unknown) =>
        mockAdmission(params),
      disableLocalWalletAccount: (params: {
        accountId: string;
        networkId: string;
      }) => mockDisable(params),
      deleteLocalWalletAccountData: (params: {
        accountId: string;
        networkId: string;
      }) => mockDelete(params),
      repairLocalChainData: (params: unknown) => mockRepair(params),
      getLocalWalletSyncProgress: async () => undefined,
      getLocalWalletNetworkInfo: async () => undefined,
      getAllowPrivacySyncOnCellular: async () => false,
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItem = ({
    title,
    subtitle,
    testID,
    children,
    onPress,
    disabled,
  }: {
    onPress?: () => void;
    disabled?: boolean;
    title?: string;
    subtitle?: string;
    testID?: string;
    children?: ReactNode;
  }) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        onClick={onPress}
        disabled={disabled}
      >
        <span>{title}</span>
        <span>{subtitle}</span>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>
        <span>{title}</span>
        <span>{subtitle}</span>
        {children}
      </div>
    );
  return { ListItem };
});

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    Button: ({
      children,
      testID,
      onPress,
      disabled,
    }: {
      children?: ReactNode;
      testID?: string;
      onPress?: () => void;
      disabled?: boolean;
    }) => (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    Dialog: { confirm: jest.fn(), show: jest.fn() },
    Divider: () => null,
    ESwitchSize: { small: 'small' },
    Page: Object.assign(Wrapper, { Header: () => null, Body: Wrapper }),
    Progress: () => null,
    ScrollView: Wrapper,
    SizableText: Wrapper,
    Spinner: () => null,
    Stack: Wrapper,
    Switch: ({ testID }: { testID?: string }) => (
      <input type="checkbox" data-testid={testID} />
    ),
    Toast: { error: jest.fn() },
    XStack: Wrapper,
    YStack: Wrapper,
  };
});

function listItem(
  overrides: Partial<ILocalWalletAccountListItem>,
): ILocalWalletAccountListItem {
  return {
    accountId: 'hd-1--0',
    accountName: 'Account #1',
    walletId: 'hd-1',
    walletName: 'Wallet 1',
    networkId: 'zec--0',
    walletIsTemp: false,
    ...overrides,
  };
}

// Title and subtitle of the status row, joined the way the old one-line status read.
function progressText(row: HTMLElement) {
  return Array.from(row.querySelectorAll('span'))
    .map((span) => span.textContent)
    .filter(Boolean)
    .join(' · ');
}

describe('Privacy network settings for a temp wallet', () => {
  beforeEach(() => {
    mockAccountStates = {};
    mockUnsupportedNetworks = [];
    mockProgress = {};
    mockPausedNetworks = [];
    mockBoostingNetworks = [];
    mockEnable.mockReset().mockResolvedValue(undefined);
    mockAdmission.mockReset().mockResolvedValue(undefined);
    mockShowSlotsFull.mockClear();
    mockDisable.mockReset().mockResolvedValue(undefined);
    mockDelete.mockReset().mockResolvedValue(undefined);
    mockRepair.mockClear();
    mockAccounts = [
      listItem({}),
      listItem({
        accountId: 'hw-1-passphrase--0',
        walletId: 'hw-1-passphrase',
        walletName: 'Hidden',
        networkId: 'xmr--0',
        walletIsTemp: true,
      }),
    ];
  });

  it('offers no switch and says why', async () => {
    render(<PrivacyNetworkSettings />);

    await waitFor(() =>
      expect(
        screen.getByTestId('privacy-network-temp-wallet-hw-1-passphrase--0'),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByTestId('privacy-network-switch-hw-1-passphrase--0'),
    ).toBeNull();
    expect(
      screen.getByTestId('privacy-network-temp-wallet-hw-1-passphrase--0')
        .textContent,
    ).toBe(ETranslations.privacy_temp_wallet_unavailable__desc);
    expect(screen.getByText(/global\.not_available/)).toBeTruthy();
    expect(
      screen.getByTestId('privacy-network-delete-hw-1-passphrase--0'),
    ).toBeTruthy();
  });

  it('offers an explicit Enable action to a saved wallet', async () => {
    mockAccounts[0].deriveLabel = 'Cake Wallet';
    render(<PrivacyNetworkSettings />);

    await waitFor(() =>
      expect(screen.getByTestId('privacy-network-enable-hd-1--0')).toBeTruthy(),
    );
    expect(
      screen.queryByTestId('privacy-network-temp-wallet-hd-1--0'),
    ).toBeNull();
    expect(screen.queryByTestId('privacy-network-pause-hd-1--0')).toBeNull();
    expect(screen.queryByTestId('privacy-sync-progress')).toBeNull();
    // Two chains listed: no derive headers, the label rides in the subtitle.
    expect(
      screen.queryByTestId('privacy-network-derive-group-Cake Wallet'),
    ).toBeNull();
    expect(
      screen.getByTestId('account-manager-privacy-network-account-hd-1--0')
        .textContent,
    ).toContain('Wallet 1 · Cake Wallet · global.disabled');
  });

  it('groups one chain by derive type under its label', async () => {
    mockAccounts = [
      listItem({ networkId: 'xmr--0', deriveLabel: 'OneKey' }),
      listItem({
        accountId: 'hd-1--cake',
        networkId: 'xmr--0',
        deriveLabel: 'Cake Wallet',
      }),
    ];
    render(<PrivacyNetworkSettings networkId="xmr--0" />);

    const cake = await screen.findByTestId(
      'privacy-network-derive-group-Cake Wallet',
    );
    expect(cake.textContent).toContain('Cake Wallet');
    expect(
      screen.getByTestId('privacy-network-derive-group-OneKey').textContent,
    ).toContain('OneKey');
    expect(
      screen.getByTestId('account-manager-privacy-network-account-hd-1--cake')
        .textContent,
    ).toContain('Wallet 1 · global.disabled');
  });

  it('pauses only the selected account and resumes without changing its birthday', async () => {
    mockAccounts = [listItem({}), listItem({ accountId: 'hd-1--1' })];
    mockAccountStates = {
      'hd-1--0': { enabled: true, paused: false, birthdayHeight: 2_500_000 },
      'hd-1--1': { enabled: true, paused: false },
    };
    mockDisable.mockImplementation(async ({ accountId }) => {
      mockAccountStates[accountId] = {
        ...mockAccountStates[accountId],
        enabled: false,
        paused: true,
      };
    });
    mockEnable.mockImplementation(async ({ accountId }) => {
      mockAccountStates[accountId] = {
        ...mockAccountStates[accountId],
        enabled: true,
        paused: false,
      };
    });
    render(<PrivacyNetworkSettings networkId="zec--0" />);
    fireEvent.click(await screen.findByTestId('privacy-network-pause-hd-1--0'));
    const resume = await screen.findByTestId('privacy-network-resume-hd-1--0');
    expect(mockDisable).toHaveBeenCalledTimes(1);
    expect(mockDisable).toHaveBeenCalledWith({
      accountId: 'hd-1--0',
      networkId: 'zec--0',
    });
    expect(screen.getByTestId('privacy-network-pause-hd-1--1')).toBeTruthy();
    expect(screen.queryByTestId('privacy-network-enable-hd-1--0')).toBeNull();
    expect(
      (
        screen.getByTestId(
          'privacy-network-birthday-hd-1--0',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(resume);
    await screen.findByTestId('privacy-network-pause-hd-1--0');
    expect(mockEnable).toHaveBeenCalledWith({
      accountId: 'hd-1--0',
      networkId: 'zec--0',
    });
    expect(mockAccountStates['hd-1--0'].birthdayHeight).toBe(2_500_000);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockRepair).not.toHaveBeenCalled();
  });

  it('does not show a pause as successful before it is saved, or when it fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    let rejectPause: (reason: Error) => void = () => {};
    mockDisable.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectPause = reject;
        }),
    );
    mockAccountStates['hd-1--0'] = { enabled: true, paused: false };
    render(<PrivacyNetworkSettings networkId="zec--0" />);
    fireEvent.click(await screen.findByTestId('privacy-network-pause-hd-1--0'));
    expect(screen.queryByTestId('privacy-network-resume-hd-1--0')).toBeNull();
    expect(
      (
        screen.getByTestId(
          'privacy-network-delete-hd-1--0',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () => rejectPause(new Error('storage unavailable')));
    expect(screen.getByTestId('privacy-network-pause-hd-1--0')).toBeTruthy();
    expect(screen.queryByTestId('privacy-network-resume-hd-1--0')).toBeNull();
    expect(
      (
        screen.getByTestId(
          'privacy-network-delete-hd-1--0',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    consoleError.mockRestore();
  });

  it('shows the slowest active account using the same figures as the float', async () => {
    const complete: ILocalWalletSyncProgress = {
      birthdayHeight: 1,
      backfillScannedHeight: 100,
      backfillTargetHeight: 100,
      backfillProgress: 1,
      isBackfillComplete: true,
      tipScannedHeight: 100,
      chainTip: 100,
      tipLag: 0,
      isTipCaughtUp: true,
      isSyncing: false,
    };
    mockAccounts = [listItem({}), listItem({ accountId: 'hd-1--1' })];
    mockAccountStates = {
      'hd-1--0': { enabled: true, paused: false },
      'hd-1--1': { enabled: true, paused: false },
    };
    mockProgress = {
      'zec--0:hd-1--0': complete,
      'zec--0:hd-1--1': {
        ...complete,
        backfillScannedHeight: 43,
        backfillProgress: 0.4399,
        isBackfillComplete: false,
      },
    };
    const { rerender } = render(<PrivacyNetworkSettings networkId="zec--0" />);
    expect(
      progressText(await screen.findByTestId('privacy-sync-progress')),
    ).toBe('global.syncing · 43 / 100 · 43.9%');
    mockProgress['zec--0:waiting'] = {
      ...complete,
      backfillScannedHeight: null,
      isBackfillComplete: false,
      backfillProgress: 0,
    };
    rerender(<PrivacyNetworkSettings networkId="zec--0" />);
    expect(progressText(screen.getByTestId('privacy-sync-progress'))).toBe(
      'global.syncing · 43 / 100 · 43.9%',
    );
    mockPausedNetworks = ['zec--0'];
    rerender(<PrivacyNetworkSettings networkId="zec--0" />);
    expect(progressText(screen.getByTestId('privacy-sync-progress'))).toContain(
      'syncing_paused__title',
    );
    expect(mockDisable).not.toHaveBeenCalled();
    mockPausedNetworks = [];
    delete mockProgress['zec--0:hd-1--1'];
    delete mockProgress['zec--0:waiting'];
    mockBoostingNetworks = ['zec--0'];
    rerender(<PrivacyNetworkSettings networkId="zec--0" />);
    expect(progressText(screen.getByTestId('privacy-sync-progress'))).toBe(
      'global.syncing',
    );
    // Caught up: scanned and chain heights, never a bare "synced".
    mockBoostingNetworks = [];
    rerender(<PrivacyNetworkSettings networkId="zec--0" />);
    expect(progressText(screen.getByTestId('privacy-sync-progress'))).toBe(
      'global.synced · 100 / 100',
    );
  });

  it.each(['date', 'height'] as const)(
    'passes %s through the existing repair API',
    async (mode) => {
      const { Dialog } = jest.requireMock<{ Dialog: { confirm: jest.Mock } }>(
        '@onekeyhq/components',
      );
      const { readEnableBirthday } = jest.requireMock<{
        readEnableBirthday: jest.Mock;
      }>(
        '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls',
      );
      const timestamp = new Date(2025, 6, 19).getTime();
      mockAccountStates['hd-1--0'] = {
        enabled: true,
        paused: false,
        birthdayTimestamp: timestamp,
        birthdayHeight: 2_500_000,
      };
      render(<PrivacyNetworkSettings networkId="zec--0" />);
      const button = await screen.findByTestId(
        'privacy-network-birthday-hd-1--0',
      );
      await act(async () => {
        fireEvent.click(button);
      });
      const args = Dialog.confirm.mock.calls.at(-1)?.[0] as {
        renderContent: ReactElement<{
          formRef: { current: IBirthdayFormState };
        }>;
        onConfirm: (params: { preventClose: () => void }) => Promise<void>;
      };
      expect(args.renderContent.props.formRef.current.date?.getTime()).toBe(
        timestamp,
      );
      expect(args.renderContent.props.formRef.current.height).toBe('2500000');
      args.renderContent.props.formRef.current.mode = mode;
      const birthday =
        mode === 'height'
          ? { birthdayHeight: 2_500_000, birthdayTimestamp: undefined }
          : { birthdayTimestamp: timestamp, birthdayHeight: undefined };
      readEnableBirthday.mockReturnValueOnce(birthday);
      const preventClose = jest.fn();
      await act(async () => {
        await args.onConfirm({ preventClose });
      });
      expect(preventClose).not.toHaveBeenCalled();
      expect(mockRepair).toHaveBeenCalledWith({
        accountId: 'hd-1--0',
        networkId: 'zec--0',
        mode: mode === 'date' ? 'month' : 'height',
        ...birthday,
      });
    },
  );

  it('explains a full network before asking for a birthday', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { confirm: jest.Mock } }>(
      '@onekeyhq/components',
    );
    Dialog.confirm.mockClear();
    mockAdmission.mockRejectedValue(
      Object.assign(new Error('full'), {
        key: ETranslations.privacy_slots_delete__desc,
        autoToast: false,
      }),
    );
    render(<PrivacyNetworkSettings />);
    await waitFor(() =>
      expect(screen.getByTestId('privacy-network-enable-hd-1--0')).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('privacy-network-enable-hd-1--0'));
    });

    await waitFor(() => expect(mockShowSlotsFull).toHaveBeenCalledTimes(1));
    expect(mockAdmission).toHaveBeenCalledWith({
      networkId: 'zec--0',
      accountId: 'hd-1--0',
    });
    // Already on the page that lists the accounts and their data.
    expect(
      (mockShowSlotsFull.mock.calls[0][0] as { onOpenSettings?: unknown })
        .onOpenSettings,
    ).toBeUndefined();
    expect(Dialog.confirm).not.toHaveBeenCalled();
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it('deletes with a short explanation and offers Enable again once the request is saved', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { confirm: jest.Mock } }>(
      '@onekeyhq/components',
    );
    mockAccountStates['hd-1--0'] = { enabled: true, paused: false };
    mockDelete.mockImplementation(async ({ accountId }) => {
      mockAccountStates[accountId] = { enabled: false, paused: false };
    });
    render(<PrivacyNetworkSettings networkId="zec--0" />);
    await waitFor(() =>
      expect(
        screen.getByTestId('privacy-network-birthday-hd-1--0'),
      ).toBeTruthy(),
    );
    expect(screen.queryByTestId('privacy-network-enable-hd-1--0')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByTestId('privacy-sync-toggle-btn')).toBeNull();
    fireEvent.click(screen.getByTestId('privacy-network-delete-hd-1--0'));
    const args = Dialog.confirm.mock.calls.at(-1)?.[0] as {
      description: string;
      onConfirm: () => Promise<void>;
    };
    expect(args.description).toBe('privacy_delete_data__desc');
    await act(async () => {
      await args.onConfirm();
    });
    expect(mockDelete).toHaveBeenCalledWith({
      networkId: 'zec--0',
      accountId: 'hd-1--0',
    });
    expect(screen.getByTestId('privacy-network-enable-hd-1--0')).toBeTruthy();
  });

  it('does not disable Delete while background preparation is pending', async () => {
    mockAccountStates['hd-1--0'] = {
      enabled: true,
      paused: false,
      pendingOperation: 'enable',
    };
    render(<PrivacyNetworkSettings />);
    await waitFor(() =>
      expect(screen.getByTestId('privacy-network-delete-hd-1--0')).toBeTruthy(),
    );
    expect(
      (
        screen.getByTestId(
          'privacy-network-delete-hd-1--0',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(screen.queryByText('global.processing')).toBeNull();
  });
  it('shows a required storage upgrade even when the background has no active scan or ordinary error', async () => {
    mockAccountStates['hd-1--0'] = { enabled: true, paused: false };
    mockUnsupportedNetworks = ['zec--0'];
    render(<PrivacyNetworkSettings />);
    await waitFor(() =>
      expect(
        screen.getByTestId('privacy-network-storage-error-hd-1--0'),
      ).toBeTruthy(),
    );
    expect(
      screen.getByTestId('privacy-network-storage-error-hd-1--0').textContent,
    ).toContain('privacy_error_webview_outdated__msg');
  });
});
