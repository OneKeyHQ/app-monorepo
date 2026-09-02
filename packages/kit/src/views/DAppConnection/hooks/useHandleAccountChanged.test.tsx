/* eslint-disable import/first */

const mockSelectedAccountsAtom = Symbol('selectedAccountsAtom');
function createMockAccountSelectorStore(
  selectedAccount: Record<string, string | undefined>,
) {
  return {
    get: jest.fn((atom: unknown) =>
      atom === mockSelectedAccountsAtom ? { 0: selectedAccount } : undefined,
    ),
  };
}

type IMockActiveAccount = {
  account?: { address: string; id: string };
  dbAccount?: { id: string };
  deriveType?: string;
  indexedAccount?: { id: string };
  network?: { id: string };
  wallet?: { id: string };
};

let mockContextStore = createMockAccountSelectorStore({});
let mockActiveAccount: IMockActiveAccount = {
  account: { address: '0x1', id: 'account-1' },
  dbAccount: undefined,
  deriveType: 'default',
  indexedAccount: { id: 'indexed-account-1' },
  network: { id: 'evm--1' },
  wallet: { id: 'wallet-1' },
};

jest.mock('use-debounce', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useThrottledCallback: (callback: () => void) => {
      const callbackRef = React.useRef(callback);
      callbackRef.current = callback;
      return React.useMemo(() => () => callbackRef.current(), []);
    },
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  defaultSelectedAccount: () => ({}),
  selectedAccountsAtom: () => mockSelectedAccountsAtom,
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
  useAccountSelectorContextData: () => ({ store: mockContextStore }),
}));

import { renderHook } from '@testing-library/react-native';

import { useHandleDiscoveryAccountChanged } from './useHandleAccountChanged';

describe('useHandleDiscoveryAccountChanged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextStore = createMockAccountSelectorStore({});
    mockActiveAccount = {
      account: { address: '0x1', id: 'account-1' },
      dbAccount: undefined,
      deriveType: 'default',
      indexedAccount: { id: 'indexed-account-1' },
      network: { id: 'evm--1' },
      wallet: { id: 'wallet-1' },
    };
  });

  it('reads the latest selected account when the active account changes', () => {
    const firstSelectedAccount = {
      deriveType: 'default',
      indexedAccountId: 'indexed-account-1',
      networkId: 'evm--1',
      walletId: 'wallet-1',
    };
    const latestSelectedAccount = {
      deriveType: 'default',
      indexedAccountId: 'indexed-account-2',
      networkId: 'evm--1',
      walletId: 'wallet-2',
    };
    mockContextStore = createMockAccountSelectorStore(firstSelectedAccount);
    const handleAccountChanged = jest.fn();

    const { rerender } = renderHook(
      (_props: Record<string, never>) =>
        useHandleDiscoveryAccountChanged({
          handleAccountChanged,
          num: 0,
        }),
      { initialProps: {} },
    );

    expect(handleAccountChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedAccount: firstSelectedAccount }),
      0,
    );

    mockContextStore = createMockAccountSelectorStore(latestSelectedAccount);
    rerender({});
    expect(handleAccountChanged).toHaveBeenCalledTimes(1);

    mockActiveAccount = {
      ...mockActiveAccount,
      account: { address: '0x2', id: 'account-2' },
      indexedAccount: { id: 'indexed-account-2' },
      wallet: { id: 'wallet-2' },
    };
    rerender({});

    expect(handleAccountChanged).toHaveBeenCalledTimes(2);
    expect(handleAccountChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedAccount: latestSelectedAccount }),
      0,
    );
  });

  it('does not write a stale active account while a new selection is reloading', () => {
    const firstSelectedAccount = {
      deriveType: 'default',
      indexedAccountId: 'indexed-account-1',
      networkId: 'evm--1',
      walletId: 'wallet-1',
    };
    const latestSelectedAccount = {
      deriveType: 'default',
      indexedAccountId: 'indexed-account-2',
      networkId: 'evm--1',
      walletId: 'wallet-2',
    };
    mockContextStore = createMockAccountSelectorStore(firstSelectedAccount);
    const handleAccountChanged = jest.fn();
    const { rerender } = renderHook(
      (_props: Record<string, never>) =>
        useHandleDiscoveryAccountChanged({
          handleAccountChanged,
          num: 0,
        }),
      { initialProps: {} },
    );
    expect(handleAccountChanged).toHaveBeenCalledTimes(1);

    mockContextStore = createMockAccountSelectorStore(latestSelectedAccount);
    mockActiveAccount = {
      ...mockActiveAccount,
      account: { address: '0x-stale', id: 'account-1' },
    };
    rerender({});
    expect(handleAccountChanged).toHaveBeenCalledTimes(1);

    mockActiveAccount = {
      account: { address: '0x2', id: 'account-2' },
      dbAccount: undefined,
      deriveType: 'default',
      indexedAccount: { id: 'indexed-account-2' },
      network: { id: 'evm--1' },
      wallet: { id: 'wallet-2' },
    };
    rerender({});
    expect(handleAccountChanged).toHaveBeenCalledTimes(2);
    expect(handleAccountChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedAccount: latestSelectedAccount }),
      0,
    );
  });

  it('reads selection from the current provider store after the origin changes', () => {
    const firstSelectedAccount = {
      deriveType: 'default',
      indexedAccountId: 'indexed-account-1',
      networkId: 'evm--1',
      walletId: 'wallet-1',
    };
    const latestSelectedAccount = {
      deriveType: 'default',
      indexedAccountId: 'indexed-account-2',
      networkId: 'evm--1',
      walletId: 'wallet-2',
    };
    mockContextStore = createMockAccountSelectorStore(firstSelectedAccount);
    const handleAccountChanged = jest.fn();
    const { rerender } = renderHook(
      (_props: Record<string, never>) =>
        useHandleDiscoveryAccountChanged({
          handleAccountChanged,
          num: 0,
        }),
      { initialProps: {} },
    );
    expect(handleAccountChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedAccount: firstSelectedAccount }),
      0,
    );

    mockContextStore = createMockAccountSelectorStore(latestSelectedAccount);
    mockActiveAccount = {
      account: { address: '0x2', id: 'account-2' },
      dbAccount: undefined,
      deriveType: 'default',
      indexedAccount: { id: 'indexed-account-2' },
      network: { id: 'evm--1' },
      wallet: { id: 'wallet-2' },
    };
    rerender({});

    expect(handleAccountChanged).toHaveBeenCalledTimes(2);
    expect(handleAccountChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedAccount: latestSelectedAccount }),
      0,
    );
  });
  it('reports an others account that only resolved to a dbAccount', () => {
    // An others account incompatible with the current network leaves
    // activeAccount.account undefined, while othersWalletAccountId was built
    // from dbAccount.id. The dapp must still be told about the change.
    const selectedAccount = {
      deriveType: 'default',
      networkId: 'evm--1',
      othersWalletAccountId: 'others-account-1',
      walletId: 'wallet-others',
    };
    mockContextStore = createMockAccountSelectorStore(selectedAccount);
    mockActiveAccount = {
      account: undefined,
      dbAccount: { id: 'others-account-1' },
      deriveType: 'default',
      indexedAccount: undefined,
      network: { id: 'evm--1' },
      wallet: { id: 'wallet-others' },
    };
    const handleAccountChanged = jest.fn();

    renderHook(() =>
      useHandleDiscoveryAccountChanged({ handleAccountChanged, num: 0 }),
    );

    expect(handleAccountChanged).toHaveBeenCalledTimes(1);
    expect(handleAccountChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedAccount }),
      0,
    );
  });

  it('reports a wallet that carries no account identity', () => {
    // Every account of the wallet was deleted; creating the first one is still
    // offered, so the selection has neither an indexed nor an others account id.
    const selectedAccount = {
      deriveType: 'default',
      networkId: 'evm--1',
      walletId: 'wallet-1',
    };
    mockContextStore = createMockAccountSelectorStore(selectedAccount);
    mockActiveAccount = {
      account: undefined,
      dbAccount: undefined,
      deriveType: 'default',
      indexedAccount: undefined,
      network: { id: 'evm--1' },
      wallet: { id: 'wallet-1' },
    };
    const handleAccountChanged = jest.fn();

    renderHook(() =>
      useHandleDiscoveryAccountChanged({ handleAccountChanged, num: 0 }),
    );

    expect(handleAccountChanged).toHaveBeenCalledTimes(1);
    expect(handleAccountChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedAccount }),
      0,
    );
  });

  it('does not report a leftover account while the selection carries none', () => {
    // The selection lost its account identity but the active account has not
    // caught up yet: reporting it would hand the dapp the previous account.
    const selectedAccount = {
      deriveType: 'default',
      networkId: 'evm--1',
      walletId: 'wallet-1',
    };
    mockContextStore = createMockAccountSelectorStore(selectedAccount);
    mockActiveAccount = {
      account: { address: '0x1', id: 'account-1' },
      dbAccount: undefined,
      deriveType: 'default',
      indexedAccount: { id: 'indexed-account-1' },
      network: { id: 'evm--1' },
      wallet: { id: 'wallet-1' },
    };
    const handleAccountChanged = jest.fn();

    renderHook(() =>
      useHandleDiscoveryAccountChanged({ handleAccountChanged, num: 0 }),
    );

    expect(handleAccountChanged).not.toHaveBeenCalled();
  });
});
