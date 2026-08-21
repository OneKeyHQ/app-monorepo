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
    run: jest.Mock;
  } = { run: jest.fn() };
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
      return { result: undefined, run: state.run, isLoading: false };
    },
  };
});

import { act, renderHook } from '@testing-library/react-native';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

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
      run: jest.Mock;
    };
  }
).__earnAccountPromiseResultMock;

describe('useEarnAccount cache identity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    selectedAccountMock.current.deriveType = 'default';
    promiseResultMock.deps = undefined;
    promiseResultMock.options = undefined;
    promiseResultMock.run.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ignores another selector network derive type and refreshes from events', () => {
    const { rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );

    const initialDeps = promiseResultMock.deps;
    const initialSWRKey = promiseResultMock.options?.swrKey;

    selectedAccountMock.current.deriveType = 'BIP44';
    rerender(undefined);

    expect(promiseResultMock.deps).toEqual(initialDeps);
    expect(promiseResultMock.options?.swrKey).toBe(initialSWRKey);

    act(() => {
      appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, undefined);
      jest.advanceTimersByTime(300);
    });

    expect(promiseResultMock.run).toHaveBeenCalledWith({
      alwaysSetState: true,
    });
  });
});
