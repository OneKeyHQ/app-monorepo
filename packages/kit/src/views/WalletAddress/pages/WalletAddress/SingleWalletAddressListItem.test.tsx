/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { SingleWalletAddressListItem } from '.';

import { render } from '@testing-library/react';

import type { IServerNetwork } from '@onekeyhq/shared/types';

import { WalletAddressContext } from './WalletAddressContext';

import type { IWalletAddressContext } from './WalletAddressContext';

// One entry per ListItem render; used to compare render-prop identity across
// re-renders.
let capturedRenderItemTexts: unknown[] = [];

// Identity-stable hook results: several of these values sit in the dependency
// arrays feeding the renderItemText useCallback (directly or via onPress and
// subtitle), so a fresh object per render would defeat the identity assertions
// below without exercising the memoization under test.
const mockIntl = { formatMessage: () => '' };
const mockNavigation = { pushModal: jest.fn(), pop: jest.fn() };
const mockCreateAddressResult = { createAddress: jest.fn() };
const mockBotWalletStatus = {
  isBotWallet: false,
  isBotWalletDeactivated: false,
};
const mockCopyAccountAddress = jest.fn();
const mockFuseSearch = jest.fn(() => []);
const mockAllNetworksPersistState = {
  showEnabledNetworksOnlyInCopyAddressPanel: false,
};

jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    children ?? null;
  return {
    Empty: () => null,
    Icon: () => null,
    Page: Passthrough,
    SearchBar: () => null,
    SectionList: () => null,
    SizableText: () => null,
    Spinner: () => null,
    Stack: Passthrough,
    Toast: { success: jest.fn(), error: jest.fn() },
    XStack: Passthrough,
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children ?? null,
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress',
  () => ({
    useAccountSelectorCreateAddress: () => mockCreateAddressResult,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector',
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const ListItemMock = ({ renderItemText }: { renderItemText?: unknown }) => {
    capturedRenderItemTexts.push(renderItemText);
    return null;
  };
  ListItemMock.Text = () => null;
  return { ListItem: ListItemMock };
});

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatarBase: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));

jest.mock('@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus', () => ({
  useBotWalletDeactivatedStatus: () => mockBotWalletStatus,
}));

jest.mock('@onekeyhq/kit/src/hooks/useCopyAccountAddress', () => ({
  useCopyAccountAddress: () => mockCopyAccountAddress,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: undefined,
    isLoading: false,
    run: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/utils/botWalletDisabledToast', () => ({
  showBotWalletDisabledToast: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openExplorerAddressUrl: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/views/ChainSelector/hooks/useFuseSearch', () => ({
  useFuseSearch: () => mockFuseSearch,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAllNetworksPersistAtom: () => [mockAllNetworksPersistState],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersWallet: () => false,
    shortenAddress: ({ address }: { address?: string }) => address ?? '',
  },
}));

jest.mock('@onekeyhq/shared/src/utils/debug/debugUtils', () => ({
  __esModule: true,
  default: {
    createSimpleDebugLog: () => () => {},
  },
  useDebugHooksDepsChangedChecker: () => ({ checkDeps: () => {} }),
}));

jest.mock('@onekeyhq/shared/src/utils/debug/perfUtils', () => ({
  __esModule: true,
  default: {
    createPerf: () => ({
      markStart: () => {},
      markEnd: () => {},
      done: () => {},
    }),
  },
  EPerformanceTimerLogNames: {},
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isLightningNetworkByNetworkId: () => false,
    getDefaultDeriveTypeVisibleNetworks: () => [],
    isViewInExplorerDisabled: () => false,
  },
  isEnabledNetworksInAllNetworks: () => true,
}));

const network = {
  id: 'evm--1',
  name: 'Ethereum',
  logoURI: '',
  isCustomNetwork: false,
  isAllNetworks: false,
} as unknown as IServerNetwork;

// Values referenced by hook dependencies must keep their identity across
// renders, exactly like the real (state-backed) context value does.
const networkAccountMap: IWalletAddressContext['networkAccountMap'] = {};
const refreshLocalData = jest.fn(async () => {});
const setAccountsCreated = jest.fn();
const setIsAllNetworksEnabled = jest.fn();
const originalAllNetworksState = {
  enabledNetworks: {},
  disabledNetworks: {},
};

function buildContextValue(
  overrides: Partial<IWalletAddressContext> = {},
): IWalletAddressContext {
  return {
    title: '',
    networkAccountMap,
    accountId: '',
    walletId: 'hd-1',
    indexedAccountId: 'hd-1--0',
    refreshLocalData,
    accountsCreated: false,
    setAccountsCreated,
    originalAllNetworksState,
    isAllNetworksEnabled: {},
    setIsAllNetworksEnabled,
    allNetworksStateInit: { current: true },
    originalAllNetworksStateInit: { current: true },
    actionType: undefined,
    othersWalletAddress: undefined,
    ...overrides,
  };
}

function renderItem(contextValue: IWalletAddressContext) {
  return (
    <WalletAddressContext.Provider value={contextValue}>
      <SingleWalletAddressListItem network={network} />
    </WalletAddressContext.Provider>
  );
}

describe('SingleWalletAddressListItem render prop stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedRenderItemTexts = [];
  });

  it('keeps the renderItemText identity stable across an unrelated context change', () => {
    // ListItem renders renderItemText as a component type
    // (`<Render {...props} />`), so a new function identity per render means
    // React unmounts and remounts the whole text subtree instead of updating
    // it in place. Toggling isAllNetworksEnabled only recolors the subtitle;
    // the render prop must keep its identity across that re-render. Reverting
    // the useCallback to an inline arrow would fail this test.
    const view = render(renderItem(buildContextValue()));
    view.rerender(
      renderItem(
        buildContextValue({
          isAllNetworksEnabled: { [network.id]: true },
        }),
      ),
    );

    expect(capturedRenderItemTexts.length).toBeGreaterThanOrEqual(2);
    expect(typeof capturedRenderItemTexts[0]).toBe('function');
    expect(capturedRenderItemTexts[1]).toBe(capturedRenderItemTexts[0]);
  });
});
