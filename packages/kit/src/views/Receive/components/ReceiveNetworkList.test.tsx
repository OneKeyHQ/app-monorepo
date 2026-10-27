/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import type { IServerNetwork } from '@onekeyhq/shared/types';

import {
  ReceiveNetworkList,
  buildReceiveNetworkSecondaryTab,
} from './ReceiveNetworkList';

import type { IntlShape } from 'react-intl';

const NETWORKS: Record<string, IServerNetwork> = {
  'evm--1': { id: 'evm--1', name: 'Ethereum', logoURI: '' } as IServerNetwork,
  'tron--0x2b6653dc': {
    id: 'tron--0x2b6653dc',
    name: 'Tron',
    logoURI: '',
  } as IServerNetwork,
  'aptos--1': { id: 'aptos--1', name: 'Aptos', logoURI: '' } as IServerNetwork,
  'lightning--0': {
    id: 'lightning--0',
    name: 'Lightning',
    logoURI: '',
  } as IServerNetwork,
};

let mockAccountsInfo: Array<{
  networkId: string;
  accountId: string;
  apiAddress: string;
  dbAccount: object | undefined;
  deriveType?: string;
}> = [];
const mockGetGlobalDeriveType = jest.fn<Promise<string>, [unknown]>();
const mockCreateAddressForNetwork = jest.fn<
  Promise<string | undefined>,
  [unknown]
>();
const mockEnableNetwork = jest.fn<Promise<void>, [string]>();
const mockGetAllNetworkAccounts = jest.fn<
  Promise<{ accountsInfo: typeof mockAccountsInfo }>,
  [unknown]
>();
const mockToastSuccess = jest.fn<void, [unknown]>();
// Loaders of the lists that asked to be revalidated when their page regains
// focus; `refocusPage` runs them the way the real hook would.
const mockFocusRuns = new Set<() => Promise<void>>();
const mockReceiveSelectNetworkTab = jest.fn<void, [unknown]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  const SectionList = ({
    sections,
    renderItem,
    renderSectionHeader,
    ListEmptyComponent,
    testID,
  }: {
    sections: Array<{ title?: string; data: IServerNetwork[] }>;
    renderItem: (info: { item: IServerNetwork }) => ReactNode;
    renderSectionHeader: (info: { section: { title?: string } }) => ReactNode;
    ListEmptyComponent?: ReactNode;
    testID?: string;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': testID },
      sections.length === 0 ? ListEmptyComponent : null,
      sections.map((section, index) =>
        React.createElement(
          'div',
          { key: String(index), 'data-testid': 'section' },
          renderSectionHeader({ section }),
          section.data.map((item) =>
            React.createElement(
              React.Fragment,
              { key: item.id },
              renderItem({ item }),
            ),
          ),
        ),
      ),
    );
  SectionList.SectionHeader = ({ title }: { title: string }) =>
    React.createElement('span', { 'data-testid': 'section-title' }, title);
  return {
    Icon: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-testid': `icon-${name}` }),
    SectionList,
    Spinner: () => React.createElement('span', { 'data-testid': 'spinner' }),
    Stack: Box,
    Toast: {
      success: (params: unknown) => mockToastSuccess(params),
      error: jest.fn(),
    },
  };
});

jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'onekeyall--0' }),
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { AccountDataUpdate: 'AccountDataUpdate' },
  appEventBus: { emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      receive: {
        receiveSelectNetworkTab: (params: unknown) =>
          mockReceiveSelectNetworkTab(params),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target, key: string) => key }),
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isOthersWallet: ({ walletId }: { walletId: string }) =>
      walletId.startsWith('imported-'),
    shortenAddress: ({ address }: { address: string }) =>
      `${address.slice(0, 4)}…${address.slice(-3)}`,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'onekeyall--0',
    isLightningNetworkByNetworkId: (networkId?: string) =>
      networkId === 'lightning--0',
    getNetworkImpl: ({ networkId }: { networkId: string }) =>
      networkId.split('--')[0],
  },
  POPULAR_NETWORK_IDS: jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/networkUtils')
  >('@onekeyhq/shared/src/utils/networkUtils').POPULAR_NETWORK_IDS,
  buildPopularFirstNetworkSections: jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/networkUtils')
  >('@onekeyhq/shared/src/utils/networkUtils').buildPopularFirstNetworkSections,
  isEnabledNetworksInAllNetworks: ({
    networkId,
    disabledNetworks,
  }: {
    networkId: string;
    disabledNetworks: Record<string, boolean>;
  }) => !disabledNetworks[networkId],
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getChainSelectorNetworksCompatibleWithAccountId: jest.fn(async () => ({
        mainnetItems: Object.values(NETWORKS),
      })),
      getGlobalDeriveTypeOfNetwork: (params: unknown) =>
        mockGetGlobalDeriveType(params),
    },
    serviceAllNetwork: {
      getAllNetworkAccounts: (params: unknown) =>
        mockGetAllNetworkAccounts(params),
      getAllNetworksState: jest.fn(async () => ({
        disabledNetworks: { 'tron--0x2b6653dc': true },
        enabledNetworks: {},
      })),
    },
  },
}));

jest.mock(
  '../../../components/AccountSelector/hooks/useCreateAddressForNetwork',
  () => ({
    useCreateAddressForNetwork: () => ({
      createAddressForNetwork: (params: unknown) =>
        mockCreateAddressForNetwork(params),
      enableNetwork: (networkId: string) => mockEnableNetwork(networkId),
    }),
  }),
);

jest.mock('../../../components/Empty', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    EmptyToken: ({ title }: { title: string }) =>
      React.createElement('span', { 'data-testid': 'empty' }, title),
  };
});

jest.mock('../../../components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ListItem: ({
      title,
      subtitle,
      children,
      onPress,
      drillIn,
      testID,
      disabled,
    }: {
      title?: ReactNode;
      subtitle?: ReactNode;
      children?: ReactNode;
      onPress?: () => void;
      drillIn?: boolean;
      testID?: string;
      disabled?: boolean;
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': testID,
          'data-drillin': drillIn ? '1' : '0',
          onClick: disabled ? undefined : onPress,
        },
        React.createElement('span', { 'data-testid': 'title' }, title),
        subtitle
          ? React.createElement('span', { 'data-testid': 'subtitle' }, subtitle)
          : null,
        children,
      ),
  };
});

jest.mock('../../../components/Loading', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ListLoading: () =>
      React.createElement('span', { 'data-testid': 'list-loading' }),
  };
});

jest.mock('../../../components/NetworkAvatar', () => ({
  NetworkAvatarBase: () => null,
}));

jest.mock('../../../hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (
      fn: () => Promise<unknown>,
      deps: unknown[],
      options?: { initResult?: unknown; revalidateOnFocus?: boolean },
    ) => {
      const [result, setResult] = React.useState<unknown>(options?.initResult);
      const [isLoading, setIsLoading] = React.useState<boolean | undefined>();
      const run = React.useCallback(async () => {
        setIsLoading(true);
        const value = await fn();
        setResult(value);
        setIsLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      React.useEffect(() => {
        void run();
      }, [run]);
      const revalidateOnFocus = !!options?.revalidateOnFocus;
      React.useEffect(() => {
        if (!revalidateOnFocus) {
          return undefined;
        }
        mockFocusRuns.add(run);
        return () => {
          mockFocusRuns.delete(run);
        };
      }, [run, revalidateOnFocus]);
      return { result, isLoading, run };
    },
  };
});

jest.mock('../../ChainSelector/hooks/useFuseSearch', () => ({
  useFuseSearch: (networks: IServerNetwork[]) => (keyword: string) =>
    networks.filter((n) =>
      n.name.toLowerCase().includes(keyword.toLowerCase()),
    ),
}));

async function refocusPage() {
  await act(async () => {
    await Promise.all(
      Array.from(mockFocusRuns, (run) => run().catch(() => undefined)),
    );
  });
}

function renderList(
  overrides: Partial<Parameters<typeof ReceiveNetworkList>[0]> = {},
) {
  const onSelectNetwork = jest.fn();
  const onSelectLightning = jest.fn();
  const utils = render(
    <ReceiveNetworkList
      testID="list"
      mode="tab"
      walletId="hd-1"
      indexedAccountId="hd-1--0"
      accountId="hd-1--all"
      walletType="hd"
      searchText=""
      onSelectNetwork={onSelectNetwork}
      onSelectLightning={onSelectLightning}
      {...overrides}
    />,
  );
  return { ...utils, onSelectNetwork, onSelectLightning };
}

describe('ReceiveNetworkList', () => {
  beforeEach(() => {
    mockAccountsInfo = [
      {
        networkId: 'evm--1',
        accountId: 'hd-1--evm',
        apiAddress: '0x1234567890abcdef',
        dbAccount: {},
      },
      {
        networkId: 'tron--0x2b6653dc',
        accountId: 'hd-1--tron',
        apiAddress: 'TRX1234567890',
        dbAccount: {},
      },
      {
        networkId: 'lightning--0',
        accountId: 'hd-1--ln',
        apiAddress: 'ln',
        dbAccount: {},
      },
    ];
    mockCreateAddressForNetwork.mockReset();
    mockEnableNetwork.mockReset();
    mockGetAllNetworkAccounts.mockReset();
    mockGetAllNetworkAccounts.mockImplementation(async () => ({
      accountsInfo: mockAccountsInfo,
    }));
    mockGetGlobalDeriveType.mockReset();
    mockGetGlobalDeriveType.mockResolvedValue('default');
    mockToastSuccess.mockReset();
    mockReceiveSelectNetworkTab.mockReset();
  });

  it('lists the popular block first, then letter groups, with addresses and create rows', async () => {
    const { getAllByTestId, getByTestId } = renderList();
    await waitFor(() =>
      expect(getByTestId('receive-network-list-item-aptos--1')).not.toBeNull(),
    );
    await waitFor(() =>
      expect(
        getByTestId('receive-network-list-item-evm--1').querySelector(
          '[data-testid="subtitle"]',
        )?.textContent,
      ).toBe('0x12…def'),
    );
    expect(getAllByTestId('section-title').map((n) => n.textContent)).toEqual([
      'global_popular',
      'A',
      'L',
    ]);
    const titles = getAllByTestId('title').map((n) => n.textContent);
    expect(titles).toEqual(['Tron', 'Ethereum', 'Aptos', 'Lightning']);
    const aptos = getByTestId('receive-network-list-item-aptos--1');
    expect(aptos.querySelector('[data-testid="subtitle"]')?.textContent).toBe(
      'global_create_address',
    );
    expect(
      aptos.querySelector('[data-testid="icon-PlusLargeOutline"]'),
    ).not.toBeNull();
    // No drill-in chevron on any row.
    expect(aptos.getAttribute('data-drillin')).toBe('0');
    expect(
      getByTestId('receive-network-list-item-evm--1').getAttribute(
        'data-drillin',
      ),
    ).toBe('0');
    // Lightning rows never show an address.
    expect(
      getByTestId('receive-network-list-item-lightning--0').querySelector(
        '[data-testid="subtitle"]',
      ),
    ).toBeNull();
  });

  it('shows one loading frame, then rows that already carry their address', async () => {
    const { getByTestId, queryByTestId, queryAllByTestId } = renderList();
    // Loading: the placeholder frame under the first section title, no rows.
    expect(getByTestId('list-loading')).not.toBeNull();
    expect(getByTestId('section-title').textContent).toBe('global_popular');
    expect(queryAllByTestId('title')).toEqual([]);

    await waitFor(() =>
      expect(getByTestId('receive-network-list-item-evm--1')).not.toBeNull(),
    );
    // Rows never appear without their second line: no later height change.
    expect(
      getByTestId('receive-network-list-item-evm--1').querySelector(
        '[data-testid="subtitle"]',
      )?.textContent,
    ).toBe('0x12…def');
    expect(queryByTestId('list-loading')).toBeNull();
  });

  it('paints complete on the first frame when the data was requested ahead', async () => {
    const tab = buildReceiveNetworkSecondaryTab({
      intl: {
        formatMessage: ({ id }: { id: string }) => id,
      } as unknown as IntlShape,
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      accountId: 'hd-1--all',
      walletType: 'hd',
      onSelectNetwork: jest.fn(),
      onSelectLightning: jest.fn(),
    });
    // The page is open on the token segment while the request lands.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    const { getByTestId, queryByTestId } = render(
      <>
        {tab.renderContent('', {
          onScroll: jest.fn(),
          scrollEventThrottle: 16,
          contentContainerStyle: { pt: 0 },
        })}
      </>,
    );
    expect(queryByTestId('list-loading')).toBeNull();
    expect(
      getByTestId('receive-network-list-item-evm--1').querySelector(
        '[data-testid="subtitle"]',
      )?.textContent,
    ).toBe('0x12…def');
    // The list still revalidates after mounting; let that settle.
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
    expect(
      getByTestId('receive-network-list-item-evm--1').querySelector(
        '[data-testid="subtitle"]',
      )?.textContent,
    ).toBe('0x12…def');
  });

  it('reports an existing address and enables a switched-off network on the way', async () => {
    const { getByTestId, onSelectNetwork } = renderList();
    await waitFor(() =>
      expect(
        getByTestId('receive-network-list-item-tron--0x2b6653dc').querySelector(
          '[data-testid="subtitle"]',
        ),
      ).not.toBeNull(),
    );
    fireEvent.click(getByTestId('receive-network-list-item-tron--0x2b6653dc'));
    await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));
    expect(onSelectNetwork).toHaveBeenCalledWith({
      network: NETWORKS['tron--0x2b6653dc'],
      accountId: 'hd-1--tron',
      createdAddress: false,
    });
    expect(mockReceiveSelectNetworkTab).toHaveBeenCalledWith({
      networkId: 'tron--0x2b6653dc',
      section: 'popular',
      action: 'open',
      hasAddress: true,
      isSearchMode: false,
      walletType: 'hd',
    });
    expect(mockEnableNetwork).toHaveBeenCalledWith('tron--0x2b6653dc');
    expect(mockToastSuccess).toHaveBeenCalledWith({
      title: 'network_also_enabled',
    });

    fireEvent.click(getByTestId('receive-network-list-item-evm--1'));
    await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(2));
    // Already enabled: no extra state write.
    expect(mockEnableNetwork).toHaveBeenCalledTimes(1);
  });

  it('creates the address in the given scope before reporting a network without one', async () => {
    mockCreateAddressForNetwork.mockResolvedValue('hd-1--aptos');
    const { getByTestId, onSelectNetwork } = renderList();
    await waitFor(() =>
      expect(
        getByTestId('receive-network-list-item-aptos--1').querySelector(
          '[data-testid="subtitle"]',
        )?.textContent,
      ).toBe('global_create_address'),
    );
    fireEvent.click(getByTestId('receive-network-list-item-aptos--1'));
    await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));
    expect(mockCreateAddressForNetwork).toHaveBeenCalledWith({
      walletId: 'hd-1',
      indexedAccountId: 'hd-1--0',
      networkId: 'aptos--1',
      isNetworkEnabled: true,
    });
    expect(onSelectNetwork).toHaveBeenCalledWith({
      network: NETWORKS['aptos--1'],
      accountId: 'hd-1--aptos',
      createdAddress: true,
    });
    expect(mockReceiveSelectNetworkTab).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'aptos--1',
        section: 'alpha',
        action: 'create',
        hasAddress: false,
      }),
    );
  });

  it('still reports the new address when the list fails to reload after creating it', async () => {
    mockCreateAddressForNetwork.mockResolvedValue('hd-1--aptos');
    const { getByTestId, onSelectNetwork } = renderList();
    await waitFor(() =>
      expect(
        getByTestId('receive-network-list-item-aptos--1').querySelector(
          '[data-testid="subtitle"]',
        )?.textContent,
      ).toBe('global_create_address'),
    );
    mockGetAllNetworkAccounts.mockRejectedValueOnce(new Error('reload failed'));
    fireEvent.click(getByTestId('receive-network-list-item-aptos--1'));
    await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));
    expect(onSelectNetwork).toHaveBeenCalledWith({
      network: NETWORKS['aptos--1'],
      accountId: 'hd-1--aptos',
      createdAddress: true,
    });
  });

  it('reloads past the accounts cache on the next focus when the reload after creating failed', async () => {
    mockCreateAddressForNetwork.mockResolvedValue('hd-1--aptos');
    const { getByTestId, onSelectNetwork } = renderList();
    const aptosSubtitle = () =>
      getByTestId('receive-network-list-item-aptos--1').querySelector(
        '[data-testid="subtitle"]',
      )?.textContent;
    await waitFor(() => expect(aptosSubtitle()).toBe('global_create_address'));
    mockGetAllNetworkAccounts.mockRejectedValueOnce(new Error('reload failed'));
    fireEvent.click(getByTestId('receive-network-list-item-aptos--1'));
    await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));
    // The list could not refresh, so the row is still on its old data.
    expect(aptosSubtitle()).toBe('global_create_address');

    mockAccountsInfo = [
      ...mockAccountsInfo,
      {
        networkId: 'aptos--1',
        accountId: 'hd-1--aptos',
        apiAddress: '0xabcdef1234567890',
        dbAccount: {},
      },
    ];
    await refocusPage();
    await waitFor(() => expect(aptosSubtitle()).toBe('0xab…890'));
    expect(mockGetAllNetworkAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ skipCache: true }),
    );

    // The owed reload has landed: later reloads use the cache again.
    await refocusPage();
    expect(mockGetAllNetworkAccounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ skipCache: false }),
    );
  });

  describe('a network with addresses of several types', () => {
    const ethereumSubtitle = (
      getByTestId: ReturnType<typeof render>['getByTestId'],
    ) =>
      getByTestId('receive-network-list-item-evm--1').querySelector(
        '[data-testid="subtitle"]',
      )?.textContent;

    beforeEach(() => {
      // Database order puts the non-default type first.
      mockAccountsInfo = [
        {
          networkId: 'evm--1',
          accountId: 'hd-1--evm-ledger-live',
          apiAddress: '0xaaaa000000000bbb',
          dbAccount: {},
          deriveType: 'ledgerLive',
        },
        {
          networkId: 'evm--1',
          accountId: 'hd-1--evm',
          apiAddress: '0x1234567890abcdef',
          dbAccount: {},
          deriveType: 'default',
        },
      ];
    });

    it('shows and reports the default type whatever order the accounts come in', async () => {
      const { getByTestId, onSelectNetwork } = renderList();
      await waitFor(() =>
        expect(ethereumSubtitle(getByTestId)).toBe('0x12…def'),
      );
      fireEvent.click(getByTestId('receive-network-list-item-evm--1'));
      await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));
      expect(onSelectNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'hd-1--evm' }),
      );
    });

    it('follows the global default when the user changed it', async () => {
      mockGetGlobalDeriveType.mockResolvedValue('ledgerLive');
      const { getByTestId, onSelectNetwork } = renderList();
      await waitFor(() =>
        expect(ethereumSubtitle(getByTestId)).toBe('0xaa…bbb'),
      );
      fireEvent.click(getByTestId('receive-network-list-item-evm--1'));
      await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));
      expect(onSelectNetwork).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'hd-1--evm-ledger-live' }),
      );
    });

    it('falls back to an address of another type when the wallet has none of the default one', async () => {
      mockGetGlobalDeriveType.mockResolvedValue('bip44Standard');
      const { getByTestId } = renderList();
      // Still an address, not "Create address".
      await waitFor(() =>
        expect(ethereumSubtitle(getByTestId)).toBe('0xaa…bbb'),
      );
    });

    it('still lists the network when the default type cannot be read', async () => {
      mockGetGlobalDeriveType.mockRejectedValue(new Error('unavailable'));
      const { getByTestId } = renderList();
      await waitFor(() =>
        expect(ethereumSubtitle(getByTestId)).toBe('0xaa…bbb'),
      );
    });
  });

  describe('a row still creating its address', () => {
    async function renderWithAptosToCreate() {
      const utils = renderList();
      await waitFor(() =>
        expect(
          utils
            .getByTestId('receive-network-list-item-aptos--1')
            .querySelector('[data-testid="subtitle"]')?.textContent,
        ).toBe('global_create_address'),
      );
      return utils;
    }
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

    it('does not report once another row was picked while it was creating', async () => {
      let finishCreating: (accountId: string) => void = () => undefined;
      mockCreateAddressForNetwork.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishCreating = resolve;
          }),
      );
      const { getByTestId, onSelectNetwork } = await renderWithAptosToCreate();
      fireEvent.click(getByTestId('receive-network-list-item-aptos--1'));
      fireEvent.click(getByTestId('receive-network-list-item-evm--1'));
      await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));
      expect(onSelectNetwork).toHaveBeenLastCalledWith(
        expect.objectContaining({ accountId: 'hd-1--evm' }),
      );

      await act(async () => {
        finishCreating('hd-1--aptos');
      });
      await settle();
      // Ethereum was the last pick: Aptos must not take over afterwards.
      expect(onSelectNetwork).toHaveBeenCalledTimes(1);
    });

    it('does not report once another row was picked while the list was reloading', async () => {
      mockCreateAddressForNetwork.mockResolvedValue('hd-1--aptos');
      const { getByTestId, onSelectNetwork } = await renderWithAptosToCreate();
      let finishReload: () => void = () => undefined;
      mockGetAllNetworkAccounts.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishReload = () => resolve({ accountsInfo: mockAccountsInfo });
          }),
      );
      fireEvent.click(getByTestId('receive-network-list-item-aptos--1'));
      // The address exists; the row is now waiting for the list to reload.
      await waitFor(() =>
        expect(mockGetAllNetworkAccounts).toHaveBeenLastCalledWith(
          expect.objectContaining({ skipCache: true }),
        ),
      );
      fireEvent.click(getByTestId('receive-network-list-item-evm--1'));
      await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));

      await act(async () => {
        finishReload();
      });
      await settle();
      expect(onSelectNetwork).toHaveBeenCalledTimes(1);
      expect(onSelectNetwork).toHaveBeenLastCalledWith(
        expect.objectContaining({ accountId: 'hd-1--evm' }),
      );
    });

    it('does not report after the list is gone', async () => {
      let finishCreating: (accountId: string) => void = () => undefined;
      mockCreateAddressForNetwork.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishCreating = resolve;
          }),
      );
      const { getByTestId, onSelectNetwork, unmount } =
        await renderWithAptosToCreate();
      fireEvent.click(getByTestId('receive-network-list-item-aptos--1'));
      unmount();
      await act(async () => {
        finishCreating('hd-1--aptos');
      });
      await settle();
      expect(onSelectNetwork).not.toHaveBeenCalled();
    });
  });

  it('runs one selection at a time when a row is tapped again mid-flight', async () => {
    let finishEnabling: () => void = () => undefined;
    mockEnableNetwork.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishEnabling = resolve;
        }),
    );
    const { getByTestId, onSelectNetwork } = renderList();
    await waitFor(() =>
      expect(
        getByTestId('receive-network-list-item-tron--0x2b6653dc').querySelector(
          '[data-testid="subtitle"]',
        ),
      ).not.toBeNull(),
    );
    const row = getByTestId('receive-network-list-item-tron--0x2b6653dc');
    fireEvent.click(row);
    fireEvent.click(row);
    await act(async () => {
      finishEnabling();
    });
    await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(1));
    expect(mockEnableNetwork).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);

    // The guard is released once the run settles: the same row works again
    // (the network is enabled by now, so nothing is written a second time).
    fireEvent.click(getByTestId('receive-network-list-item-tron--0x2b6653dc'));
    await waitFor(() => expect(onSelectNetwork).toHaveBeenCalledTimes(2));
    expect(mockEnableNetwork).toHaveBeenCalledTimes(1);
  });

  it('routes Lightning to the invoice callback in tab mode and hides it in selector mode', async () => {
    const { getByTestId, onSelectLightning, onSelectNetwork, unmount } =
      renderList();
    await waitFor(() =>
      expect(
        getByTestId('receive-network-list-item-lightning--0'),
      ).not.toBeNull(),
    );
    fireEvent.click(getByTestId('receive-network-list-item-lightning--0'));
    await waitFor(() => expect(onSelectLightning).toHaveBeenCalledTimes(1));
    expect(onSelectNetwork).not.toHaveBeenCalled();
    expect(mockReceiveSelectNetworkTab).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: 'lightning--0', action: 'invoice' }),
    );
    mockReceiveSelectNetworkTab.mockReset();
    unmount();

    const selector = renderList({ mode: 'selector' });
    await waitFor(() =>
      expect(
        selector.getByTestId('receive-network-list-item-evm--1'),
      ).not.toBeNull(),
    );
    expect(
      selector.queryByTestId('receive-network-list-item-lightning--0'),
    ).toBeNull();
    expect(
      selector
        .getByTestId('receive-network-list-item-evm--1')
        .getAttribute('data-drillin'),
    ).toBe('0');
    fireEvent.click(selector.getByTestId('receive-network-list-item-evm--1'));
    await waitFor(() =>
      expect(selector.onSelectNetwork).toHaveBeenCalledTimes(1),
    );
    // Selector mode is the switch target: the switch event covers it.
    expect(mockReceiveSelectNetworkTab).not.toHaveBeenCalled();
  });

  it('lists only networks with an address for imported wallets', async () => {
    const { getByTestId, queryByTestId } = renderList({
      walletId: 'imported-1',
      indexedAccountId: undefined,
      accountId: 'imported-1--evm',
    });
    await waitFor(() =>
      expect(
        getByTestId('receive-network-list-item-evm--1').querySelector(
          '[data-testid="subtitle"]',
        ),
      ).not.toBeNull(),
    );
    expect(queryByTestId('receive-network-list-item-aptos--1')).toBeNull();
  });

  it('filters by the search text and shows the empty state', async () => {
    const { getAllByTestId, getByTestId, rerender } = renderList({
      searchText: 'tro',
    });
    await waitFor(() =>
      expect(getAllByTestId('title').map((n) => n.textContent)).toEqual([
        'Tron',
      ]),
    );
    rerender(
      <ReceiveNetworkList
        testID="list"
        mode="tab"
        walletId="hd-1"
        indexedAccountId="hd-1--0"
        accountId="hd-1--all"
        searchText="zzz"
        onSelectNetwork={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(getByTestId('empty').textContent).toBe(
        'token_selector_search_no_result__title',
      ),
    );
  });
});
