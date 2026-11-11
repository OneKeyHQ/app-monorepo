/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IHomeMoneroEnableRequest } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { useHomeMoneroAccountCreation } from './useHomeMoneroAccountCreation';

const mockActiveAccount: {
  wallet: { id: string; isTemp: boolean } | undefined;
  indexedAccount: { id: string } | undefined;
  network: { id: string } | undefined;
} = {
  wallet: { id: 'hd-1', isTemp: false },
  indexedAccount: { id: 'hd-1--0' },
  network: { id: 'xmr--0' },
};
let mockEnableRequest: IHomeMoneroEnableRequest | undefined;
const mockSetEnableRequest = jest.fn(
  (
    update:
      | IHomeMoneroEnableRequest
      | undefined
      | ((
          previous: IHomeMoneroEnableRequest | undefined,
        ) => IHomeMoneroEnableRequest | undefined),
  ) => {
    mockEnableRequest =
      typeof update === 'function' ? update(mockEnableRequest) : update;
  },
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountOverview', () => ({
  useHomeMoneroEnableRequestAtom: () => [
    mockEnableRequest,
    mockSetEnableRequest,
  ],
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHdWallet: ({ walletId }: { walletId: string }) =>
      walletId.startsWith('hd-'),
  },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getNetworkImpl: ({ networkId }: { networkId: string }) =>
      networkId.split('--')[0],
  },
}));

const createdAccount: IDBAccount = {
  id: 'hd-1--m/44/128/0',
  name: 'Account #1',
  type: undefined,
  path: "m/44'/128'/0'",
  coinType: '128',
  impl: 'xmr',
  pub: '',
  address: 'xmr-address',
  indexedAccountId: 'hd-1--0',
};
const creationResult = {
  walletId: 'hd-1',
  indexedAccountId: 'hd-1--0',
  accounts: [createdAccount],
};

beforeEach(() => {
  mockActiveAccount.wallet = { id: 'hd-1', isTemp: false };
  mockActiveAccount.indexedAccount = { id: 'hd-1--0' };
  mockActiveAccount.network = { id: 'xmr--0' };
  mockEnableRequest = undefined;
  mockSetEnableRequest.mockClear();
});

it('records only a successful Monero address result for this wallet and index', () => {
  const { result } = renderHook(() => useHomeMoneroAccountCreation());
  expect(result.current.enableAfterCreate).toBe(true);
  act(() => result.current.onCreateDone(undefined));
  act(() => result.current.onCreateDone({ ...creationResult, accounts: [] }));
  act(() =>
    result.current.onCreateDone({ ...creationResult, walletId: 'hd-2' }),
  );
  expect(mockEnableRequest).toBeUndefined();
  act(() => result.current.onCreateDone(creationResult));
  expect(mockEnableRequest).toEqual({
    walletId: 'hd-1',
    indexedAccountId: 'hd-1--0',
    networkId: 'xmr--0',
    accountId: createdAccount.id,
  });
});

it('cleans up safely before a wallet is selected', () => {
  mockActiveAccount.wallet = undefined;
  mockActiveAccount.indexedAccount = undefined;
  mockActiveAccount.network = undefined;
  const { unmount } = renderHook(() => useHomeMoneroAccountCreation());
  expect(unmount).not.toThrow();
  expect(mockEnableRequest).toBeUndefined();
});

it('keeps first Monero creation explicit and continues after the created index is selected', () => {
  mockActiveAccount.indexedAccount = undefined;
  const { result, rerender, unmount } = renderHook(() =>
    useHomeMoneroAccountCreation(),
  );
  expect(result.current.enableAfterCreate).toBe(true);
  expect(mockSetEnableRequest).not.toHaveBeenCalled();
  const onCreateDone = result.current.onCreateDone;
  act(() => onCreateDone(undefined));
  expect(mockEnableRequest).toBeUndefined();

  // The existing creation flow selects the returned index before this callback.
  mockActiveAccount.indexedAccount = { id: creationResult.indexedAccountId };
  rerender();
  act(() => onCreateDone(creationResult));
  expect(mockEnableRequest).toEqual({
    walletId: 'hd-1',
    indexedAccountId: creationResult.indexedAccountId,
    networkId: 'xmr--0',
    accountId: createdAccount.id,
  });
  unmount();
  expect(mockEnableRequest).toBeUndefined();
});

it.each([false, true])(
  'drops first creation after another index is selected, even if creation later selects its own index (%s)',
  (returnsToCreatedIndex) => {
    mockActiveAccount.indexedAccount = undefined;
    const { result, rerender } = renderHook(() =>
      useHomeMoneroAccountCreation(),
    );
    const onCreateDone = result.current.onCreateDone;
    mockActiveAccount.indexedAccount = { id: 'hd-1--1' };
    rerender();
    if (returnsToCreatedIndex) {
      mockActiveAccount.indexedAccount = {
        id: creationResult.indexedAccountId,
      };
      rerender();
    }
    act(() => onCreateDone(creationResult));
    expect(mockEnableRequest).toBeUndefined();
  },
);

it.each(['wallet', 'network'] as const)(
  'drops first creation after leaving and returning to its %s',
  (field) => {
    mockActiveAccount.indexedAccount = undefined;
    const { result, rerender } = renderHook(() =>
      useHomeMoneroAccountCreation(),
    );
    const onCreateDone = result.current.onCreateDone;
    if (field === 'wallet') {
      mockActiveAccount.wallet = { id: 'hd-2', isTemp: false };
    } else {
      mockActiveAccount.network = { id: 'evm--1' };
    }
    rerender();
    mockActiveAccount.wallet = { id: 'hd-1', isTemp: false };
    mockActiveAccount.network = { id: 'xmr--0' };
    mockActiveAccount.indexedAccount = {
      id: creationResult.indexedAccountId,
    };
    rerender();
    act(() => onCreateDone(creationResult));
    expect(mockEnableRequest).toBeUndefined();
  },
);

it('drops an in-flight creation handoff after switching the selected account', () => {
  const { result, rerender } = renderHook(() => useHomeMoneroAccountCreation());
  const oldCallback = result.current.onCreateDone;
  mockActiveAccount.indexedAccount = { id: 'hd-1--1' };
  rerender();
  act(() => oldCallback(creationResult));
  expect(mockEnableRequest).toBeUndefined();
});

it('clears a pending request when leaving its owner and ignores late completion after unmount', () => {
  const { result, unmount } = renderHook(() => useHomeMoneroAccountCreation());
  const oldCallback = result.current.onCreateDone;
  act(() => oldCallback(creationResult));
  expect(mockEnableRequest).toBeDefined();
  unmount();
  expect(mockEnableRequest).toBeUndefined();
  act(() => oldCallback(creationResult));
  expect(mockEnableRequest).toBeUndefined();
});

it.each([
  { wallet: { id: 'hw-1', isTemp: false }, network: { id: 'xmr--0' } },
  { wallet: { id: 'hd-1', isTemp: true }, network: { id: 'xmr--0' } },
  { wallet: { id: 'hd-1', isTemp: false }, network: { id: 'evm--1' } },
])(
  'keeps ordinary creation for unsupported or non-Monero owners %j',
  ({ wallet, network }) => {
    mockActiveAccount.wallet = wallet;
    mockActiveAccount.network = network;
    const { result } = renderHook(() => useHomeMoneroAccountCreation());
    expect(result.current.enableAfterCreate).toBe(false);
    act(() => result.current.onCreateDone(creationResult));
    expect(mockEnableRequest).toBeUndefined();
  },
);
