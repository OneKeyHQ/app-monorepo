/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const getEarnAccount = jest.fn();
  (
    globalThis as unknown as {
      __earnAccountServiceMock: typeof getEarnAccount;
    }
  ).__earnAccountServiceMock = getEarnAccount;

  return {
    __esModule: true,
    default: {
      serviceNetwork: { getGlobalDeriveTypeOfNetwork: jest.fn() },
      serviceStaking: { getEarnAccount },
    },
  };
});

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
    deriveResult?: string;
    deriveDeps?: unknown[];
    deriveOptions?: {
      undefinedResultIfReRun?: boolean;
      watchLoading?: boolean;
    };
    deriveRun: jest.Mock;
    accountMethod?: () => Promise<unknown>;
    accountDeps?: unknown[];
    accountOptions?: { swrKey?: string; watchLoading?: boolean };
    accountRun: jest.Mock;
  } = {
    deriveResult: 'default',
    deriveRun: jest.fn(),
    accountRun: jest.fn(),
  };
  (
    globalThis as unknown as {
      __earnAccountPromiseResultMock: typeof state;
    }
  ).__earnAccountPromiseResultMock = state;

  return {
    usePromiseResult: (
      _method: () => Promise<unknown>,
      deps: unknown[],
      options: {
        swrKey?: string;
        swrShouldPersist?: (result: unknown) => boolean;
        undefinedResultIfReRun?: boolean;
      },
    ) => {
      if (options.swrShouldPersist) {
        state.accountMethod = _method;
        state.accountDeps = deps;
        state.accountOptions = options;
        return {
          result: undefined,
          run: state.accountRun,
          isLoading: false,
        };
      }
      state.deriveDeps = deps;
      state.deriveOptions = options;
      return {
        result: state.deriveResult,
        run: state.deriveRun,
        isLoading: false,
      };
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
      deriveResult?: string;
      deriveDeps?: unknown[];
      deriveOptions?: {
        undefinedResultIfReRun?: boolean;
        watchLoading?: boolean;
      };
      deriveRun: jest.Mock;
      accountMethod?: () => Promise<unknown>;
      accountDeps?: unknown[];
      accountOptions?: { swrKey?: string; watchLoading?: boolean };
      accountRun: jest.Mock;
    };
  }
).__earnAccountPromiseResultMock;
const earnAccountServiceMock = (
  globalThis as unknown as {
    __earnAccountServiceMock: jest.Mock;
  }
).__earnAccountServiceMock;

describe('useEarnAccount cache identity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    selectedAccountMock.current.deriveType = 'default';
    promiseResultMock.deriveResult = 'default';
    promiseResultMock.deriveDeps = undefined;
    promiseResultMock.deriveOptions = undefined;
    promiseResultMock.deriveRun.mockReset();
    promiseResultMock.accountMethod = undefined;
    promiseResultMock.accountDeps = undefined;
    promiseResultMock.accountOptions = undefined;
    promiseResultMock.accountRun.mockReset();
    earnAccountServiceMock.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps derive loading watched when the network arrives after mount', () => {
    promiseResultMock.deriveResult = undefined;
    const params: { networkId?: string } = {};
    const { rerender } = renderHook(() => useEarnAccount(params));

    expect(promiseResultMock.deriveOptions?.watchLoading).toBe(true);

    params.networkId = 'evm--1';
    rerender(undefined);

    expect(promiseResultMock.deriveDeps).toEqual(['evm--1', true]);
    expect(promiseResultMock.deriveOptions?.watchLoading).toBe(true);
  });

  it('keys and fetches with the authoritative derive type of the target network', async () => {
    promiseResultMock.deriveResult = undefined;
    const { rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );

    expect(promiseResultMock.deriveOptions?.undefinedResultIfReRun).toBe(true);
    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();
    expect(promiseResultMock.accountOptions?.watchLoading).toBe(true);

    promiseResultMock.deriveResult = 'default';
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1::wallet-1--1:default:1',
    );

    await promiseResultMock.accountMethod?.();

    expect(earnAccountServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'evm--1',
        indexedAccountId: 'wallet-1--1',
        deriveType: 'default',
      }),
    );

    selectedAccountMock.current.deriveType = 'BIP44';
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1::wallet-1--1:default:1',
    );

    promiseResultMock.deriveResult = 'ledgerLive';
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1::wallet-1--1:ledgerLive:1',
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
        networkImpl: 'evm',
      });
    });

    expect(promiseResultMock.deriveRun).toHaveBeenCalledWith({
      alwaysSetState: true,
    });
    expect(promiseResultMock.accountRun).not.toHaveBeenCalled();
  });

  it('keeps an HD accountId with indexedAccountId in the derive scope', async () => {
    promiseResultMock.deriveResult = undefined;
    const { rerender } = renderHook(() =>
      useEarnAccount({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44/60/0/0/0',
      }),
    );

    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();

    promiseResultMock.deriveResult = 'default';
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1:hd-1--m/44/60/0/0/0:wallet-1--1:default:1',
    );

    await promiseResultMock.accountMethod?.();

    expect(earnAccountServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'hd-1--m/44/60/0/0/0',
        indexedAccountId: 'wallet-1--1',
        deriveType: 'default',
      }),
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.NetworkDeriveTypeChanged, undefined);
    });

    expect(promiseResultMock.deriveRun).toHaveBeenCalledWith({
      alwaysSetState: true,
    });
  });
});
