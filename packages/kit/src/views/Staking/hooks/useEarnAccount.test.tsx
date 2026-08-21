/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceStaking: { getEarnAccount: jest.fn() } },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => {
  const selectedAccount = {
    current: {
      indexedAccountId: 'wallet-1--1',
      othersWalletAccountId: undefined,
      deriveType: 'default',
    },
  };
  (
    globalThis as unknown as {
      __earnSelectedAccountMock: typeof selectedAccount;
    }
  ).__earnSelectedAccountMock = selectedAccount;

  return {
    useActiveAccount: () => ({ activeAccount: { indexedAccount: undefined } }),
    useSelectedAccount: () => ({ selectedAccount: selectedAccount.current }),
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const state: {
    deps?: unknown[];
    options?: { swrKey?: string };
  } = {};
  (
    globalThis as unknown as {
      __earnAccountPromiseResultMock: typeof state;
    }
  ).__earnAccountPromiseResultMock = state;

  return {
    usePromiseResult: (
      _method: () => Promise<unknown>,
      deps: unknown[],
      options: { swrKey?: string },
    ) => {
      state.deps = deps;
      state.options = options;
      return { result: undefined, run: jest.fn(), isLoading: false };
    },
  };
});

import { renderHook } from '@testing-library/react-native';

import { useEarnAccount } from './useEarnAccount';

const selectedAccountMock = (
  globalThis as unknown as {
    __earnSelectedAccountMock: {
      current: {
        indexedAccountId: string;
        othersWalletAccountId?: string;
        deriveType: string;
      };
    };
  }
).__earnSelectedAccountMock;
const promiseResultMock = (
  globalThis as unknown as {
    __earnAccountPromiseResultMock: {
      deps?: unknown[];
      options?: { swrKey?: string };
    };
  }
).__earnAccountPromiseResultMock;

describe('useEarnAccount cache identity', () => {
  beforeEach(() => {
    selectedAccountMock.current.deriveType = 'default';
    promiseResultMock.deps = undefined;
    promiseResultMock.options = undefined;
  });

  it('reruns and swaps cache scope when the selected derive type changes', () => {
    const { rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );

    expect(promiseResultMock.deps).toContain('default');
    expect(promiseResultMock.options?.swrKey).toContain(':default:');

    selectedAccountMock.current.deriveType = 'BIP44';
    rerender(undefined);

    expect(promiseResultMock.deps).toContain('BIP44');
    expect(promiseResultMock.options?.swrKey).toContain(':BIP44:');
  });
});
