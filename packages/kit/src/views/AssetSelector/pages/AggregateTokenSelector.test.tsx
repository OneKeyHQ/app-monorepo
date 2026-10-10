/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import type { IAccountToken } from '@onekeyhq/shared/types/token';

import AggregateTokenSelector, {
  AggregateTokenListItem,
  resolveAggregateSelectorAccountScope,
} from './AggregateTokenSelector';

const mockGetNetworkAccount = jest.fn<
  Promise<{ id: string } | undefined>,
  [{ indexedAccountId?: string; networkId?: string }]
>();
const mockCreateAddressForNetwork = jest.fn<
  Promise<string | undefined>,
  [unknown]
>();
let mockRouteParams: Record<string, unknown> = {};
let mockActiveAccount: {
  wallet?: { id: string };
  indexedAccount?: { id: string; walletId: string };
} = {};
let mockSubTokenFiat:
  | { balanceParsed?: string; fiatValue?: string; currency?: string }
  | undefined;

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Empty: () => null,
    Icon: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-testid': `icon-${name}` }),
    NumberSizeableText: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', { 'data-testid': 'balance' }, children),
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    Spinner: () => React.createElement('span', { 'data-testid': 'spinner' }),
    Stack: Container,
    Toast: { success: jest.fn(), error: jest.fn() },
  };
});

jest.mock('@onekeyhq/kit/src/components/Currency', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Currency: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', { 'data-testid': 'fiat-value' }, children),
  };
});

jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getListedNetworkMap: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { emit: jest.fn() },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: jest.fn(async () => 'default'),
      getChainSelectorNetworksCompatibleWithAccountId: jest.fn(async () => ({
        mainnetItems: [
          { id: 'evm--1', name: 'Ethereum' },
          { id: 'evm--42161', name: 'Arbitrum' },
        ],
        testnetItems: [],
        unavailableItems: [],
      })),
    },
    serviceAccount: {
      getNetworkAccount: (params: {
        indexedAccountId?: string;
        networkId?: string;
      }) => mockGetNetworkAccount(params),
    },
    serviceAllNetwork: {
      getAllNetworksState: jest.fn(async () => ({
        disabledNetworks: {},
        enabledNetworks: {},
      })),
      updateAllNetworksState: jest.fn(async () => undefined),
    },
  },
}));

jest.mock('../../../components/AccountSelector/AccountSelectorProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock(
  '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress',
  () => ({
    useAccountSelectorCreateAddress: () => ({ createAddress: jest.fn() }),
  }),
);

jest.mock(
  '../../../components/AccountSelector/hooks/useCreateAddressForNetwork',
  () => ({
    useCreateAddressForNetwork: () => ({
      createAddressForNetwork: (params: unknown) =>
        mockCreateAddressForNetwork(params),
      enableNetwork: jest.fn(),
    }),
  }),
);

jest.mock('../../../components/Empty', () => ({
  EmptySearch: () => null,
}));

jest.mock('../../../components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ListItem = Object.assign(
    ({
      title,
      subtitle,
      children,
      onPress,
      disabled,
    }: {
      title?: ReactNode;
      subtitle?: ReactNode;
      children?: ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'list-item', onClick: disabled ? undefined : onPress },
        React.createElement('span', { 'data-testid': 'title' }, title),
        subtitle
          ? React.createElement('span', { 'data-testid': 'subtitle' }, subtitle)
          : null,
        children,
      ),
    {
      Text: ({
        primary,
        secondary,
      }: {
        primary?: ReactNode;
        secondary?: ReactNode;
      }) =>
        React.createElement(
          'div',
          { 'data-testid': 'list-item-text' },
          primary,
          secondary,
        ),
    },
  );
  return { ListItem };
});

jest.mock('../../../components/NetworkAvatar', () => ({
  NetworkAvatarBase: () => null,
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: jest.fn(), push: jest.fn() }),
}));

jest.mock('../../../hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    // Minimal stand-in that runs the loader once per deps change so the row's
    // account lookup settles asynchronously, the same way it does at runtime.
    usePromiseResult: (
      fn: () => Promise<unknown>,
      deps: unknown[],
      options?: { initResult?: unknown },
    ) => {
      const [result, setResult] = React.useState<unknown>(options?.initResult);
      React.useEffect(() => {
        let cancelled = false;
        void fn().then((value) => {
          if (!cancelled) {
            setResult(value);
          }
        });
        return () => {
          cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps);
      return { result, run: jest.fn() };
    },
  };
});

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('../../../states/jotai/contexts/tokenList', () => ({
  useProcessingTokenStateAtom: () => [{ isProcessing: false, token: null }],
  useTokenListActions: () => ({
    current: { updateProcessingTokenState: jest.fn() },
  }),
}));

jest.mock('../../../states/jotai/contexts/tokenList/cells', () => ({
  useAggregateSubTokenFiat: () => mockSubTokenFiat,
  useAggregateSubTokenFiatMap: () => ({}),
}));

jest.mock('../../Home/components/HomeTokenListProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeTokenListProviderMirrorWrapper: ({
      children,
    }: {
      children?: ReactNode;
    }) => React.createElement(React.Fragment, null, children),
  };
});

const suiUsdc: IAccountToken = {
  $key: 'sui--mainnet_usdc',
  address: '0xusdc',
  decimals: 6,
  isNative: false,
  name: 'USD Coin',
  symbol: 'USDC',
  networkId: 'sui--mainnet',
  networkName: 'SUI',
};

function renderRow(token: IAccountToken = suiUsdc) {
  return render(
    <AggregateTokenListItem
      token={token}
      aggKey="aggregate--usdc"
      network={undefined}
      onPress={jest.fn()}
      allNetworksState={{ disabledNetworks: {}, enabledNetworks: {} }}
      refreshAllNetworkState={jest.fn()}
      processingTokenKey={null}
      walletId="hd-1"
      indexedAccountId="hd-1--0"
      createAddressForNetwork={jest.fn()}
      beginSelection={() => () => true}
    />,
  );
}

describe('resolveAggregateSelectorAccountScope', () => {
  const active = {
    activeWalletId: 'hd-1',
    activeIndexedAccountId: 'hd-1--1',
    activeIndexedAccountWalletId: 'hd-1',
  };

  it('falls back to the active account when the route carries no indexed account, empty string included', () => {
    for (const routeIndexedAccountId of ['', undefined]) {
      expect(
        resolveAggregateSelectorAccountScope({
          routeAccountId: "hd-1--m/44'/60'/1'/0/0",
          routeIndexedAccountId,
          ...active,
        }),
      ).toEqual({ walletId: 'hd-1', indexedAccountId: 'hd-1--1' });
    }
  });

  it('keeps the scope the route carries', () => {
    expect(
      resolveAggregateSelectorAccountScope({
        routeAccountId: "hd-2--m/44'/60'/3'/0/0",
        routeIndexedAccountId: 'hd-2--3',
        ...active,
      }),
    ).toEqual({ walletId: 'hd-2', indexedAccountId: 'hd-2--3' });
  });

  it('does not borrow the active account for a page about another wallet', () => {
    expect(
      resolveAggregateSelectorAccountScope({
        routeAccountId: "hd-2--m/44'/60'/0'/0/0",
        routeIndexedAccountId: '',
        ...active,
      }),
    ).toEqual({ walletId: 'hd-2', indexedAccountId: undefined });
  });

  it('uses the active wallet when the route carries no account', () => {
    expect(
      resolveAggregateSelectorAccountScope({
        routeAccountId: '',
        routeIndexedAccountId: undefined,
        ...active,
      }),
    ).toEqual({ walletId: 'hd-1', indexedAccountId: 'hd-1--1' });
  });
});

describe('AggregateTokenSelector', () => {
  const AGGREGATE_USDC = {
    $key: 'aggregate_USDC_',
    isAggregateToken: true,
    commonSymbol: 'USDC',
    name: 'USD Coin',
    symbol: 'USDC',
    networkId: '',
    address: 'aggregate_USDC_',
    decimals: 0,
    isNative: false,
  } as IAccountToken;
  const usdcOn = (
    networkId: string,
    networkName: string,
    extra: Partial<IAccountToken> = {},
  ): IAccountToken => ({
    $key: `aggregate_USDC_${networkId}`,
    address: '0xusdc',
    decimals: 6,
    isNative: false,
    name: 'USD Coin',
    symbol: 'USDC',
    commonSymbol: 'USDC',
    networkId,
    networkName,
    ...extra,
  });
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

  function renderSelector(params: Record<string, unknown> = {}) {
    const onSelect = jest.fn(async () => undefined);
    mockRouteParams = {
      // The page is about account #2 of the wallet.
      accountId: "hd-1--m/44'/60'/1'/0/0",
      indexedAccountId: 'hd-1--1',
      aggregateToken: AGGREGATE_USDC,
      aggregateSubTokenList: [],
      allAggregateTokenList: [
        usdcOn('evm--1', 'Ethereum'),
        usdcOn('evm--42161', 'Arbitrum'),
      ],
      onSelect,
      closeAfterSelect: true,
      ...params,
    };
    const utils = render(<AggregateTokenSelector />);
    const row = (networkName: string) => {
      const found = utils
        .getAllByTestId('list-item')
        .find(
          (item) =>
            item.querySelector('[data-testid="title"]')?.textContent ===
            networkName,
        );
      expect(found).toBeDefined();
      return found as HTMLElement;
    };
    return { ...utils, onSelect, row };
  }

  beforeEach(() => {
    mockGetNetworkAccount.mockReset();
    mockCreateAddressForNetwork.mockReset();
    mockSubTokenFiat = undefined;
    mockActiveAccount = {
      wallet: { id: 'hd-1' },
      indexedAccount: { id: 'hd-1--1', walletId: 'hd-1' },
    };
    // Arbitrum has an address, Ethereum has none yet.
    mockGetNetworkAccount.mockImplementation(async ({ networkId }) => {
      if (networkId === 'evm--42161') {
        return { id: 'hd-1--arb-1' };
      }
      return Promise.reject(new Error('account not found'));
    });
  });

  it('resolves and creates addresses for the active account when the route passes an empty indexed account', async () => {
    mockCreateAddressForNetwork.mockResolvedValue('hd-1--eth-1');
    const { row, onSelect, queryAllByTestId } = renderSelector({
      indexedAccountId: '',
    });
    await waitFor(() => expect(queryAllByTestId('list-item')).toHaveLength(2));
    await waitFor(() =>
      expect(
        row('Arbitrum').querySelector('[data-testid="subtitle"]'),
      ).toBeNull(),
    );
    // Looked up for account #2, not for an empty scope.
    for (const [params] of mockGetNetworkAccount.mock.calls) {
      expect(params.indexedAccountId).toBe('hd-1--1');
    }
    // The network that already has an address is not offered for creation.
    expect(
      row('Ethereum').querySelector('[data-testid="subtitle"]')?.textContent,
    ).toBe('global.create_address');

    fireEvent.click(row('Ethereum'));
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(mockCreateAddressForNetwork).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--1',
        networkId: 'evm--1',
      }),
    );
  });

  it('does not report a network whose address finished creating after another network was picked', async () => {
    let finishCreating: (accountId: string) => void = () => undefined;
    mockCreateAddressForNetwork.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCreating = resolve;
        }),
    );
    const { row, onSelect, queryAllByTestId } = renderSelector();
    await waitFor(() => expect(queryAllByTestId('list-item')).toHaveLength(2));
    await waitFor(() =>
      expect(
        row('Arbitrum').querySelector('[data-testid="subtitle"]'),
      ).toBeNull(),
    );

    fireEvent.click(row('Ethereum'));
    fireEvent.click(row('Arbitrum'));
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ networkId: 'evm--42161' }),
      expect.anything(),
    );

    await act(async () => {
      finishCreating('hd-1--eth-1');
    });
    await settle();
    // Arbitrum was the last pick: Ethereum must not take over afterwards.
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not report a network whose address finished creating after the selector closed', async () => {
    let finishCreating: (accountId: string) => void = () => undefined;
    mockCreateAddressForNetwork.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCreating = resolve;
        }),
    );
    const { row, onSelect, queryAllByTestId, unmount } = renderSelector();
    await waitFor(() => expect(queryAllByTestId('list-item')).toHaveLength(2));
    fireEvent.click(row('Ethereum'));
    unmount();
    await act(async () => {
      finishCreating('hd-1--eth-1');
    });
    await settle();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('AggregateTokenListItem', () => {
  beforeEach(() => {
    mockGetNetworkAccount.mockReset();
    mockSubTokenFiat = undefined;
    mockActiveAccount = {
      wallet: { id: 'hd-1' },
      indexedAccount: { id: 'hd-1--0', walletId: 'hd-1' },
    };
  });

  it('hides balance and value on a network without a created address (OK-61879)', async () => {
    mockGetNetworkAccount.mockRejectedValue(new Error('account not found'));

    const { queryByTestId } = renderRow();

    await waitFor(() => expect(mockGetNetworkAccount).toHaveBeenCalled());
    await waitFor(() => expect(queryByTestId('list-item-text')).toBeNull());
    expect(queryByTestId('subtitle')?.textContent).toBe(
      'global.create_address',
    );
    expect(queryByTestId('icon-PlusLargeOutline')).not.toBeNull();
  });

  it('keeps balance and value once the network account resolves', async () => {
    mockGetNetworkAccount.mockResolvedValue({ id: 'hd-1--sui-0' });
    mockSubTokenFiat = {
      balanceParsed: '0.414',
      fiatValue: '0.41',
      currency: 'usd',
    };

    const { queryByTestId, getByTestId } = renderRow();

    await waitFor(() => expect(queryByTestId('subtitle')).toBeNull());
    expect(getByTestId('list-item-text')).not.toBeNull();
    expect(getByTestId('balance').textContent).toBe('0.414');
    expect(getByTestId('fiat-value').textContent).toBe('0.41');
    expect(queryByTestId('icon-PlusLargeOutline')).toBeNull();
  });

  it('keeps the value column while the account lookup is still pending', () => {
    mockGetNetworkAccount.mockReturnValue(new Promise(() => {}));

    const { getByTestId } = renderRow();

    // Rows with an address must not blink their balance in after the first
    // frame, so the column stays until the lookup settles without an account.
    expect(getByTestId('list-item-text')).not.toBeNull();
  });
});
