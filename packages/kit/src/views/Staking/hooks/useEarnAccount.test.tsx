/* eslint-disable import/first */

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const getEarnAccount = jest.fn();
  const getGlobalDeriveTypeOfNetwork = jest.fn();
  (
    globalThis as unknown as {
      __earnAccountServiceMock: typeof getEarnAccount;
      __earnNetworkDeriveTypeServiceMock: typeof getGlobalDeriveTypeOfNetwork;
    }
  ).__earnAccountServiceMock = getEarnAccount;
  (
    globalThis as unknown as {
      __earnNetworkDeriveTypeServiceMock: typeof getGlobalDeriveTypeOfNetwork;
    }
  ).__earnNetworkDeriveTypeServiceMock = getGlobalDeriveTypeOfNetwork;

  return {
    __esModule: true,
    default: {
      serviceNetwork: { getGlobalDeriveTypeOfNetwork },
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
    deriveResult?: {
      scopeKey: string;
      revision: number;
      networkId: string;
      deriveType?: string;
      failed?: boolean;
    };
    deriveMethod?: () => Promise<unknown>;
    deriveRun: jest.Mock;
    deriveDeps?: unknown[];
    deriveOptions?: {
      undefinedResultIfReRun?: boolean;
      watchLoading?: boolean;
    };
    accountResult?: unknown;
    accountMethod?: () => Promise<unknown>;
    accountDeps?: unknown[];
    accountOptions?: { swrKey?: string; watchLoading?: boolean };
    accountRun: jest.Mock;
  } = {
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
          result: state.accountResult,
          run: state.accountRun,
          isLoading: false,
        };
      }
      state.deriveMethod = _method;
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
      deriveResult?: {
        scopeKey: string;
        revision: number;
        networkId: string;
        deriveType?: string;
        failed?: boolean;
      };
      deriveMethod?: () => Promise<unknown>;
      deriveRun: jest.Mock;
      deriveDeps?: unknown[];
      deriveOptions?: {
        undefinedResultIfReRun?: boolean;
        watchLoading?: boolean;
      };
      accountResult?: unknown;
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
const networkDeriveTypeServiceMock = (
  globalThis as unknown as {
    __earnNetworkDeriveTypeServiceMock: jest.Mock;
  }
).__earnNetworkDeriveTypeServiceMock;

describe('useEarnAccount cache identity', () => {
  beforeEach(() => {
    act(() => {
      appEventBus.emit(EAppEventBusNames.WalletClear, undefined);
    });
    selectedAccountMock.current.indexedAccountId = 'wallet-1--1';
    selectedAccountMock.current.othersWalletAccountId = undefined;
    selectedAccountMock.current.deriveType = 'default';
    promiseResultMock.deriveResult = undefined;
    promiseResultMock.deriveMethod = undefined;
    promiseResultMock.deriveDeps = undefined;
    promiseResultMock.deriveOptions = undefined;
    promiseResultMock.deriveRun.mockReset();
    promiseResultMock.accountResult = undefined;
    promiseResultMock.accountMethod = undefined;
    promiseResultMock.accountDeps = undefined;
    promiseResultMock.accountOptions = undefined;
    promiseResultMock.accountRun.mockReset();
    earnAccountServiceMock.mockReset().mockResolvedValue(null);
    networkDeriveTypeServiceMock.mockReset().mockResolvedValue('default');
  });

  it('keeps derive loading watched when the network arrives after mount', () => {
    promiseResultMock.deriveResult = undefined;
    const params: { networkId?: string } = {};
    const { rerender } = renderHook(() => useEarnAccount(params));

    expect(promiseResultMock.deriveOptions?.watchLoading).toBe(true);

    params.networkId = 'evm--1';
    rerender(undefined);

    expect(promiseResultMock.deriveDeps?.slice(-2)).toEqual(['evm--1', true]);
    expect(promiseResultMock.deriveOptions?.watchLoading).toBe(true);
  });

  it('keys and fetches with the authoritative derive type of the target network', async () => {
    networkDeriveTypeServiceMock
      .mockResolvedValueOnce('default')
      .mockResolvedValueOnce('ledgerLive');
    const { rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );

    expect(promiseResultMock.deriveOptions?.undefinedResultIfReRun).toBe(true);
    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();
    expect(promiseResultMock.accountOptions?.watchLoading).toBe(true);

    await promiseResultMock.deriveMethod?.();
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

    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();

    await promiseResultMock.deriveMethod?.();
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1::wallet-1--1:ledgerLive:1',
    );

    act(() => {
      appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, undefined);
    });

    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();
    expect(promiseResultMock.accountRun).not.toHaveBeenCalled();
  });

  it('reuses a previously visited network without waiting for another derive request', async () => {
    const params = { networkId: 'evm--1' };
    const { result, rerender } = renderHook(() => useEarnAccount(params));

    await promiseResultMock.deriveMethod?.();
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1::wallet-1--1:default:1',
    );

    params.networkId = 'evm--2';
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    networkDeriveTypeServiceMock.mockResolvedValueOnce('ledgerLive');
    await promiseResultMock.deriveMethod?.();
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--2::wallet-1--1:ledgerLive:1',
    );

    params.networkId = 'evm--1';
    rerender(undefined);

    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1::wallet-1--1:default:1',
    );
    await promiseResultMock.deriveMethod?.();
    expect(networkDeriveTypeServiceMock).toHaveBeenCalledTimes(2);
  });

  it('keeps an HD accountId with indexedAccountId in the derive scope', async () => {
    const { rerender } = renderHook(() =>
      useEarnAccount({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44/60/0/0/0',
      }),
    );

    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();

    await promiseResultMock.deriveMethod?.();
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

    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();
  });

  it('invalidates a cached derive type when the selected account changes in place', async () => {
    const { rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );
    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    expect(promiseResultMock.accountOptions?.swrKey).toContain(':default:1');

    networkDeriveTypeServiceMock.mockResolvedValueOnce('ledgerLive');
    act(() => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();

    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    expect(promiseResultMock.accountOptions?.swrKey).toContain(':ledgerLive:1');
  });

  it('does not reuse another selected account derive type on the same network', async () => {
    const { rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );
    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1::wallet-1--1:default:1',
    );

    selectedAccountMock.current.indexedAccountId = 'wallet-2--1';
    rerender(undefined);
    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();

    networkDeriveTypeServiceMock.mockResolvedValueOnce('ledgerLive');
    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    expect(promiseResultMock.accountOptions?.swrKey).toBe(
      'earnAccount:v3:evm--1::wallet-2--1:ledgerLive:1',
    );
  });

  it('does not publish an in-flight derive result after invalidation', async () => {
    let resolveOldRequest!: (deriveType: string) => void;
    networkDeriveTypeServiceMock.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveOldRequest = resolve;
      }),
    );
    const { rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );
    const oldRequest = promiseResultMock.deriveMethod?.();

    networkDeriveTypeServiceMock.mockResolvedValueOnce('ledgerLive');
    act(() => {
      appEventBus.emit(EAppEventBusNames.NetworkDeriveTypeChanged, undefined);
    });
    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    expect(promiseResultMock.accountOptions?.swrKey).toContain(':ledgerLive:1');

    resolveOldRequest('default');
    await oldRequest;
    rerender(undefined);
    expect(promiseResultMock.accountOptions?.swrKey).toContain(':ledgerLive:1');
  });

  it('does not expose a stale same-key Earn Account after an account update', async () => {
    earnAccountServiceMock
      .mockResolvedValueOnce({ accountAddress: 'old-address' })
      .mockResolvedValueOnce({ accountAddress: 'new-address' });
    const { result, rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );
    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    const initialAccountResult = await promiseResultMock.accountMethod?.();
    promiseResultMock.accountResult = initialAccountResult;
    rerender(undefined);
    expect(result.current.earnAccount?.accountAddress).toBe('old-address');
    const originalSWRKey = promiseResultMock.accountOptions?.swrKey;

    act(() => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    expect(result.current.earnAccount).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    expect(promiseResultMock.accountOptions?.swrKey).toBe(originalSWRKey);
    expect(result.current.earnAccount).toBeUndefined();

    const refreshedAccountResult = await promiseResultMock.accountMethod?.();
    promiseResultMock.accountResult = refreshedAccountResult;
    rerender(undefined);
    expect(result.current.earnAccount?.accountAddress).toBe('new-address');
  });

  it('exposes a failed network derive request and retries that stage', async () => {
    networkDeriveTypeServiceMock.mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );

    promiseResultMock.deriveResult =
      (await promiseResultMock.deriveMethod?.()) as
        | typeof promiseResultMock.deriveResult
        | undefined;
    rerender(undefined);

    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(promiseResultMock.accountOptions?.swrKey).toBeUndefined();

    await act(async () => {
      await result.current.refreshAccount();
    });
    expect(promiseResultMock.deriveRun).toHaveBeenCalledWith({
      alwaysSetState: true,
    });
    expect(promiseResultMock.accountRun).not.toHaveBeenCalled();
  });

  it('exposes a cold Earn Account failure and retries it without re-deriving', async () => {
    earnAccountServiceMock.mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );

    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    promiseResultMock.accountResult = await promiseResultMock.accountMethod?.();
    rerender(undefined);

    expect(result.current.earnAccount).toBeUndefined();
    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.refreshAccount();
    });
    expect(promiseResultMock.accountRun).toHaveBeenCalledWith({
      alwaysSetState: true,
    });
    expect(promiseResultMock.deriveRun).not.toHaveBeenCalled();
  });

  it('treats a resolved null account as a valid public market scope', async () => {
    const { result, rerender } = renderHook(() =>
      useEarnAccount({ networkId: 'evm--1' }),
    );

    await promiseResultMock.deriveMethod?.();
    rerender(undefined);
    promiseResultMock.accountResult = await promiseResultMock.accountMethod?.();
    rerender(undefined);

    expect(result.current.earnAccount).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});
