/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, waitFor } from '@testing-library/react';

import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { AggregateTokenListItem } from './AggregateTokenSelector';

const mockGetNetworkAccount = jest.fn<
  Promise<{ id: string } | undefined>,
  [unknown]
>();
let mockSubTokenFiat:
  | { balanceParsed?: string; fiatValue?: string; currency?: string }
  | undefined;

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: {} }),
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
    },
    serviceAccount: {
      getNetworkAccount: (params: unknown) => mockGetNetworkAccount(params),
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
    }: {
      title?: ReactNode;
      subtitle?: ReactNode;
      children?: ReactNode;
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'list-item' },
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
    usePromiseResult: (fn: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = React.useState<unknown>(undefined);
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
  useActiveAccount: () => ({
    activeAccount: {
      wallet: { id: 'hd-1' },
      indexedAccount: { id: 'hd-1--0' },
    },
  }),
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
    />,
  );
}

describe('AggregateTokenListItem', () => {
  beforeEach(() => {
    mockGetNetworkAccount.mockReset();
    mockSubTokenFiat = undefined;
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
