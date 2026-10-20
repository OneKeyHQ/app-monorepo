/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';

type ISwapProTestState = {
  initializeSwapProSelectToken: jest.Mock;
  resetQuoteAction: jest.Mock;
  setInputAmount: jest.Mock;
  selectedToken: ISwapToken;
  buyToken?: ISwapToken;
  sellToken?: ISwapToken;
  inputAmount: string;
  direction: ESwapDirection;
  tradeType: ESwapProTradeType;
  tab: ESwapTabSwitchType;
  defaultTokens: ISwapToken[];
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

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
  const state: {
    hasResult: boolean;
    result: unknown;
  } = {
    hasResult: false,
    result: undefined,
  };
  (
    globalThis as unknown as {
      __swapProPromiseResultCalls: typeof calls;
      __swapProPromiseResultState: typeof state;
    }
  ).__swapProPromiseResultCalls = calls;
  (
    globalThis as unknown as {
      __swapProPromiseResultState: typeof state;
    }
  ).__swapProPromiseResultState = state;
  return {
    usePromiseResult: (
      method: () => Promise<unknown>,
      deps: unknown[],
      options: { initResult?: unknown } = {},
    ) => {
      const trackedMethod = async () => {
        const result = await method();
        state.result = result;
        state.hasResult = true;
        return result;
      };
      calls.push({ method: trackedMethod, deps, options });
      return {
        result: state.hasResult ? state.result : options.initResult,
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
  const state: ISwapProTestState = {
    initializeSwapProSelectToken: jest.fn(),
    resetQuoteAction: jest.fn(),
    setInputAmount: jest.fn((value: string) => {
      state.inputAmount = value;
    }),
    inputAmount: '',
    direction: 'sell' as ESwapDirection,
    tradeType: 'market' as ESwapProTradeType,
    tab: 'limit' as ESwapTabSwitchType,
    defaultTokens: [],
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
  const setBuyToken = jest.fn((token?: ISwapToken) => {
    state.buyToken = token;
  });
  const setSellToken = jest.fn((token?: ISwapToken) => {
    state.sellToken = token;
  });
  return {
    useSwapActions: () => ({
      current: {
        beginSwapProTokenBalanceRequest: jest.fn(() => 1),
        finishSwapProTokenBalanceRequest: jest.fn(),
        initializeSwapProSelectToken: state.initializeSwapProSelectToken,
        invalidateSwapProTokenBalanceRequest: jest.fn(),
        isSwapProTokenBalanceRequestLatest: jest.fn(() => true),
        resetQuoteAction: state.resetQuoteAction,
      },
    }),
    useSwapFromTokenAmountAtom: () => [{ value: '', isInput: true }, setter],
    useSwapProDirectionAtom: () => [state.direction],
    useSwapProInputAmountAtom: () => [state.inputAmount, state.setInputAmount],
    useSwapProSelectTokenAtom: () => [state.selectedToken, setter],
    useSwapProSellToTokenAtom: () => [state.sellToken, setSellToken],
    useSwapProTokenBalanceLoadingAtom: () => [false],
    useSwapProTokenSupportLimitAtom: () => [true],
    useSwapProTradeTypeAtom: () => [state.tradeType, setter],
    useSwapProUseSelectBuyTokenAtom: () => [state.buyToken, setBuyToken],
    useSwapTypeSwitchAtom: () => [state.tab],
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/swap', () => {
  const state: { token: ISwapToken | undefined } = { token: undefined };
  (
    globalThis as unknown as {
      __swapProJumpTokenState: typeof state;
    }
  ).__swapProJumpTokenState = state;
  return {
    useSwapProJumpTokenAtom: () => [state, jest.fn()],
  };
});

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
      defaultLimitTokens: (
        globalThis as unknown as {
          __swapProAtomState: ISwapProTestState;
        }
      ).__swapProAtomState.defaultTokens,
      defaultTokens: (
        globalThis as unknown as {
          __swapProAtomState: ISwapProTestState;
        }
      ).__swapProAtomState.defaultTokens,
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
const promiseResultState = (
  globalThis as unknown as {
    __swapProPromiseResultState: {
      hasResult: boolean;
      result: unknown;
    };
  }
).__swapProPromiseResultState;
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
    __swapProAtomState: ISwapProTestState;
  }
).__swapProAtomState;
const swapProJumpTokenState = (
  globalThis as unknown as {
    __swapProJumpTokenState: { token: ISwapToken | undefined };
  }
).__swapProJumpTokenState;

beforeEach(() => {
  selectedAccountState.selectedAccount.deriveType = 'BIP44';
  selectedAccountState.selectedAccount.networkId = 'btc--0';
  accountServices.getGlobalDeriveTypeOfNetwork.mockReset();
  accountServices.getNetworkAccount.mockReset();
  promiseResultCalls.length = 0;
  promiseResultState.hasResult = false;
  promiseResultState.result = undefined;
  swapProJumpTokenState.token = undefined;
  platformEnv.isNative = false;
  swapProAtomState.buyToken = undefined;
  swapProAtomState.sellToken = undefined;
  swapProAtomState.inputAmount = '';
  swapProAtomState.direction = ESwapDirection.SELL;
  swapProAtomState.tradeType = ESwapProTradeType.MARKET;
  swapProAtomState.tab = ESwapTabSwitchType.LIMIT;
  swapProAtomState.defaultTokens = [];
  swapProAtomState.setInputAmount.mockClear();
  swapProAtomState.resetQuoteAction.mockClear();
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

    selectedAccountState.selectedAccount.networkId = 'btc--0';
    selectedAccountState.selectedAccount.deriveType = 'BIP84';
    rerender({});

    expect(result.current.accountScope).toBe('btc--0|indexed-1||BIP84');
    expect(result.current.result).toBe(targetNetworkAccount);
    expect(result.current.accountStatus).toBe('supported');
  });
});

describe('useSwapProTokenInit persistence authority', () => {
  it('does not reload a persisted selection after consuming a jump token', () => {
    swapProAtomState.initializeSwapProSelectToken.mockReset();
    swapProJumpTokenState.token = {
      contractAddress: 'jump-token',
      networkId: 'evm--1',
      symbol: 'JUMP',
    } as ISwapToken;

    const { rerender } = renderHook(() => useSwapProTokenInit());

    expect(
      swapProAtomState.initializeSwapProSelectToken,
    ).not.toHaveBeenCalled();

    swapProJumpTokenState.token = undefined;
    rerender({});

    expect(
      swapProAtomState.initializeSwapProSelectToken,
    ).not.toHaveBeenCalled();
  });

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

describe('useSwapProTokenInit automatic payment token changes', () => {
  const eth: ISwapToken = {
    networkId: 'evm--1',
    contractAddress: '',
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
    balanceParsed: '1',
    price: '1',
  };
  const usdc: ISwapToken = {
    ...eth,
    contractAddress: '0xusdc',
    symbol: 'USDC',
    isNative: false,
  };
  const pepe: ISwapToken = {
    ...usdc,
    contractAddress: '0xpepe',
    symbol: 'PEPE',
  };

  beforeEach(() => {
    platformEnv.isNative = true;
    swapProAtomState.direction = ESwapDirection.BUY;
    swapProAtomState.selectedToken = usdc;
    swapProAtomState.buyToken = eth;
    swapProAtomState.inputAmount = '0.1';
    swapProAtomState.defaultTokens = [eth, usdc];
  });

  it('clears the old denomination and quote when the target excludes the native payment token', () => {
    const { rerender } = renderHook(() => useSwapProTokenInit());
    expect(swapProAtomState.inputAmount).toBe('0.1');

    swapProAtomState.selectedToken = pepe;
    swapProAtomState.defaultTokens = [usdc];
    rerender({});

    expect(swapProAtomState.buyToken).toEqual(usdc);
    expect(swapProAtomState.inputAmount).toBe('');
    expect(swapProAtomState.resetQuoteAction).toHaveBeenCalledTimes(1);
    rerender({});
    expect(swapProAtomState.setInputAmount).toHaveBeenCalledTimes(1);
  });

  it('clears the amount when the new target is the previous payment token', () => {
    const { rerender } = renderHook(() => useSwapProTokenInit());
    swapProAtomState.selectedToken = eth;
    rerender({});

    expect(swapProAtomState.buyToken).toEqual(usdc);
    expect(swapProAtomState.inputAmount).toBe('');
    expect(swapProAtomState.resetQuoteAction).toHaveBeenCalledTimes(1);
  });

  it('preserves the amount when payment token metadata changes without changing identity', () => {
    swapProAtomState.selectedToken = pepe;
    swapProAtomState.buyToken = usdc;
    swapProAtomState.defaultTokens = [usdc];
    const { rerender } = renderHook(() => useSwapProTokenInit());
    swapProAtomState.defaultTokens = [{ ...usdc, price: '1.01' }];
    swapProAtomState.buyToken = {
      ...usdc,
      contractAddress: '0xUSDC',
      price: '1.01',
    };
    rerender({});

    expect(swapProAtomState.inputAmount).toBe('0.1');
    expect(swapProAtomState.setInputAmount).not.toHaveBeenCalled();
    expect(swapProAtomState.resetQuoteAction).not.toHaveBeenCalled();
  });

  it.each([
    ['SELL', { direction: ESwapDirection.SELL }],
    ['Stock', { tab: ESwapTabSwitchType.STOCK }],
    ['Swap', { tab: ESwapTabSwitchType.SWAP }],
    ['Limit order', { tradeType: ESwapProTradeType.LIMIT }],
  ] as const)('preserves amounts and quotes owned by %s', (_label, state) => {
    Object.assign(swapProAtomState, state);
    const { rerender } = renderHook(() => useSwapProTokenInit());
    swapProAtomState.selectedToken = pepe;
    swapProAtomState.defaultTokens = [usdc];
    rerender({});

    expect(swapProAtomState.buyToken).toEqual(usdc);
    expect(swapProAtomState.inputAmount).toBe('0.1');
    expect(swapProAtomState.resetQuoteAction).not.toHaveBeenCalled();
  });

  it('preserves the amount outside native Pro', () => {
    platformEnv.isNative = false;
    const { rerender } = renderHook(() => useSwapProTokenInit());
    swapProAtomState.selectedToken = pepe;
    swapProAtomState.defaultTokens = [usdc];
    rerender({});

    expect(swapProAtomState.buyToken).toEqual(usdc);
    expect(swapProAtomState.inputAmount).toBe('0.1');
    expect(swapProAtomState.resetQuoteAction).not.toHaveBeenCalled();
  });
});
