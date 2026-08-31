/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';

import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

jest.mock('../../../background/instance/backgroundApiProxy', () => {
  const getGlobalDeriveTypeOfNetwork = jest.fn();
  const getNetworkAccount = jest.fn();
  (
    globalThis as unknown as {
      __swapProAccountServices: {
        getGlobalDeriveTypeOfNetwork: typeof getGlobalDeriveTypeOfNetwork;
        getNetworkAccount: typeof getNetworkAccount;
      };
    }
  ).__swapProAccountServices = {
    getGlobalDeriveTypeOfNetwork,
    getNetworkAccount,
  };
  return {
    __esModule: true,
    default: {
      simpleDb: {
        marketTokenPreference: { getPreference: jest.fn() },
      },
      serviceAccount: { getNetworkAccount },
      serviceNetwork: { getGlobalDeriveTypeOfNetwork },
    },
  };
});

jest.mock('../../../hooks/usePromiseResult', () => {
  const calls: Array<{
    deps: unknown[];
    method: () => Promise<unknown>;
    options: { initResult?: unknown };
  }> = [];
  const results = new Map<string, unknown>();
  (
    globalThis as unknown as {
      __swapProPromiseResultCalls: typeof calls;
      __swapProPromiseResults: typeof results;
    }
  ).__swapProPromiseResultCalls = calls;
  (
    globalThis as unknown as {
      __swapProPromiseResults: typeof results;
    }
  ).__swapProPromiseResults = results;
  return {
    usePromiseResult: (
      method: () => Promise<unknown>,
      deps: unknown[],
      options: { initResult?: unknown } = {},
    ) => {
      const key = JSON.stringify(deps);
      const trackedMethod = async () => {
        const result = await method();
        results.set(key, result);
        return result;
      };
      calls.push({ method: trackedMethod, deps, options });
      return {
        result: results.get(key) ?? options.initResult,
        isLoading: false,
        run: jest.fn(),
      };
    },
  };
});

jest.mock('../../../states/jotai/contexts/accountSelector', () => {
  const state = {
    selectedAccount: {
      deriveType: 'BIP44',
      focusedWallet: 'hd-1',
      indexedAccountId: 'indexed-1',
      networkId: 'btc--0',
      othersWalletAccountId: undefined,
      walletId: 'hd-1',
    },
  };
  (
    globalThis as unknown as {
      __swapProSelectedAccountState: typeof state;
    }
  ).__swapProSelectedAccountState = state;
  return {
    useAccountSelectorStorageInitDoneAtom: () => [true],
    useActiveAccount: () => ({
      activeAccount: {
        indexedAccount: { id: 'indexed-1' },
        ready: true,
      },
    }),
    useSelectedAccount: () => ({ selectedAccount: state.selectedAccount }),
  };
});

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: { updateSelectedAccountNetwork: jest.fn() },
  }),
}));

jest.mock('../../../states/jotai/contexts/swap', () => {
  const state: {
    initializeSwapProSelectToken: jest.Mock;
    selectedToken: ISwapToken;
  } = {
    initializeSwapProSelectToken: jest.fn(),
    selectedToken: {
      accountAddress: undefined,
      balanceParsed: '1',
      contractAddress: 'btc',
      isNative: true,
      networkId: 'btc--0',
      symbol: 'BTC',
    } as ISwapToken,
  };
  (
    globalThis as unknown as {
      __swapProAtomState: typeof state;
    }
  ).__swapProAtomState = state;
  const setter = jest.fn();
  return {
    useSwapActions: () => ({
      current: {
        beginSwapProTokenBalanceRequest: jest.fn(() => 1),
        finishSwapProTokenBalanceRequest: jest.fn(),
        initializeSwapProSelectToken: state.initializeSwapProSelectToken,
        invalidateSwapProTokenBalanceRequest: jest.fn(),
        isSwapProTokenBalanceRequestLatest: jest.fn(() => true),
        resetQuoteAction: jest.fn(),
      },
    }),
    useSwapFromTokenAmountAtom: () => [{ value: '', isInput: true }, setter],
    useSwapProDirectionAtom: () => ['sell'],
    useSwapProInputAmountAtom: () => ['', setter],
    useSwapProSelectTokenAtom: () => [state.selectedToken, setter],
    useSwapProSellToTokenAtom: () => [undefined, setter],
    useSwapProTokenBalanceLoadingAtom: () => [false],
    useSwapProTokenSupportLimitAtom: () => [true],
    useSwapProTradeTypeAtom: () => ['market', setter],
    useSwapProUseSelectBuyTokenAtom: () => [undefined, setter],
    useSwapTypeSwitchAtom: () => ['limit'],
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/swap', () => ({
  useSwapProJumpTokenAtom: () => [{ token: undefined }, jest.fn()],
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('../../Market/hooks', () => ({
  useMarketBasicConfig: jest.fn(),
}));

jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapInit',
  () => ({
    useSpeedSwapInit: () => ({
      defaultLimitTokens: [],
      defaultTokens: [],
      isLoading: false,
      onlySupportCrossChain: false,
      speedConfig: undefined,
      speedConfigReady: true,
      speedDefaultSelectToken: undefined,
      supportSpeedSwap: true,
      swapMevNetConfig: [],
    }),
  }),
);

jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: jest.fn(),
}));

jest.mock('./useSwapState', () => ({
  useSwapSlippagePercentageModeInfo: jest.fn(),
}));

import { useSwapProAccount, useSwapProTokenInit } from './useSwapPro';

const accountServices = (
  globalThis as unknown as {
    __swapProAccountServices: {
      getGlobalDeriveTypeOfNetwork: jest.Mock;
      getNetworkAccount: jest.Mock;
    };
  }
).__swapProAccountServices;
const promiseResultCalls = (
  globalThis as unknown as {
    __swapProPromiseResultCalls: Array<{
      deps: unknown[];
      method: () => Promise<unknown>;
      options: { initResult?: unknown };
    }>;
  }
).__swapProPromiseResultCalls;
const promiseResults = (
  globalThis as unknown as {
    __swapProPromiseResults: Map<string, unknown>;
  }
).__swapProPromiseResults;
const selectedAccountState = (
  globalThis as unknown as {
    __swapProSelectedAccountState: {
      selectedAccount: {
        deriveType: string;
        focusedWallet: string;
        indexedAccountId: string;
        networkId: string;
        othersWalletAccountId: undefined;
        walletId: string;
      };
    };
  }
).__swapProSelectedAccountState;
const swapProAtomState = (
  globalThis as unknown as {
    __swapProAtomState: {
      initializeSwapProSelectToken: jest.Mock;
      selectedToken: ISwapToken;
    };
  }
).__swapProAtomState;

beforeEach(() => {
  selectedAccountState.selectedAccount.deriveType = 'BIP44';
  selectedAccountState.selectedAccount.networkId = 'btc--0';
  accountServices.getGlobalDeriveTypeOfNetwork.mockReset();
  accountServices.getNetworkAccount.mockReset();
  promiseResultCalls.length = 0;
  promiseResults.clear();
});

describe('useSwapProAccount cache identity', () => {
  it('resolves and caches the selected alternate derive type', async () => {
    const bip44Account = {
      addressDetail: { address: 'bc1q-bip44', networkId: 'btc--0' },
      id: 'btc-bip44-account',
    } as INetworkAccount;
    const bip84Account = {
      addressDetail: { address: 'bc1q-bip84', networkId: 'btc--0' },
      id: 'btc-bip84-account',
    } as INetworkAccount;
    accountServices.getGlobalDeriveTypeOfNetwork.mockResolvedValue('BIP84');
    accountServices.getNetworkAccount.mockImplementation(
      async ({ deriveType }: { deriveType: string }) =>
        deriveType === 'BIP44' ? bip44Account : bip84Account,
    );

    const { result, rerender } = renderHook(() => useSwapProAccount());

    expect(result.current.accountScope).toBe('btc--0|indexed-1||BIP44');
    expect(result.current.result).toBeUndefined();

    let resolvedBip44State: unknown;
    await act(async () => {
      resolvedBip44State = await promiseResultCalls.at(-1)?.method();
    });
    expect(resolvedBip44State).toEqual({
      account: bip44Account,
      requestScope: 'btc--0|indexed-1||BIP44',
      scope: 'btc--0|indexed-1||BIP44',
    });
    expect(accountServices.getGlobalDeriveTypeOfNetwork).not.toHaveBeenCalled();
    expect(accountServices.getNetworkAccount).toHaveBeenLastCalledWith(
      expect.objectContaining({ deriveType: 'BIP44' }),
    );

    rerender({});
    expect(result.current.result).toBe(bip44Account);
    expect(result.current.accountStatus).toBe('supported');

    selectedAccountState.selectedAccount.deriveType = 'BIP84';
    rerender({});

    expect(result.current.accountScope).toBe('btc--0|indexed-1||BIP84');
    expect(result.current.result).toBeUndefined();

    let resolvedBip84State: unknown;
    await act(async () => {
      resolvedBip84State = await promiseResultCalls.at(-1)?.method();
    });
    expect(resolvedBip84State).toEqual({
      account: bip84Account,
      requestScope: 'btc--0|indexed-1||BIP84',
      scope: 'btc--0|indexed-1||BIP84',
    });
    expect(accountServices.getNetworkAccount).toHaveBeenLastCalledWith(
      expect.objectContaining({ deriveType: 'BIP84' }),
    );

    rerender({});
    expect(result.current.result).toBe(bip84Account);
    expect(result.current.accountStatus).toBe('supported');
  });

  it('uses the target network derive type when the selector is on another network', async () => {
    const targetNetworkAccount = {
      addressDetail: { address: 'bc1q-bip84', networkId: 'btc--0' },
      id: 'btc-bip84-account',
    } as INetworkAccount;
    selectedAccountState.selectedAccount.networkId = 'evm--1';
    accountServices.getGlobalDeriveTypeOfNetwork.mockResolvedValue('BIP84');
    accountServices.getNetworkAccount.mockResolvedValue(targetNetworkAccount);

    const { result, rerender } = renderHook(() => useSwapProAccount());

    expect(result.current.accountScope).toBe('');
    expect(result.current.accountStatus).toBe('pending');

    let resolvedState: unknown;
    await act(async () => {
      resolvedState = await promiseResultCalls.at(-1)?.method();
    });
    expect(resolvedState).toEqual({
      account: targetNetworkAccount,
      requestScope: 'btc--0|indexed-1||network-default',
      scope: 'btc--0|indexed-1||BIP84',
    });
    expect(accountServices.getGlobalDeriveTypeOfNetwork).toHaveBeenCalledWith({
      networkId: 'btc--0',
    });
    expect(accountServices.getNetworkAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        deriveType: 'BIP84',
        networkId: 'btc--0',
      }),
    );

    rerender({});
    expect(result.current.accountScope).toBe('btc--0|indexed-1||BIP84');
    expect(result.current.result).toBe(targetNetworkAccount);
    expect(result.current.accountStatus).toBe('supported');
  });
});

describe('useSwapProTokenInit persistence authority', () => {
  it('delegates cold-start reconciliation to the shared persistence action', async () => {
    swapProAtomState.initializeSwapProSelectToken.mockReset();

    renderHook(() => useSwapProTokenInit());

    await act(async () => {
      await Promise.resolve();
    });
    expect(swapProAtomState.initializeSwapProSelectToken).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
  });
});
