/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';

import { useHomeBalanceState } from './useHomeBalanceState';

let mockActiveAccount = {
  wallet: { id: 'wallet-1' },
  account: { id: 'account-1' },
  network: { id: 'onekeyall--0' },
  indexedAccount: { id: 'indexed-1' },
};
let mockBalances: Record<string, string> = {};
let mockWorth = {
  initialized: false,
  accountId: 'account-1',
  worth: {} as Record<string, string>,
};
let mockStructure = {
  ownerKey: 'account-1__onekeyall--0',
  generation: -1,
  fundedIds: [] as string[],
};

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const callbacks = new Set<() => void>();
  return {
    appEventBus: {
      on: (_event: string, callback: () => void) => callbacks.add(callback),
      emit: () => callbacks.forEach((callback) => callback()),
    },
  };
});

jest.mock('../states/jotai/contexts/accountOverview', () => ({
  buildOverviewOwnerKey: (accountId: string, networkId: string) =>
    `${accountId}__${networkId}`,
  useAccountWorthAtom: () => [mockWorth],
  useLastConfirmedOverviewBalanceAtom: () => [
    { byOwner: mockBalances },
    jest.fn(),
  ],
}));

jest.mock('../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('../states/jotai/contexts/tokenList', () => ({
  useListStructureAtom: () => [mockStructure],
}));

describe('Home action balance state', () => {
  beforeEach(() => {
    appEventBus.emit(EAppEventBusNames.WalletRemove, { walletId: 'wallet-1' });
    mockActiveAccount = {
      wallet: { id: 'wallet-1' },
      account: { id: 'account-1' },
      network: { id: 'onekeyall--0' },
      indexedAccount: { id: 'indexed-1' },
    };
    mockBalances = {};
    mockWorth = { initialized: false, accountId: 'account-1', worth: {} };
    mockStructure = {
      ownerKey: 'account-1__onekeyall--0',
      generation: -1,
      fundedIds: [],
    };
  });

  it('keeps an uncached account unknown while requests are pending', () => {
    const { result } = renderHook(() => useHomeBalanceState());
    expect(result.current).toBe('unknown');
  });

  it.each(['0', '12'])(
    'uses cached balance %s without waiting for requests',
    (balance) => {
      mockBalances = { 'account-1__onekeyall--0': balance };
      const { result } = renderHook(() => useHomeBalanceState());
      expect(result.current).toBe(balance === '0' ? 'zero' : 'positive');
    },
  );

  it('classifies an owner-matched live worth map containing only zero values', () => {
    mockWorth = {
      initialized: true,
      accountId: 'account-1',
      worth: Object.fromEntries(
        Array.from({ length: 53 }, (_, i) => [`chain-${i}`, '0']),
      ),
    };
    const { result } = renderHook(() => useHomeBalanceState());
    expect(result.current).toBe('zero');
  });

  it('classifies a single positive live worth value for the indexed account', () => {
    mockWorth = {
      initialized: true,
      accountId: 'indexed-1',
      worth: { chain: '1' },
    };
    const { result } = renderHook(() => useHomeBalanceState());
    expect(result.current).toBe('positive');
  });

  it('retains unpriced holdings through an empty refresh', () => {
    mockBalances = { 'account-1__onekeyall--0': '0' };
    mockStructure = {
      ...mockStructure,
      generation: 1,
      fundedIds: ['unpriced'],
    };
    const { result, rerender } = renderHook(() => useHomeBalanceState());
    expect(result.current).toBe('positive');
    mockStructure = { ...mockStructure, fundedIds: [] };
    rerender();
    expect(result.current).toBe('positive');
  });

  it("ignores another account's live balance and holdings", () => {
    mockWorth = {
      initialized: true,
      accountId: 'other-account',
      worth: { chain: '9' },
    };
    mockStructure = {
      ownerKey: 'other-account__onekeyall--0',
      generation: 1,
      fundedIds: ['token'],
    };
    const { result } = renderHook(() => useHomeBalanceState());
    expect(result.current).toBe('unknown');
  });

  it.each(['account', 'network'] as const)(
    'does not borrow a zero balance while the next %s has no data',
    (switchType) => {
      mockBalances = { 'account-1__onekeyall--0': '0' };
      const { result, rerender } = renderHook(() => useHomeBalanceState());
      expect(result.current).toBe('zero');
      mockActiveAccount = {
        ...mockActiveAccount,
        ...(switchType === 'account'
          ? { account: { id: 'account-2' } }
          : { network: { id: 'evm--56' } }),
      };
      rerender();
      expect(result.current).toBe('unknown');
      mockBalances = {
        [`${mockActiveAccount.account.id}__${mockActiveAccount.network.id}`]:
          '0',
      };
      rerender();
      expect(result.current).toBe('zero');
    },
  );

  it('keeps the previous layout within a wallet but resets it across wallets', () => {
    mockBalances = { 'account-1__onekeyall--0': '1' };
    const { result, rerender } = renderHook(() => useHomeBalanceState());
    expect(result.current).toBe('positive');
    mockActiveAccount = { ...mockActiveAccount, account: { id: 'account-2' } };
    rerender();
    expect(result.current).toBe('positive');
    mockActiveAccount = { ...mockActiveAccount, wallet: { id: 'wallet-2' } };
    rerender();
    expect(result.current).toBe('unknown');
  });
});
