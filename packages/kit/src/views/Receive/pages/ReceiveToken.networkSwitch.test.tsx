/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import type { IAccountToken } from '@onekeyhq/shared/types/token';

import ReceiveToken from './ReceiveToken';

type IMockRouteParams = Record<string, unknown>;

let mockRouteParams: IMockRouteParams = {};
const mockPush = jest.fn();
const mockPushModal = jest.fn();
const mockVerifyHWAccountAddresses = jest.fn<Promise<string[]>, [unknown]>();
const mockShowReceived = jest.fn<void, [unknown]>();
const mockReceivePageShown = jest.fn<void, [unknown]>();
const mockReceiveSwitchNetwork = jest.fn<void, [unknown]>();
const mockToastError = jest.fn<void, [unknown]>();
const mockFindAggregateGroup = jest.fn<Promise<unknown>, [unknown]>(
  async () => undefined,
);
const mockGetVaultSettings = jest.fn<
  Promise<{ mergeDeriveAssetsEnabled: boolean }>,
  [unknown]
>(async () => ({ mergeDeriveAssetsEnabled: false }));
const mockAppEventBusOn = jest.fn<void, [string, () => void]>();
// One identity across calls, as the page keeps it in state: the test intl
// object is new on every render, which re-runs the account lookup.
const mockDefaultDeriveResp = {
  deriveType: 'default',
  deriveInfo: { label: 'Default' },
};
const mockGetAccountsByIndexedAccounts = jest.fn<
  Promise<{ accounts: unknown[] }>,
  [unknown]
>(async () => ({ accounts: [] }));
const mockGetNetworkAccountsWithDeriveTypes = jest.fn<
  Promise<{ networkAccounts: unknown[] }>,
  [unknown]
>(async () => ({ networkAccounts: [] }));
const mockFetchWalletBanner = jest.fn<
  Promise<unknown[]>,
  [{ accountId?: string }]
>(async () => []);

const NETWORKS: Record<string, { id: string; name: string; logoURI: string }> =
  {
    'evm--1': { id: 'evm--1', name: 'Ethereum', logoURI: '' },
    'evm--8453': { id: 'evm--8453', name: 'Base', logoURI: '' },
    'tron--0x2b6653dc': { id: 'tron--0x2b6653dc', name: 'Tron', logoURI: '' },
    'btc--0': { id: 'btc--0', name: 'Bitcoin', logoURI: '' },
  };

type IMockAccount = {
  id: string;
  address: string;
  indexedAccountId?: string;
  addressDetail: { receiveAddressPath: string };
};

const ACCOUNTS: Record<string, IMockAccount> = {
  'hw-1--evm1': {
    id: 'hw-1--evm1',
    address: '0xaaa',
    indexedAccountId: 'hw-1--0',
    addressDetail: { receiveAddressPath: "m/44'/60'/0'/0/0" },
  },
  'hw-1--base': {
    id: 'hw-1--base',
    address: '0xbbb',
    indexedAccountId: 'hw-1--0',
    addressDetail: { receiveAddressPath: "m/44'/60'/0'/0/0" },
  },
  'hd-1--evm1': {
    id: 'hd-1--evm1',
    address: '0xaaa',
    indexedAccountId: 'hd-1--0',
    addressDetail: { receiveAddressPath: "m/44'/60'/0'/0/0" },
  },
  'hd-1--base': {
    id: 'hd-1--base',
    address: '0xbbb',
    indexedAccountId: 'hd-1--0',
    addressDetail: { receiveAddressPath: "m/44'/60'/0'/0/0" },
  },
};

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-intl', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useIntl: () => ({
      locale: 'en',
      formatMessage: (
        { id }: { id: string },
        values?: Record<string, unknown>,
      ) => (values ? `${id}:${JSON.stringify(values)}` : id),
    }),
    FormattedMessage: ({ id }: { id: string }) =>
      React.createElement('span', null, id),
  };
});

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('react-native-image-colors', () => ({
  getColors: jest.fn(async () => ({ platform: 'web', vibrant: '#000000' })),
}));

jest.mock('use-debounce', () => ({
  useDebouncedCallback: (fn: (...args: unknown[]) => unknown) => fn,
  useThrottledCallback: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({
    children,
    onPress,
    testID,
    disabled,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    disabled?: boolean;
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': testID,
        onClick: disabled ? undefined : onPress,
      },
      children,
    );
  const Text = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => React.createElement('span', { 'data-testid': testID }, children);
  const Footer = ({
    children,
    onConfirm,
    confirmButtonProps,
  }: {
    children?: ReactNode;
    onConfirm?: () => void;
    confirmButtonProps?: { testID?: string };
  }) =>
    React.createElement(
      'div',
      null,
      onConfirm
        ? React.createElement('button', {
            'data-testid': confirmButtonProps?.testID,
            onClick: onConfirm,
          })
        : null,
      children,
    );
  return {
    Button: Box,
    Dialog: { confirm: jest.fn() },
    Empty: () => React.createElement('span', { 'data-testid': 'empty' }),
    Icon: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-testid': `icon-${name}` }),
    Image: () => null,
    Page: Object.assign(Box, { Header: () => null, Body: Box, Footer }),
    QRCode: ({ value }: { value: string }) =>
      React.createElement('span', { 'data-testid': 'qr-value' }, value),
    SizableText: Text,
    Skeleton: () => React.createElement('span', { 'data-testid': 'skeleton' }),
    Stack: Box,
    Theme: Box,
    Toast: {
      error: (params: unknown) => mockToastError(params),
      success: jest.fn(),
    },
    XStack: Box,
    YStack: Box,
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EHardwareUiStateAction: { REQUEST_BUTTON: 'REQUEST_BUTTON' },
  EThirdPartyHardwareUiAction: { confirmOnDevice: 'confirmOnDevice' },
  useHardwareUiStateAtom: () => [undefined],
  useThirdPartyHardwareUiStateAtom: () => [undefined],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    CloseHardwareUiStateDialogManually: 'CloseHardwareUiStateDialogManually',
    BtcFreshAddressUpdated: 'BtcFreshAddressUpdated',
  },
  appEventBus: {
    on: (name: string, handler: () => void) => mockAppEventBusOn(name, handler),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target, key: string) => key }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      receive: {
        showReceived: (params: unknown) => mockShowReceived(params),
        receivePageShown: (params: unknown) => mockReceivePageShown(params),
        receiveSwitchNetwork: (params: unknown) =>
          mockReceiveSwitchNetwork(params),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  showIntercom: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/shared/src/routes', () => ({
  EModalReceiveRoutes: {
    ReceiveSelectAggregateToken: 'ReceiveSelectAggregateToken',
    ReceiveSelectNetwork: 'ReceiveSelectNetwork',
    ExchangeOpenRedirect: 'ExchangeOpenRedirect',
  },
  EModalRoutes: { ReceiveModal: 'ReceiveModal' },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isQrWallet: ({ walletId }: { walletId: string }) =>
      walletId.startsWith('qr-'),
    isHwWallet: ({ walletId }: { walletId: string }) =>
      walletId.startsWith('hw-'),
    isOthersWallet: () => false,
    getWalletIdFromAccountId: ({ accountId }: { accountId: string }) =>
      accountId.split('--')[0],
  },
}));

jest.mock('@onekeyhq/shared/src/utils/debug/debugUtils', () => ({
  useDebugComponentRemountLog: () => undefined,
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isBTCNetwork: (networkId?: string) => networkId === 'btc--0',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/receiveArrivalTimeUtils', () => ({
  getReceiveArrivalTimeText: () => '~1 min',
}));

jest.mock('@onekeyhq/shared/src/utils/receiveNetworkStandardUtils', () => ({
  getReceiveNetworkDisplayName: ({ networkName }: { networkName?: string }) =>
    networkName ?? '',
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { getTimeDurationMs: () => 1000 },
}));

jest.mock('@onekeyhq/shared/types/device', () => ({
  EConfirmOnDeviceType: { EveryItem: 'EveryItem' },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceToken: {
      getNativeToken: jest.fn(async () => ({ logoURI: '' })),
      findAggregateGroupByNetworkAndAddress: (params: unknown) =>
        mockFindAggregateGroup(params),
    },
    serviceNetwork: {
      getReceiveArrivalConfig: jest.fn(async () => undefined),
      getVaultSettings: (params: unknown) => mockGetVaultSettings(params),
      getNetwork: jest.fn(
        async ({ networkId }: { networkId: string }) => NETWORKS[networkId],
      ),
      getGlobalDeriveTypeOfNetwork: jest.fn(async () => 'default'),
      getDeriveTypeByTemplate: jest.fn(async () => mockDefaultDeriveResp),
    },
    serviceAccount: {
      verifyHWAccountAddresses: (params: unknown) =>
        mockVerifyHWAccountAddresses(params),
      getAccountsByIndexedAccounts: (params: unknown) =>
        mockGetAccountsByIndexedAccounts(params),
      getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes: (
        params: unknown,
      ) => mockGetNetworkAccountsWithDeriveTypes(params),
    },
    serviceWalletBanner: {
      fetchWalletBanner: (params: { accountId?: string }) =>
        mockFetchWalletBanner(params),
    },
    serviceFreshAddress: {
      syncBTCFreshAddressByAccountId: jest.fn(),
    },
  },
}));

jest.mock(
  '../../../components/AddressTypeSelector/AddressTypeSelector',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

jest.mock('../../../components/HighlightAddress', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HighlightAddress: ({ address }: { address: string }) =>
      React.createElement('span', { 'data-testid': 'address' }, address),
  };
});

jest.mock('../../../components/HyperlinkText', () => ({
  FormatHyperlinkText: () => null,
}));

jest.mock('../../../components/NetworkAvatar', () => ({
  NetworkAvatar: () => null,
}));

jest.mock('../../../components/Token', () => ({
  Token: () => null,
}));

// Synchronous stand-in keyed by the ids the page asks for: the page must
// not rely on the hook's previous result after a switch, so a lookup for
// unknown ids returns nothing (the way a pending fetch would).
jest.mock('../../../hooks/useAccountData', () => {
  // Stable identities, as the real hook keeps its result in state: a fresh
  // object per render would re-trigger the page's apply effect forever.
  const vaultSettings = { mergeDeriveAssetsEnabled: false };
  const deriveInfo = { label: 'Default' };
  const wallets: Record<string, { id: string; type: string }> = {};
  const run = () => undefined;
  return {
    useAccountData: ({
      accountId,
      networkId,
      walletId,
    }: {
      accountId?: string;
      networkId?: string;
      walletId?: string;
    }) => {
      const account = accountId ? ACCOUNTS[accountId] : undefined;
      if (walletId && !wallets[walletId]) {
        wallets[walletId] = { id: walletId, type: walletId.split('-')[0] };
      }
      return {
        account,
        network: networkId ? NETWORKS[networkId] : undefined,
        wallet: walletId ? wallets[walletId] : undefined,
        vaultSettings,
        deriveType: account ? 'default' : undefined,
        deriveInfo: account ? deriveInfo : undefined,
        addressType: undefined,
        run,
        isLoading: false,
      };
    },
  };
});

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush, pushModal: mockPushModal, pop: jest.fn() }),
}));

jest.mock('../../../hooks/useCopyAccountAddress', () => ({
  useCopyAddressWithDeriveType: () => jest.fn(),
}));

jest.mock('../../../hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (
      fn: () => Promise<unknown>,
      deps: unknown[],
      options?: { initResult?: unknown },
    ) => {
      const [result, setResult] = React.useState<unknown>(options?.initResult);
      React.useEffect(() => {
        let cancelled = false;
        void fn().then((value) => {
          if (!cancelled) setResult(value);
        });
        return () => {
          cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      return { result, isLoading: false, run: jest.fn() };
    },
  };
});

jest.mock('../../../hooks/useWalletBanner', () => ({
  useWalletBanner: () => ({ handleBannerOnPress: jest.fn() }),
}));

jest.mock('../components/ReceiveCard', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Cell = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    ReceiveCard: ({
      headerLeft,
      headerRight,
      children,
      testID,
    }: {
      headerLeft?: ReactNode;
      headerRight?: ReactNode;
      children?: ReactNode;
      testID?: string;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': testID ?? 'receive-card' },
        headerLeft,
        headerRight,
        children,
      ),
    ReceiveCardCell: Cell,
  };
});

jest.mock('../components/ReceiveShare', () => ({
  ShareImageGenerator: () => null,
  showReceiveShareDialog: jest.fn(),
}));

function member(
  networkId: string,
  extra: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key: `aggregate_USDT_${networkId}`,
    networkId,
    name: 'Tether',
    symbol: 'USDT',
    commonSymbol: 'USDT',
    address: '0xusdt',
    decimals: 6,
    isNative: false,
    ...extra,
  };
}

const AGGREGATE_USDT: IAccountToken = {
  $key: 'aggregate_USDT_',
  isAggregateToken: true,
  commonSymbol: 'USDT',
  name: 'Tether',
  symbol: 'USDT',
  networkId: '',
  address: 'aggregate_USDT_',
  decimals: 0,
  isNative: false,
};

function buildParams(walletPrefix: 'hw' | 'hd', extra: IMockRouteParams = {}) {
  return {
    networkId: 'evm--1',
    accountId: `${walletPrefix}-1--evm1`,
    walletId: `${walletPrefix}-1`,
    indexedAccountId: `${walletPrefix}-1--0`,
    token: member('evm--1', { accountId: `${walletPrefix}-1--evm1` }),
    switchEntry: 'token',
    source: 'tokenDetails',
    aggregateToken: AGGREGATE_USDT,
    aggregateSubTokenList: [
      member('evm--1', { accountId: `${walletPrefix}-1--evm1` }),
    ],
    allAggregateTokenList: [
      member('evm--1'),
      member('evm--8453'),
      member('tron--0x2b6653dc'),
    ],
    ...extra,
  };
}

async function openSelectorAndSelect(
  getByTestId: ReturnType<typeof render>['getByTestId'],
  selected: IAccountToken,
) {
  fireEvent.click(getByTestId('receive-card-network-trigger'));
  // The picker is a modal stacked over this one, not a page in this stack.
  expect(mockPushModal).toHaveBeenCalledWith('ReceiveModal', {
    screen: 'ReceiveSelectAggregateToken',
    params: expect.objectContaining({
      indexedAccountId: expect.any(String),
      closeAfterSelect: true,
      enableNetworkAfterSelect: true,
    }),
  });
  const { params } = mockPushModal.mock.calls[
    mockPushModal.mock.calls.length - 1
  ][1] as {
    params: {
      onSelect: (
        token: IAccountToken,
        context?: { network?: unknown },
      ) => Promise<void>;
    };
  };
  await act(async () => {
    await params.onSelect(selected, {
      network: NETWORKS[selected.networkId ?? ''],
    });
  });
}

describe('ReceiveToken network switch', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockPushModal.mockReset();
    mockVerifyHWAccountAddresses.mockReset();
    mockShowReceived.mockReset();
    mockReceivePageShown.mockReset();
    mockReceiveSwitchNetwork.mockReset();
    mockToastError.mockReset();
    mockFindAggregateGroup.mockReset();
    mockFindAggregateGroup.mockResolvedValue(undefined);
    mockFetchWalletBanner.mockReset();
    mockFetchWalletBanner.mockResolvedValue([]);
    mockGetVaultSettings.mockReset();
    mockGetVaultSettings.mockResolvedValue({ mergeDeriveAssetsEnabled: false });
    mockAppEventBusOn.mockReset();
    mockGetAccountsByIndexedAccounts.mockReset();
    mockGetAccountsByIndexedAccounts.mockResolvedValue({ accounts: [] });
    mockGetNetworkAccountsWithDeriveTypes.mockReset();
    mockGetNetworkAccountsWithDeriveTypes.mockResolvedValue({
      networkAccounts: [],
    });
  });

  it('shows the trigger only for a switchable entry', async () => {
    mockRouteParams = buildParams('hd');
    const { getByTestId, queryByTestId, unmount } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('receive-card-network-trigger')).not.toBeNull(),
    );
    expect(getByTestId('receive-card-network-eta').textContent).toBe(
      'Ethereum (~1 min)',
    );
    unmount();

    mockRouteParams = buildParams('hd', { switchEntry: undefined });
    const second = render(<ReceiveToken />);
    await waitFor(() =>
      expect(second.getByTestId('receive-card-network-eta')).not.toBeNull(),
    );
    expect(second.queryByTestId('receive-card-network-trigger')).toBeNull();
    second.unmount();

    mockRouteParams = buildParams('hd', {
      aggregateSubTokenList: undefined,
      allAggregateTokenList: undefined,
    });
    const third = render(<ReceiveToken />);
    await waitFor(() =>
      expect(third.getByTestId('receive-card-network-eta')).not.toBeNull(),
    );
    // No members from the route and no group in the config: plain label.
    expect(third.queryByTestId('receive-card-network-trigger')).toBeNull();
    // The token's own flag travels along: only a native coin may fall back
    // to the native group of its network.
    expect(mockFindAggregateGroup).toHaveBeenCalledWith({
      networkId: 'evm--1',
      address: '0xusdt',
      isNative: false,
    });
    expect(queryByTestId('skeleton')).toBeNull();
  });

  it('resolves members from the config when the entry carried none', async () => {
    mockFindAggregateGroup.mockResolvedValue({
      aggregateToken: AGGREGATE_USDT,
      members: [member('evm--1'), member('tron--0x2b6653dc')],
    } as never);
    mockRouteParams = buildParams('hd', {
      aggregateToken: undefined,
      aggregateSubTokenList: undefined,
      allAggregateTokenList: undefined,
    });
    const { getByTestId } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('receive-card-network-trigger')).not.toBeNull(),
    );
    fireEvent.click(getByTestId('receive-card-network-trigger'));
    expect(mockPushModal).toHaveBeenCalledWith('ReceiveModal', {
      screen: 'ReceiveSelectAggregateToken',
      params: expect.objectContaining({
        aggregateToken: AGGREGATE_USDT,
        hideBalanceAndValue: false,
      }),
    });
  });

  it('switches the software wallet page to the selected network address', async () => {
    mockRouteParams = buildParams('hd');
    const { getByTestId } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('address').textContent).toBe('0xaaa'),
    );

    await openSelectorAndSelect(
      getByTestId,
      member('evm--8453', { accountId: 'hd-1--base' }),
    );

    await waitFor(() =>
      expect(getByTestId('address').textContent).toBe('0xbbb'),
    );
    expect(getByTestId('qr-value').textContent).toBe('0xbbb');
    expect(getByTestId('receive-card-network-eta').textContent).toBe(
      'Base (~1 min)',
    );
    expect(getByTestId('receive-page-heading').textContent).toContain(
      '"token":"USDT"',
    );
    expect(mockReceiveSwitchNetwork).toHaveBeenCalledWith(
      expect.objectContaining({
        fromNetworkId: 'evm--1',
        toNetworkId: 'evm--8453',
        listType: 'aggregate',
        createdAddress: false,
        source: 'tokenDetails',
      }),
    );
    // One exposure per resolved network: entry, then the switch.
    expect(mockReceivePageShown).toHaveBeenCalledTimes(2);
    expect(mockReceivePageShown.mock.calls[0][0]).toEqual(
      expect.objectContaining({ networkId: 'evm--1', switched: false }),
    );
    expect(mockReceivePageShown.mock.calls[1][0]).toEqual(
      expect.objectContaining({ networkId: 'evm--8453', switched: true }),
    );
  });

  it('titles a page entered by network after the address, not a token', async () => {
    mockRouteParams = {
      networkId: 'evm--1',
      accountId: 'hd-1--evm1',
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      switchEntry: 'network',
      source: 'network',
    };
    const { getByTestId } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('address').textContent).toBe('0xaaa'),
    );
    expect(getByTestId('receive-page-heading').textContent).toBe(
      'receive_address__title',
    );
  });

  it('drops the previous network banner as soon as the network switches', async () => {
    let resolveBaseBanners: (banners: unknown[]) => void = () => undefined;
    mockFetchWalletBanner.mockImplementation(({ accountId }) =>
      accountId === 'hd-1--base'
        ? new Promise<unknown[]>((resolve) => {
            resolveBaseBanners = resolve;
          })
        : Promise.resolve([
            { id: 'eth', position: 'receive', networkId: 'evm--1', src: '' },
          ]),
    );
    mockRouteParams = buildParams('hd');
    const { getByTestId, queryByTestId } = render(<ReceiveToken />);
    await waitFor(() => expect(getByTestId('receive-banner')).not.toBeNull());

    await openSelectorAndSelect(
      getByTestId,
      member('evm--8453', { accountId: 'hd-1--base' }),
    );

    // The new network is on screen while its banner request is still out:
    // the Ethereum banner must not sit under it.
    await waitFor(() =>
      expect(getByTestId('receive-card-network-eta').textContent).toBe(
        'Base (~1 min)',
      ),
    );
    expect(queryByTestId('receive-banner')).toBeNull();

    await act(async () => {
      resolveBaseBanners([
        { id: 'base', position: 'receive', networkId: 'evm--8453', src: '' },
      ]);
    });
    await waitFor(() => expect(getByTestId('receive-banner')).not.toBeNull());
  });

  it('verifies the new network and derive type on a hardware wallet after a switch', async () => {
    mockVerifyHWAccountAddresses.mockResolvedValue(['0xbbb']);
    mockRouteParams = buildParams('hw');
    const { getByTestId, queryByTestId } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('receive-verify-on-device-button')).not.toBeNull(),
    );
    // Unverified hardware page: no address, no QR.
    expect(queryByTestId('address')).toBeNull();

    await openSelectorAndSelect(
      getByTestId,
      member('evm--8453', { accountId: 'hw-1--base' }),
    );

    // Back to the unverified state for the new network, nothing re-reported.
    await waitFor(() =>
      expect(getByTestId('receive-card-network-eta').textContent).toBe(
        'Base (~1 min)',
      ),
    );
    expect(queryByTestId('address')).toBeNull();
    expect(mockShowReceived).not.toHaveBeenCalled();

    fireEvent.click(getByTestId('receive-verify-on-device-button'));
    await waitFor(() =>
      expect(mockVerifyHWAccountAddresses).toHaveBeenCalledTimes(1),
    );
    expect(mockVerifyHWAccountAddresses).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'hw-1',
        networkId: 'evm--8453',
        deriveType: 'default',
        expectedAddress: '0xbbb',
      }),
    );
    await waitFor(() =>
      expect(getByTestId('address').textContent).toBe('0xbbb'),
    );
    expect(mockShowReceived).toHaveBeenCalledWith(
      expect.objectContaining({ isSuccess: true }),
    );
  });

  it('does not start a verification against the previous network while a switch is resolving', async () => {
    mockVerifyHWAccountAddresses.mockResolvedValue(['0xbbb']);
    mockRouteParams = buildParams('hw');
    const { getByTestId, queryByTestId } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('receive-verify-on-device-button')).not.toBeNull(),
    );

    let finishLookup: (settings: {
      mergeDeriveAssetsEnabled: boolean;
    }) => void = () => undefined;
    mockGetVaultSettings.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLookup = resolve;
        }),
    );
    fireEvent.click(getByTestId('receive-card-network-trigger'));
    const { params } = mockPushModal.mock.calls[
      mockPushModal.mock.calls.length - 1
    ][1] as {
      params: {
        onSelect: (
          token: IAccountToken,
          context?: { network?: unknown },
        ) => Promise<void>;
      };
    };
    let switching: Promise<void> = Promise.resolve();
    act(() => {
      switching = params.onSelect(
        member('evm--8453', { accountId: 'hw-1--base' }),
        { network: NETWORKS['evm--8453'] },
      );
    });

    // The target lookup is still out and the page still shows Ethereum: a
    // press now would verify the address the page is about to leave.
    fireEvent.click(getByTestId('receive-verify-on-device-button'));
    expect(mockVerifyHWAccountAddresses).not.toHaveBeenCalled();

    await act(async () => {
      finishLookup({ mergeDeriveAssetsEnabled: false });
      await switching;
    });
    await waitFor(() =>
      expect(getByTestId('receive-card-network-eta').textContent).toBe(
        'Base (~1 min)',
      ),
    );
    expect(queryByTestId('address')).toBeNull();

    // Once the target is on screen, verification is aimed at it.
    fireEvent.click(getByTestId('receive-verify-on-device-button'));
    await waitFor(() =>
      expect(mockVerifyHWAccountAddresses).toHaveBeenCalledTimes(1),
    );
    expect(mockVerifyHWAccountAddresses).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'evm--8453',
        expectedAddress: '0xbbb',
      }),
    );
  });

  it('keeps the verified page and tells the user when the target lookup fails', async () => {
    mockVerifyHWAccountAddresses.mockResolvedValue(['0xaaa']);
    mockRouteParams = buildParams('hw');
    const { getByTestId } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('receive-verify-on-device-button')).not.toBeNull(),
    );
    fireEvent.click(getByTestId('receive-verify-on-device-button'));
    await waitFor(() =>
      expect(getByTestId('address').textContent).toBe('0xaaa'),
    );

    mockGetVaultSettings.mockRejectedValueOnce(new Error('lookup failed'));
    // The picker closes right after calling back, so the failure has to be
    // handled here rather than surface as an unhandled rejection.
    await openSelectorAndSelect(
      getByTestId,
      member('evm--8453', { accountId: 'hw-1--base' }),
    );
    expect(mockToastError).toHaveBeenCalledWith({
      title: 'global_unknown_error',
    });
    expect(getByTestId('receive-card-network-eta').textContent).toBe(
      'Ethereum (~1 min)',
    );
    // Still the address the device confirmed: no second verification needed.
    expect(getByTestId('address').textContent).toBe('0xaaa');

    // A retry goes through.
    await openSelectorAndSelect(
      getByTestId,
      member('evm--8453', { accountId: 'hw-1--base' }),
    );
    await waitFor(() =>
      expect(getByTestId('receive-card-network-eta').textContent).toBe(
        'Base (~1 min)',
      ),
    );
  });

  it('leaves the page unverified when the shown address changed during a verification', async () => {
    let finishVerify: (addresses: string[]) => void = () => undefined;
    mockVerifyHWAccountAddresses.mockImplementation(
      () =>
        new Promise<string[]>((resolve) => {
          finishVerify = resolve;
        }),
    );
    mockRouteParams = buildParams('hw');
    const { getByTestId, queryByTestId, rerender } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('receive-verify-on-device-button')).not.toBeNull(),
    );
    fireEvent.click(getByTestId('receive-verify-on-device-button'));
    await waitFor(() =>
      expect(mockVerifyHWAccountAddresses).toHaveBeenCalledTimes(1),
    );

    // The account behind the page is replaced while the device is asked.
    const original = ACCOUNTS['hw-1--evm1'];
    ACCOUNTS['hw-1--evm1'] = { ...original, address: '0xccc' };
    try {
      rerender(<ReceiveToken />);
      // The device confirms the address the attempt started with.
      await act(async () => {
        finishVerify(['0xaaa']);
      });
      await waitFor(() =>
        expect(getByTestId('receive-verify-on-device-button')).not.toBeNull(),
      );
      // 0xccc was never confirmed on the device, so it stays hidden.
      expect(queryByTestId('address')).toBeNull();
      expect(queryByTestId('qr-value')).toBeNull();
    } finally {
      ACCOUNTS['hw-1--evm1'] = original;
    }
  });

  describe('to a network with several address types', () => {
    const SEGWIT = {
      id: 'hd-1--btc-segwit',
      address: 'bc1qsegwit',
      template: "m/84'/0'/$$INDEX$$'/0/0",
      indexedAccountId: 'hd-1--0',
      addressDetail: { receiveAddressPath: "m/84'/0'/0'/0/0" },
    };
    const OTHER_TYPES = {
      networkAccounts: [
        {
          deriveType: 'BIP44',
          deriveInfo: { label: 'Legacy' },
          account: {
            id: 'hd-1--btc-legacy',
            address: '1legacy',
            indexedAccountId: 'hd-1--0',
            addressDetail: { receiveAddressPath: "m/44'/0'/0'/0/0" },
          },
        },
        {
          deriveType: 'BIP86',
          deriveInfo: { label: 'Taproot' },
          account: {
            id: 'hd-1--btc-taproot',
            address: 'bc1ptaproot',
            indexedAccountId: 'hd-1--0',
            addressDetail: { receiveAddressPath: "m/86'/0'/0'/0/0" },
          },
        },
      ],
    };

    async function switchToBitcoinFromTaprootRow() {
      mockGetVaultSettings.mockImplementation(async (params) => ({
        mergeDeriveAssetsEnabled:
          (params as { networkId: string }).networkId === 'btc--0',
      }));
      mockRouteParams = buildParams('hd', {
        allAggregateTokenList: [member('evm--1'), member('btc--0')],
      });
      const utils = render(<ReceiveToken />);
      await waitFor(() =>
        expect(utils.getByTestId('address').textContent).toBe('0xaaa'),
      );
      await openSelectorAndSelect(
        utils.getByTestId,
        member('btc--0', { accountId: 'hd-1--btc-taproot' }),
      );
      return utils;
    }

    it('starts from the default address type when the wallet has one', async () => {
      mockGetAccountsByIndexedAccounts.mockResolvedValue({
        accounts: [SEGWIT],
      });
      mockGetNetworkAccountsWithDeriveTypes.mockResolvedValue(OTHER_TYPES);
      const { getByTestId } = await switchToBitcoinFromTaprootRow();
      await waitFor(() =>
        expect(getByTestId('address').textContent).toBe('bc1qsegwit'),
      );
      expect(mockGetAccountsByIndexedAccounts).toHaveBeenCalledWith({
        indexedAccountIds: ['hd-1--0'],
        networkId: 'btc--0',
        deriveType: 'default',
      });
      expect(mockGetNetworkAccountsWithDeriveTypes).not.toHaveBeenCalled();
    });

    it('drops an address refresh of the previous network that lands after a switch', async () => {
      mockGetAccountsByIndexedAccounts.mockResolvedValue({
        accounts: [SEGWIT],
      });
      const { getByTestId } = await switchToBitcoinFromTaprootRow();
      await waitFor(() =>
        expect(getByTestId('address').textContent).toBe('bc1qsegwit'),
      );

      // A switch to Base starts; its target lookup stays out.
      let finishTargetLookup: (settings: {
        mergeDeriveAssetsEnabled: boolean;
      }) => void = () => undefined;
      mockGetVaultSettings.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishTargetLookup = resolve;
          }),
      );
      fireEvent.click(getByTestId('receive-card-network-trigger'));
      const { params } = mockPushModal.mock.calls[
        mockPushModal.mock.calls.length - 1
      ][1] as {
        params: {
          onSelect: (
            token: IAccountToken,
            context?: { network?: unknown },
          ) => Promise<void>;
        };
      };
      let switching: Promise<void> = Promise.resolve();
      act(() => {
        switching = params.onSelect(
          member('evm--8453', { accountId: 'hd-1--base' }),
          { network: NETWORKS['evm--8453'] },
        );
      });

      // Meanwhile the Bitcoin page is told its fresh address changed and
      // looks its account up again; that lookup stays out too.
      let finishBitcoinLookup: (result: { accounts: unknown[] }) => void = () =>
        undefined;
      mockGetAccountsByIndexedAccounts.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishBitcoinLookup = resolve;
          }),
      );
      const refreshCalls = mockAppEventBusOn.mock.calls.filter(
        ([name]) => name === 'BtcFreshAddressUpdated',
      );
      const refreshBitcoinAddress = refreshCalls[refreshCalls.length - 1][1];
      await act(async () => {
        refreshBitcoinAddress();
      });

      await act(async () => {
        finishTargetLookup({ mergeDeriveAssetsEnabled: false });
        await switching;
      });
      await waitFor(() =>
        expect(getByTestId('address').textContent).toBe('0xbbb'),
      );

      // The Bitcoin lookup lands once Base is on screen.
      await act(async () => {
        finishBitcoinLookup({ accounts: [SEGWIT] });
      });
      expect(getByTestId('receive-card-network-eta').textContent).toBe(
        'Base (~1 min)',
      );
      expect(getByTestId('address').textContent).toBe('0xbbb');
      expect(getByTestId('qr-value').textContent).toBe('0xbbb');
    });

    it.each([
      [
        'comes back empty',
        () =>
          mockGetAccountsByIndexedAccounts.mockResolvedValue({ accounts: [] }),
      ],
      [
        'throws',
        () =>
          mockGetAccountsByIndexedAccounts.mockRejectedValue(
            new Error('account not found'),
          ),
      ],
    ])(
      'shows the address of the selected row when the default type lookup %s',
      async (_label, arrangeDefaultLookup) => {
        arrangeDefaultLookup();
        mockGetNetworkAccountsWithDeriveTypes.mockResolvedValue(OTHER_TYPES);
        const { getByTestId, queryByTestId } =
          await switchToBitcoinFromTaprootRow();
        // The row showed the Taproot address: that one, not just the first
        // address type the wallet happens to have.
        await waitFor(() =>
          expect(getByTestId('address').textContent).toBe('bc1ptaproot'),
        );
        expect(queryByTestId('receive-switch-placeholder')).toBeNull();
        expect(mockToastError).not.toHaveBeenCalled();
      },
    );
  });

  it('keeps the placeholder with a tappable header when the account cannot be resolved', async () => {
    mockRouteParams = buildParams('hd');
    const { getByTestId, queryByTestId } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('address').textContent).toBe('0xaaa'),
    );

    // The selected row carries an account the data layer cannot find.
    await openSelectorAndSelect(
      getByTestId,
      member('tron--0x2b6653dc', { accountId: 'hd-1--missing' }),
    );

    await waitFor(() =>
      expect(getByTestId('receive-switch-placeholder')).not.toBeNull(),
    );
    expect(queryByTestId('address')).toBeNull();
    expect(queryByTestId('qr-value')).toBeNull();
    expect(getByTestId('receive-card-network-eta').textContent).toBe(
      'Tron (~1 min)',
    );
    expect(getByTestId('receive-card-network-trigger')).not.toBeNull();
  });

  it('ignores selecting the current network and rows from another wallet', async () => {
    mockRouteParams = buildParams('hd');
    const { getByTestId } = render(<ReceiveToken />);
    await waitFor(() =>
      expect(getByTestId('address').textContent).toBe('0xaaa'),
    );

    await openSelectorAndSelect(
      getByTestId,
      member('evm--1', { accountId: 'hd-1--evm1' }),
    );
    expect(getByTestId('address').textContent).toBe('0xaaa');
    expect(mockReceiveSwitchNetwork).not.toHaveBeenCalled();

    await openSelectorAndSelect(
      getByTestId,
      member('evm--8453', { accountId: 'hd-2--base' }),
    );
    expect(getByTestId('address').textContent).toBe('0xaaa');
    expect(getByTestId('receive-card-network-eta').textContent).toBe(
      'Ethereum (~1 min)',
    );
  });
});
