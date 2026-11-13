/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { resolveLimitHistoryProPair, useSwapProTokenInit } from './useSwapPro';

let mockSwapType: ESwapTabSwitchType = ESwapTabSwitchType.BRIDGE;
const mockFetchDetail = jest
  .fn<Promise<unknown[]>, unknown[]>()
  .mockResolvedValue([]);
const mockToken = {
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'TOKEN',
  decimals: 18,
  isNative: false,
};
const mockSet = jest.fn();
let mockHistoryState:
  | {
      token?: ISwapToken;
      buy?: ISwapToken;
      sell?: ISwapToken;
      direction: string;
      tradeType: ESwapProTradeType;
      amount: string;
      proAmount: string;
      configReady: boolean;
      networkStatus: 'pending' | 'success';
      limitTokens: ISwapToken[];
    }
  | undefined;
const mockActions = {
  initializeSwapProSelectToken: jest.fn((token?: ISwapToken) => {
    if (mockHistoryState) mockHistoryState.token = token;
  }),
  resetQuoteAction: jest.fn(),
  beginSwapProTokenBalanceRequest: jest.fn(() => 1),
  finishSwapProTokenBalanceRequest: jest.fn(),
  invalidateSwapProTokenBalanceRequest: jest.fn(),
  isSwapProTokenBalanceRequestLatest: jest.fn(() => true),
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/platformEnv')
  >('@onekeyhq/shared/src/platformEnv');
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      isNative: false,
    },
  };
});

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (...args: unknown[]) => mockFetchDetail(...args),
    },
  },
}));

jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({ current: mockActions }),
  useSwapProSelectTokenAtom: () => [
    mockHistoryState ? mockHistoryState.token : mockToken,
    (value?: ISwapToken) => {
      if (mockHistoryState) mockHistoryState.token = value;
    },
  ],
  useSwapProTokenSupportLimitAtom: () => [true],
  useSwapNetworkConfigStatusAtom: () => [
    mockHistoryState?.networkStatus ?? 'success',
  ],
  useSwapLimitPriceUseRateAtom: () => [{}, mockSet],
  useSwapToTokenAmountAtom: () => [{ value: '', isInput: false }, mockSet],
  useSwapProTradeTypeAtom: () => [
    mockHistoryState?.tradeType ?? 'market',
    (value: ESwapProTradeType) => {
      if (mockHistoryState) mockHistoryState.tradeType = value;
    },
  ],
  useSwapProDirectionAtom: () => [
    mockHistoryState?.direction ?? 'SELL',
    (value: string) => {
      if (mockHistoryState) mockHistoryState.direction = value;
    },
  ],
  useSwapProSellToTokenAtom: () => [
    mockHistoryState?.sell,
    (value?: ISwapToken) => {
      if (mockHistoryState) mockHistoryState.sell = value;
    },
  ],
  useSwapProUseSelectBuyTokenAtom: () => [
    mockHistoryState?.buy,
    (value?: ISwapToken) => {
      if (mockHistoryState) mockHistoryState.buy = value;
    },
  ],
  useSwapProInputAmountAtom: () => [
    mockHistoryState?.proAmount ?? '',
    (value: string) => {
      if (mockHistoryState) mockHistoryState.proAmount = value;
    },
  ],
  useSwapFromTokenAmountAtom: () => [
    { value: mockHistoryState?.amount ?? '', isInput: true },
    (value: { value: string }) => {
      if (mockHistoryState) mockHistoryState.amount = value.value;
    },
  ],
  useSwapTypeSwitchAtom: () => [mockSwapType, mockSet],
  useSwapProTokenBalanceLoadingAtom: () => [false],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/swap', () => ({
  useSwapProJumpTokenAtom: () => [{ token: mockToken }, mockSet],
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorStorageInitDoneAtom: () => [true],
  useActiveAccount: () => ({ activeAccount: { ready: false } }),
  useSelectedAccount: () => ({
    selectedAccount: {
      networkId: 'evm--1',
      othersWalletAccountId: 'account-1',
    },
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: { updateSelectedAccountNetwork: mockSet },
  }),
}));

jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _method: unknown,
    _deps: unknown,
    options?: { initResult?: unknown },
  ) =>
    options?.initResult
      ? {
          result: {
            requestScope: 'evm--1||account-1|default',
            scope: 'evm--1||account-1|default',
            account: {
              id: 'account-1',
              addressDetail: { address: '0xaccount' },
            },
          },
        }
      : { result: undefined },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('../../Market/hooks', () => ({ useMarketBasicConfig: jest.fn() }));
jest.mock(
  '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket',
  () => ({ useTransactionsWebSocket: jest.fn() }),
);

describe('limit order history Pro pair', () => {
  const payment = { ...mockToken, contractAddress: '0xpayment', symbol: 'USD' };
  const target = { ...mockToken, contractAddress: '0xasset' };

  it('uses the configured payment token to determine BUY and SELL', () => {
    expect(
      resolveLimitHistoryProPair({
        fromToken: payment,
        toToken: target,
        defaultLimitTokens: [payment],
      }),
    ).toEqual({ direction: 'BUY', target, pay: payment });
    expect(
      resolveLimitHistoryProPair({
        fromToken: target,
        toToken: payment,
        defaultLimitTokens: [payment],
      }),
    ).toEqual({ direction: 'SELL', target, pay: payment });
  });

  it('chooses BUY when both tokens can be used as payment', () => {
    expect(
      resolveLimitHistoryProPair({
        fromToken: payment,
        toToken: target,
        defaultLimitTokens: [payment, target],
      }),
    ).toEqual({ direction: 'BUY', target, pay: payment });
  });

  it('does not infer a direction from unsupported tokens', () => {
    expect(
      resolveLimitHistoryProPair({
        fromToken: payment,
        toToken: target,
        defaultLimitTokens: [],
      }),
    ).toBeUndefined();
    expect(
      resolveLimitHistoryProPair({
        fromToken: payment,
        toToken: { ...target, networkId: 'evm--56' },
        defaultLimitTokens: [payment],
      }),
    ).toBeUndefined();
  });
});
jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapInit',
  () => ({
    useSpeedSwapInit: () => ({
      defaultTokens: [],
      defaultLimitTokens: mockHistoryState?.limitTokens ?? [],
      speedConfigReady: mockHistoryState?.configReady,
    }),
  }),
);
jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType',
  () => ({ ESwapDirection: { BUY: 'BUY', SELL: 'SELL' } }),
);

describe('Swap Pro token synchronization ownership', () => {
  beforeEach(() => {
    mockFetchDetail.mockClear();
    Object.assign(platformEnv, { isNative: false });
    mockSwapType = ESwapTabSwitchType.BRIDGE;
  });

  it('does not fetch Pro token details on Desktop regular or limit pages', () => {
    const { rerender } = renderHook(() => useSwapProTokenInit());
    expect(mockFetchDetail).not.toHaveBeenCalled();
    mockSwapType = ESwapTabSwitchType.LIMIT;
    rerender();
    expect(mockFetchDetail).not.toHaveBeenCalled();
  });

  it('starts synchronization when native enters Pro and stops it after leaving', async () => {
    Object.assign(platformEnv, { isNative: true });
    const { rerender } = renderHook(() => useSwapProTokenInit());
    expect(mockFetchDetail).not.toHaveBeenCalled();
    mockSwapType = ESwapTabSwitchType.LIMIT;
    rerender();
    await waitFor(() => expect(mockFetchDetail).toHaveBeenCalledTimes(1));
    expect(mockFetchDetail).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: 'evm--1', accountId: 'account-1' }),
    );
    mockFetchDetail.mockClear();
    mockSwapType = ESwapTabSwitchType.BRIDGE;
    rerender();
    expect(mockFetchDetail).not.toHaveBeenCalled();
    mockSwapType = ESwapTabSwitchType.STOCK;
    rerender();
    expect(mockFetchDetail).not.toHaveBeenCalled();
    mockSwapType = ESwapTabSwitchType.LIMIT;
    rerender();
    await waitFor(() => expect(mockFetchDetail).toHaveBeenCalledTimes(1));
  });
});

describe('native Pro limit history handoff', () => {
  const payment = { ...mockToken, contractAddress: '0xpayment', symbol: 'USD' };
  const target = { ...mockToken, contractAddress: '0xasset' };
  const historyIntent = {
    key: 'history-1',
    params: {
      tradeAgainFromHistory: true,
      swapTabSwitchType: ESwapTabSwitchType.LIMIT,
      importFromToken: payment,
      importToToken: target,
      fromAmount: '12.345',
    },
    claim: jest.fn(() => true),
  };

  beforeEach(() => {
    Object.assign(platformEnv, { isNative: true });
    mockSwapType = ESwapTabSwitchType.LIMIT;
    historyIntent.claim.mockClear();
    mockHistoryState = {
      token: mockToken,
      direction: 'SELL',
      tradeType: ESwapProTradeType.MARKET,
      amount: 'old',
      proAmount: 'old',
      configReady: true,
      networkStatus: 'success',
      limitTokens: [payment],
    };
  });

  afterEach(() => {
    mockHistoryState = undefined;
  });

  it('restores the correct pair, limit mode and input amount', () => {
    const { rerender } = renderHook(() => useSwapProTokenInit(historyIntent));
    rerender();
    expect(mockHistoryState).toEqual(
      expect.objectContaining({
        token: target,
        buy: payment,
        direction: 'BUY',
        tradeType: ESwapProTradeType.LIMIT,
        amount: '12.345',
      }),
    );
    expect(historyIntent.claim).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite input entered while configuration is loading', () => {
    expect(mockHistoryState).toBeDefined();
    if (!mockHistoryState) return;
    mockHistoryState.configReady = false;
    const { rerender } = renderHook(() => useSwapProTokenInit(historyIntent));
    mockHistoryState.amount = '77';
    mockHistoryState.configReady = true;
    rerender();
    expect(mockHistoryState.amount).toBe('77');
    expect(mockHistoryState.token).toBeUndefined();
  });

  it('does not restore an intent after leaving the tab', () => {
    expect(mockHistoryState).toBeDefined();
    if (!mockHistoryState) return;
    mockHistoryState.configReady = false;
    const { rerender } = renderHook(() => useSwapProTokenInit(historyIntent));
    mockSwapType = ESwapTabSwitchType.SWAP;
    rerender();
    mockHistoryState.configReady = true;
    mockSwapType = ESwapTabSwitchType.LIMIT;
    rerender();
    expect(mockHistoryState.amount).toBe('');
    expect(mockHistoryState.token).toBeUndefined();
  });
});
