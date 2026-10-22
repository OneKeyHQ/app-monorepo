/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import PrivacyNetworkSettings from '.';

import { render, screen, waitFor } from '@testing-library/react';

import type { ILocalWalletAccountListItem } from '@onekeyhq/kit-bg/src/services/ServicePrivacyChain';
import type { ILocalWalletAccountState } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';

// eslint-disable-next-line no-var, vars-on-top
var mockAccounts: ILocalWalletAccountListItem[] = [];

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
      pausedNetworkIds: [],
      storageUnsupportedNetworkIds: [],
      progress: {},
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
    readEnableBirthday: () => undefined,
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
      getLocalWalletAccountState:
        async (): Promise<ILocalWalletAccountState> => ({
          enabled: false,
          paused: false,
        }),
      getLocalWalletSyncProgress: async () => undefined,
      getLocalWalletNetworkInfo: async () => undefined,
      getLocalWalletSlotUsage: async () => ({
        used: 0,
        occupants: [],
        hiddenCount: 0,
      }),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItem = ({
    title,
    subtitle,
    testID,
    children,
  }: {
    title?: string;
    subtitle?: string;
    testID?: string;
    children?: ReactNode;
  }) => (
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
    Button: Wrapper,
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

describe('Privacy network settings for a temp wallet', () => {
  beforeEach(() => {
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
    ).toContain('hidden wallets');
    expect(screen.getByText(/global\.not_available/)).toBeTruthy();
    // Stored data can still be deleted.
    expect(
      screen.getByTestId('privacy-network-delete-hw-1-passphrase--0'),
    ).toBeTruthy();
  });

  it('leaves a saved wallet switchable', async () => {
    render(<PrivacyNetworkSettings />);

    await waitFor(() =>
      expect(screen.getByTestId('privacy-network-switch-hd-1--0')).toBeTruthy(),
    );
    expect(
      screen.queryByTestId('privacy-network-temp-wallet-hd-1--0'),
    ).toBeNull();
  });
});
