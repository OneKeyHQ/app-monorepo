/** @jest-environment jsdom */
import type { ReactElement, ReactNode } from 'react';

import PrivacyNetworkSettings from '.';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import type {
  IBirthdayFormState,
  IEarliestBirthday,
} from '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls';
import type { ILocalWalletAccountListItem } from '@onekeyhq/kit-bg/src/services/ServicePrivacyChain';
import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletAccountState,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes/setting';

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
// eslint-disable-next-line no-var, vars-on-top
var mockBirthdaySettings: {
  earliestBirthday?: IEarliestBirthday;
  deviceExportsViewKey?: boolean;
} = {};
// eslint-disable-next-line no-var, vars-on-top
var mockRouteParams: IModalSettingParamList[EModalSettingRoutes.SettingPrivacyNetwork];
const mockPopStack = jest.fn();
const mockGetVaultSettings = jest.fn(
  async (_params: { networkId: string }) => ({
    localWallet: { accountSetup: mockBirthdaySettings },
  }),
);
// eslint-disable-next-line no-var, vars-on-top
var mockAllowCellular: boolean | undefined;
// eslint-disable-next-line no-var, vars-on-top
var mockIsNative = false;
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
const mockResumeChain = jest.fn(async (_params: unknown) => undefined);
const mockAdmission = jest.fn(
  async (_params: unknown): Promise<void> => undefined,
);
const mockTwinBirthday = jest.fn(
  async (_params: unknown): Promise<{ birthdayHeight: number } | undefined> =>
    undefined,
);
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
    formatMessage: (
      { id }: { id: string },
      values?: { height?: string | number },
    ) => (values?.height === undefined ? id : `${id}: ${values.height}`),
    formatNumber: (value: number) =>
      new Intl.NumberFormat('en-US').format(value),
  }),
}));

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn(), popStack: mockPopStack }),
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
      preparingAccountKeys: [],
      boostingNetworkIds: mockBoostingNetworks,
      storageUnsupportedNetworkIds: mockUnsupportedNetworks,
      syncErrorByNetworkId: {},
      progress: mockProgress,
      allowCellularSync: mockAllowCellular,
    },
  ],
}));

// Only phones have mobile data: the row shows on native alone.
jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<{
    default: Record<string, unknown>;
  }>('@onekeyhq/shared/src/platformEnv').default;
  return {
    __esModule: true,
    default: Object.create(actual, {
      isNative: { get: () => mockIsNative },
    }) as Record<string, unknown>,
  };
});

jest.mock('@onekeyhq/kit/src/components/LazyLoadPage', () => ({
  LazyLoadPage: () => () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls',
  () => ({
    BirthdayDialogForm: () => null,
    getBirthdayInputError: () => 'global.bulk_accounts_page_number_error',
    readEnableBirthday: jest.fn(() => ({ birthdayHeight: 3_428_143 })),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/PrivacyEnableContent',
  () => ({
    PrivacyEnableContent: () => null,
    createPrivacyEnableForm: jest.fn(() => ({ current: {} })),
  }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getNetworkSafe: async () => undefined,
      getVaultSettings: (params: { networkId: string }) =>
        mockGetVaultSettings(params),
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
      getLocalWalletTwinBirthday: (params: unknown) => mockTwinBirthday(params),
      disableLocalWalletAccount: (params: {
        accountId: string;
        networkId: string;
      }) => mockDisable(params),
      deleteLocalWalletAccountData: (params: {
        accountId: string;
        networkId: string;
      }) => mockDelete(params),
      repairLocalChainData: (params: unknown) => mockRepair(params),
      startForegroundBoost: (params: unknown) => mockResumeChain(params),
      getLocalWalletSyncProgress: async () => undefined,
      getLocalWalletNetworkInfo: async () => undefined,
      isPrivacySyncOnCellularAllowed: async () => false,
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatarBase: ({
    logoURI,
    networkName,
  }: {
    logoURI: string;
    networkName?: string;
  }) => <img src={logoURI} alt={networkName} />,
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItem = ({
    title,
    subtitle,
    testID,
    children,
    onPress,
    disabled,
    renderAvatar,
    renderItemText,
  }: {
    onPress?: () => void;
    disabled?: boolean;
    title?: string;
    subtitle?: string;
    testID?: string;
    children?: ReactNode;
    renderAvatar?: ReactNode;
    renderItemText?: ReactNode;
  }) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        onClick={onPress}
        disabled={disabled}
      >
        {renderAvatar}
        {renderItemText ?? (
          <>
            <span>{title}</span>
            <span>{subtitle}</span>
          </>
        )}
        {children}
      </button>
    ) : (
      <div data-testid={testID}>
        {renderAvatar}
        {renderItemText ?? (
          <>
            <span>{title}</span>
            <span>{subtitle}</span>
          </>
        )}
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
  const Action = ({
    children,
    testID,
    onPress,
    disabled,
    title,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    disabled?: boolean;
    title?: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      aria-label={title}
    >
      {children}
    </button>
  );
  return {
    Button: Action,
    IconButton: Action,
    Dialog: { confirm: jest.fn(), show: jest.fn() },
    Divider: () => null,
    ESwitchSize: { small: 'small' },
    Page: Object.assign(Wrapper, { Header: () => null, Body: Wrapper }),
    Progress: () => null,
    ScrollView: Wrapper,
    SizableText: Wrapper,
    Spinner: () => null,
    Stack: Wrapper,
    Switch: ({ testID, value }: { testID?: string; value?: boolean }) => (
      <input type="checkbox" data-testid={testID} checked={!!value} readOnly />
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
    mockRouteParams = undefined;
    mockPopStack.mockClear();
    const { Dialog, Toast } = jest.requireMock<{
      Dialog: { show: jest.Mock; confirm: jest.Mock };
      Toast: { error: jest.Mock };
    }>('@onekeyhq/components');
    Dialog.show.mockClear();
    Dialog.confirm.mockClear();
    Toast.error.mockClear();
    mockAccountStates = {};
    mockUnsupportedNetworks = [];
    mockProgress = {};
    mockPausedNetworks = [];
    mockBoostingNetworks = [];
    mockBirthdaySettings = {};
    mockGetVaultSettings.mockClear();
    mockEnable.mockReset().mockResolvedValue(undefined);
    mockAdmission.mockReset().mockResolvedValue(undefined);
    mockShowSlotsFull.mockClear();
    mockDisable.mockReset().mockResolvedValue(undefined);
    mockDelete.mockReset().mockResolvedValue(undefined);
    mockRepair.mockClear();
    mockResumeChain.mockClear();
    mockTwinBirthday.mockReset().mockResolvedValue(undefined);
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

  it('opens the requested account once and stays in privacy settings after enabling', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { show: jest.Mock } }>(
      '@onekeyhq/components',
    );
    mockRouteParams = {
      walletId: 'hd-1',
      networkId: 'xmr--0',
      accountId: 'hd-1--1',
      enableSync: true,
    };
    mockBirthdaySettings = { deviceExportsViewKey: true };
    mockAccounts = [
      listItem({ networkId: 'xmr--0' }),
      listItem({
        accountId: 'hd-1--1',
        accountName: 'Account #2',
        networkId: 'xmr--0',
      }),
      listItem({ accountId: 'hd-1--1', networkId: 'zec--0' }),
    ];
    const { rerender } = render(<PrivacyNetworkSettings />);
    await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
    expect(mockAdmission).toHaveBeenCalledWith({
      networkId: 'xmr--0',
      accountId: 'hd-1--1',
    });
    const args = Dialog.show.mock.calls[0][0] as {
      description: string;
      showConfirmButton: boolean;
      showCancelButton: boolean;
      renderContent: ReactElement<{
        accountId: string;
        deviceExportsViewKey?: boolean;
      }>;
      onConfirm: (params: { preventClose: () => void }) => Promise<void>;
      onClose: (extra?: { flag?: string }) => void;
    };
    expect(args.description).toBe('Account #2');
    expect(args.showConfirmButton).toBe(true);
    expect(args.showCancelButton).toBe(true);
    expect(args.renderContent.props.accountId).toBe('hd-1--1');
    expect(args.renderContent.props.deviceExportsViewKey).toBe(true);
    rerender(<PrivacyNetworkSettings />);
    expect(Dialog.show).toHaveBeenCalledTimes(1);
    await act(async () => {
      await args.onConfirm({ preventClose: jest.fn() });
      args.onClose({ flag: 'confirm' });
    });
    expect(mockEnable).toHaveBeenCalledWith({
      networkId: 'xmr--0',
      accountId: 'hd-1--1',
      birthdayHeight: 3_428_143,
    });
    expect(Dialog.show).toHaveBeenCalledTimes(1);
    expect(mockPopStack).not.toHaveBeenCalled();
  });

  it.each(['cancel', undefined])(
    'returns to Receive when the requested enable dialog closes with %s',
    async (flag) => {
      const { Dialog } = jest.requireMock<{ Dialog: { show: jest.Mock } }>(
        '@onekeyhq/components',
      );
      mockRouteParams = {
        networkId: 'zec--0',
        accountId: 'hd-1--0',
        enableSync: true,
      };
      render(<PrivacyNetworkSettings />);
      await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
      const args = Dialog.show.mock.calls[0][0] as {
        onClose: (extra?: { flag?: string }) => void;
      };
      act(() => args.onClose(flag ? { flag } : undefined));
      expect(mockPopStack).toHaveBeenCalledTimes(1);
      expect(mockEnable).not.toHaveBeenCalled();
    },
  );

  it('resumes the requested paused account without replacing its saved birthday', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { show: jest.Mock } }>(
      '@onekeyhq/components',
    );
    mockRouteParams = {
      networkId: 'zec--0',
      accountId: 'hd-1--0',
      enableSync: true,
    };
    mockAccountStates['hd-1--0'] = {
      enabled: false,
      paused: true,
      birthdayHeight: 3_500_000,
    };
    render(<PrivacyNetworkSettings />);
    await waitFor(() => expect(mockEnable).toHaveBeenCalledTimes(1));
    expect(mockEnable).toHaveBeenCalledWith({
      networkId: 'zec--0',
      accountId: 'hd-1--0',
    });
    expect(mockAccountStates['hd-1--0'].birthdayHeight).toBe(3_500_000);
    expect(mockAdmission).not.toHaveBeenCalled();
    expect(mockTwinBirthday).not.toHaveBeenCalled();
    expect(Dialog.show).not.toHaveBeenCalled();
    expect(mockPopStack).not.toHaveBeenCalled();
  });

  it.each(['enabled', 'enabling'] as const)(
    'leaves an already %s account unchanged',
    async (accountStatus) => {
      const { Dialog } = jest.requireMock<{ Dialog: { show: jest.Mock } }>(
        '@onekeyhq/components',
      );
      mockRouteParams = {
        networkId: 'zec--0',
        accountId: 'hd-1--0',
        enableSync: true,
      };
      mockAccountStates['hd-1--0'] = {
        enabled: accountStatus === 'enabled',
        paused: false,
        pendingOperation: accountStatus === 'enabling' ? 'enable' : undefined,
      };
      render(<PrivacyNetworkSettings />);
      await screen.findByTestId('privacy-network-account-detail-hd-1--0');
      expect(mockAdmission).not.toHaveBeenCalled();
      expect(mockEnable).not.toHaveBeenCalled();
      expect(mockDisable).not.toHaveBeenCalled();
      expect(Dialog.show).not.toHaveBeenCalled();
      expect(mockPopStack).not.toHaveBeenCalled();
    },
  );

  it.each(['missing', 'temporary', 'privacy-disabled'])(
    'does not enable a %s target or fall back to another account',
    async (targetState) => {
      const { Dialog, Toast } = jest.requireMock<{
        Dialog: { show: jest.Mock };
        Toast: { error: jest.Mock };
      }>('@onekeyhq/components');
      mockRouteParams = {
        networkId: 'zec--0',
        accountId: 'hd-1--1',
        enableSync: true,
      };
      mockAccounts = [listItem({})];
      if (targetState !== 'missing') {
        mockAccounts.push(
          listItem({
            accountId: 'hd-1--1',
            walletIsTemp: targetState === 'temporary',
          }),
        );
        mockAccountStates['hd-1--1'] = {
          enabled: false,
          paused: false,
          privacyDisabled: targetState === 'privacy-disabled',
        };
      }
      render(<PrivacyNetworkSettings />);
      await waitFor(() => expect(Toast.error).toHaveBeenCalledTimes(1));
      expect(mockAdmission).not.toHaveBeenCalled();
      expect(mockEnable).not.toHaveBeenCalled();
      expect(Dialog.show).not.toHaveBeenCalled();
      expect(mockPopStack).not.toHaveBeenCalled();
    },
  );

  it('keeps settings usable after an automatic enable preparation error', async () => {
    const { Dialog, Toast } = jest.requireMock<{
      Dialog: { show: jest.Mock };
      Toast: { error: jest.Mock };
    }>('@onekeyhq/components');
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockRouteParams = {
      networkId: 'zec--0',
      accountId: 'hd-1--0',
      enableSync: true,
    };
    mockAdmission.mockRejectedValueOnce(new Error('runtime unavailable'));
    const { rerender } = render(<PrivacyNetworkSettings />);
    await waitFor(() => expect(Toast.error).toHaveBeenCalledTimes(1));
    rerender(<PrivacyNetworkSettings />);
    expect(mockAdmission).toHaveBeenCalledTimes(1);
    expect(Dialog.show).not.toHaveBeenCalled();
    expect(mockPopStack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('privacy-network-enable-hd-1--0'));
    await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
    expect(mockAdmission).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('does not open an enable dialog after leaving settings during preparation', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { show: jest.Mock } }>(
      '@onekeyhq/components',
    );
    let finishAdmission: () => void = () => {};
    mockAdmission.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishAdmission = resolve;
        }),
    );
    mockRouteParams = {
      networkId: 'zec--0',
      accountId: 'hd-1--0',
      enableSync: true,
    };
    const { unmount } = render(<PrivacyNetworkSettings />);
    await waitFor(() => expect(mockAdmission).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => finishAdmission());
    expect(Dialog.show).not.toHaveBeenCalled();
    expect(mockEnable).not.toHaveBeenCalled();
    expect(mockTwinBirthday).not.toHaveBeenCalled();
  });

  it('does not automatically enable accounts for the ordinary settings entry', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { show: jest.Mock } }>(
      '@onekeyhq/components',
    );
    mockRouteParams = { walletId: 'hd-1', networkId: 'zec--0' };
    render(<PrivacyNetworkSettings />);
    await screen.findByTestId('privacy-network-enable-hd-1--0');
    expect(mockAdmission).not.toHaveBeenCalled();
    expect(mockEnable).not.toHaveBeenCalled();
    expect(Dialog.show).not.toHaveBeenCalled();
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

  it('shows the saved scan height without loading settings for every account', async () => {
    mockAccounts = [listItem({}), listItem({ accountId: 'hd-1--1' })];
    mockAccountStates['hd-1--0'] = {
      enabled: true,
      paused: false,
      birthdayHeight: 3_500_000,
    };
    mockBirthdaySettings = {
      earliestBirthday: { height: 3_428_143, timestamp: 1_785_196_800_000 },
    };
    render(<PrivacyNetworkSettings networkId="zec--0" />);

    const row = await screen.findByTestId('privacy-network-birthday-hd-1--0');
    expect(row.textContent).toContain(
      `${ETranslations.privacy_sync_start_block__title}: 3,500,000`,
    );
    // Only the network progress needs settings; each account uses its saved height.
    expect(mockGetVaultSettings).toHaveBeenCalledTimes(1);
  });

  it('loads and forwards the earliest birthday once when enabling privacy', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { show: jest.Mock } }>(
      '@onekeyhq/components',
    );
    const { createPrivacyEnableForm } = jest.requireMock<{
      createPrivacyEnableForm: jest.Mock;
    }>(
      '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/PrivacyEnableContent',
    );
    const { readEnableBirthday } = jest.requireMock<{
      readEnableBirthday: jest.Mock;
    }>(
      '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletRepairControls',
    );
    mockAccounts = [listItem({})];
    mockBirthdaySettings = {
      earliestBirthday: { height: 3_428_143, timestamp: 1_785_196_800_000 },
    };
    render(<PrivacyNetworkSettings networkId="zec--0" />);
    const enableButton = await screen.findByTestId(
      'privacy-network-enable-hd-1--0',
    );
    mockGetVaultSettings.mockClear();
    await act(async () => {
      fireEvent.click(enableButton);
    });
    const args = Dialog.show.mock.calls.at(-1)?.[0] as {
      renderContent: ReactElement<{
        formRef: { current: IBirthdayFormState };
        earliestBirthday?: IEarliestBirthday;
      }>;
      onConfirm: (params: { preventClose: () => void }) => Promise<void>;
    };
    const formProps = args.renderContent.props;
    expect(createPrivacyEnableForm).toHaveBeenLastCalledWith({
      earliestBirthday: mockBirthdaySettings.earliestBirthday,
    });
    expect(formProps.earliestBirthday).toEqual(
      mockBirthdaySettings.earliestBirthday,
    );
    formProps.formRef.current.fromEarliest = true;
    readEnableBirthday.mockReturnValueOnce({ birthdayHeight: 3_428_143 });
    await act(async () => {
      await args.onConfirm({ preventClose: jest.fn() });
    });
    expect(readEnableBirthday).toHaveBeenLastCalledWith(
      formProps.formRef.current,
      mockBirthdaySettings.earliestBirthday,
      'zec--0',
    );
    expect(mockEnable).toHaveBeenCalledWith({
      accountId: 'hd-1--0',
      networkId: 'zec--0',
      birthdayHeight: 3_428_143,
    });
    expect(mockGetVaultSettings).toHaveBeenCalledTimes(1);
  });

  it('pauses only the selected account and resumes without changing its birthday', async () => {
    mockAccounts = [listItem({}), listItem({ accountId: 'hd-1--1' })];
    mockAccountStates = {
      'hd-1--0': { enabled: true, paused: false, birthdayHeight: 3_500_000 },
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
    expect(mockAccountStates['hd-1--0'].birthdayHeight).toBe(3_500_000);
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

  // Use mobile data pressed on the light or the token page shows here at once.
  it('shows mobile data consent given elsewhere', async () => {
    mockIsNative = true;
    mockAllowCellular = false;
    mockAccounts = [listItem({})];
    mockAccountStates = { 'hd-1--0': { enabled: true, paused: false } };
    try {
      const { rerender } = render(<PrivacyNetworkSettings />);
      const consent = () =>
        screen.getByTestId(
          'privacy-sync-allow-cellular-switch',
        ) as HTMLInputElement;
      await waitFor(() => expect(consent().checked).toBe(false));

      mockAllowCellular = true;
      rerender(<PrivacyNetworkSettings />);
      expect(consent().checked).toBe(true);
    } finally {
      mockIsNative = false;
      mockAllowCellular = undefined;
    }
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
    // The chain switch, the same one the sync light's Continue turns on.
    await act(async () => {
      fireEvent.click(screen.getByTestId('privacy-sync-resume-btn'));
    });
    expect(mockResumeChain).toHaveBeenCalledWith({
      networkId: 'zec--0',
      trigger: 'manual-sync',
    });
    expect(mockDisable).not.toHaveBeenCalled();
    mockPausedNetworks = [];
    // Every scanning account has a position; one without would keep the chain unsynced.
    mockProgress['zec--0:hd-1--1'] = complete;
    delete mockProgress['zec--0:waiting'];
    // Synced by blocks left, whatever the pace; with scanned and chain heights, never a bare "synced".
    for (const boosting of [['zec--0'], []]) {
      mockBoostingNetworks = boosting;
      rerender(<PrivacyNetworkSettings networkId="zec--0" />);
      expect(progressText(screen.getByTestId('privacy-sync-progress'))).toBe(
        'global.synced · 100 / 100',
      );
    }
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
      const timestamp = new Date(2026, 9, 19).getTime();
      mockAccountStates['hd-1--0'] = {
        enabled: true,
        paused: false,
        birthdayTimestamp: timestamp,
        birthdayHeight: 3_500_000,
      };
      mockBirthdaySettings = {
        earliestBirthday: { height: 3_428_143, timestamp: 1_785_196_800_000 },
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
      expect(args.renderContent.props.formRef.current.height).toBe('3500000');
      args.renderContent.props.formRef.current.mode = mode;
      const birthday =
        mode === 'height'
          ? { birthdayHeight: 3_500_000, birthdayTimestamp: undefined }
          : { birthdayTimestamp: timestamp, birthdayHeight: undefined };
      readEnableBirthday.mockReturnValueOnce(birthday);
      const preventClose = jest.fn();
      await act(async () => {
        await args.onConfirm({ preventClose });
      });
      expect(preventClose).not.toHaveBeenCalled();
      expect(readEnableBirthday).toHaveBeenLastCalledWith(
        args.renderContent.props.formRef.current,
        mockBirthdaySettings.earliestBirthday,
        'zec--0',
      );
      expect(mockRepair).toHaveBeenCalledWith({
        accountId: 'hd-1--0',
        networkId: 'zec--0',
        mode: mode === 'date' ? 'month' : 'height',
        ...birthday,
      });
    },
  );

  it.each([
    {
      networkId: 'zec--0',
      earliestBirthday: { height: 3_428_143, timestamp: 1_785_196_800_000 },
      expectedHeight: 3_428_143,
    },
    {
      networkId: 'xmr--0',
      earliestBirthday: { height: 1, timestamp: 1_397_779_200_000 },
      expectedHeight: 1,
    },
  ])(
    'uses the earliest supported block when resyncing $networkId from the beginning',
    async ({ networkId, earliestBirthday, expectedHeight }) => {
      const { Dialog } = jest.requireMock<{ Dialog: { confirm: jest.Mock } }>(
        '@onekeyhq/components',
      );
      mockAccounts = [listItem({ networkId })];
      mockAccountStates['hd-1--0'] = {
        enabled: true,
        paused: false,
        birthdayHeight: 3_500_000,
      };
      mockBirthdaySettings = { earliestBirthday };
      render(<PrivacyNetworkSettings networkId={networkId} />);
      const birthdayButton = await screen.findByTestId(
        'privacy-network-birthday-hd-1--0',
      );
      mockGetVaultSettings.mockClear();
      await act(async () => {
        fireEvent.click(birthdayButton);
      });
      const args = Dialog.confirm.mock.calls.at(-1)?.[0] as {
        renderContent: ReactElement<{
          formRef: { current: IBirthdayFormState };
          earliestBirthday?: IEarliestBirthday;
        }>;
        onConfirm: (params: { preventClose: () => void }) => Promise<void>;
      };
      expect(args.renderContent.props.earliestBirthday).toEqual(
        earliestBirthday,
      );
      args.renderContent.props.formRef.current.fromEarliest = true;
      const preventClose = jest.fn();
      await act(async () => {
        await args.onConfirm({ preventClose });
      });
      expect(preventClose).not.toHaveBeenCalled();
      expect(mockRepair).toHaveBeenCalledWith({
        accountId: 'hd-1--0',
        networkId,
        mode: 'height',
        birthdayHeight: expectedHeight,
        birthdayTimestamp: undefined,
      });
      expect(mockGetVaultSettings).toHaveBeenCalledTimes(1);
    },
  );

  it('explains a full network before asking for a birthday', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { show: jest.Mock } }>(
      '@onekeyhq/components',
    );
    Dialog.show.mockClear();
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
    expect(Dialog.show).not.toHaveBeenCalled();
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
    expect(screen.queryByText('privacy_delete_data__desc')).toBeNull();
    const settingsCalls = mockGetVaultSettings.mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByTestId('privacy-network-delete-hd-1--0'));
    });
    const args = Dialog.confirm.mock.calls.at(-1)?.[0] as {
      title: string;
      description: string;
      onConfirm: () => Promise<void>;
    };
    expect(Dialog.confirm).toHaveBeenCalledTimes(1);
    expect(args.title).toBe('privacy_delete_data__title');
    expect(args.description).toBe('privacy_delete_data__desc');
    expect(mockGetVaultSettings).toHaveBeenCalledTimes(settingsCalls);
    expect(mockRepair).not.toHaveBeenCalled();
    await act(async () => {
      await args.onConfirm();
    });
    expect(mockDelete).toHaveBeenCalledWith({
      networkId: 'zec--0',
      accountId: 'hd-1--0',
    });
    expect(screen.getByTestId('privacy-network-enable-hd-1--0')).toBeTruthy();
  });

  it('identifies same-name accounts by chain and deletes only the selected network account', async () => {
    const { Dialog } = jest.requireMock<{ Dialog: { confirm: jest.Mock } }>(
      '@onekeyhq/components',
    );
    mockAccounts = [
      listItem({}),
      listItem({
        accountId: 'hd-2--0',
        walletId: 'hd-2',
        walletName: 'Wallet 2',
        networkId: 'xmr--0',
      }),
    ];
    mockAccountStates = {
      'hd-1--0': { enabled: true, paused: false },
      'hd-2--0': { enabled: true, paused: false },
    };
    render(<PrivacyNetworkSettings />);

    const firstAccount = await screen.findByTestId(
      'account-manager-privacy-network-account-hd-1--0',
    );
    const secondAccount = screen.getByTestId(
      'account-manager-privacy-network-account-hd-2--0',
    );
    expect(firstAccount.textContent).toContain('Account #1');
    expect(firstAccount.textContent).toContain('Wallet 1');
    expect(secondAccount.textContent).toContain('Account #1');
    expect(secondAccount.textContent).toContain('Wallet 2');
    expect(
      screen.getByTestId('privacy-network-chain-hd-1--0').textContent,
    ).toBe('Zcash');
    expect(
      screen.getByTestId('privacy-network-chain-hd-2--0').textContent,
    ).toBe('Monero');
    expect(
      within(firstAccount)
        .getByRole('img', { name: 'Zcash' })
        .getAttribute('src'),
    ).toBe('https://uni.onekey-asset.com/static/chain/zec.png');
    expect(
      within(secondAccount)
        .getByRole('img', { name: 'Monero' })
        .getAttribute('src'),
    ).toBe('https://common.onekey-asset.com/chain/monero.png');

    fireEvent.click(screen.getByTestId('privacy-network-delete-hd-2--0'));
    const args = Dialog.confirm.mock.calls.at(-1)?.[0] as {
      onConfirm: () => Promise<void>;
    };
    await act(async () => {
      await args.onConfirm();
    });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith({
      networkId: 'xmr--0',
      accountId: 'hd-2--0',
    });
    expect(mockDisable).not.toHaveBeenCalled();
    expect(mockRepair).not.toHaveBeenCalled();
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

  it.each(['zec--0', 'xmr--0'])(
    'disables the Enable control for server-disabled %s',
    async (networkId) => {
      mockAccounts = [listItem({ networkId })];
      mockAccountStates['hd-1--0'] = {
        enabled: false,
        paused: false,
        privacyDisabled: true,
      };
      render(<PrivacyNetworkSettings />);
      const button = await screen.findByTestId(
        'privacy-network-enable-hd-1--0',
      );
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
      expect(mockEnable).not.toHaveBeenCalled();
      expect(mockAdmission).not.toHaveBeenCalled();
      expect(screen.queryByTestId('privacy-network-resume-hd-1--0')).toBeNull();
      expect(
        screen.getByTestId('account-manager-privacy-network-account-hd-1--0')
          .textContent,
      ).toContain('global.not_available');
    },
  );
});
