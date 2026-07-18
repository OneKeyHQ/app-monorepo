/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockTradeSide,
  useSwapStockChannel,
} from './useSwapStockChannel';

const mockSetFromTokenAmount = jest.fn();
const mockSetToTokenAmount = jest.fn();
const mockSetStockSelectedToken = jest.fn();
const mockSelectStockExecutionTokens = jest.fn(() => Promise.resolve());

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      scope: '',
      token: undefined,
      perpsInfo: undefined,
    },
    isLoading: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({
    current: {
      selectStockExecutionTokens: mockSelectStockExecutionTokens,
    },
  }),
  useSwapFromTokenAmountAtom: () => [
    { value: '12.5', isInput: true },
    mockSetFromTokenAmount,
  ],
  useSwapSelectFromTokenAtom: () => [undefined],
  useSwapSelectToTokenAtom: () => [undefined],
  useSwapStockExecutionTokensAtom: () => [undefined],
  useSwapStockSelectedTokenAtom: () => [undefined, mockSetStockSelectedToken],
  useSwapToTokenAmountAtom: () => [
    { value: '3', isInput: false },
    mockSetToTokenAmount,
  ],
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ spotCategories: [] }),
}));

jest.mock('./useSwapStockDefaultToken', () => ({
  useSwapStockDefaultToken: () => ({
    defaultStockTokenLoading: false,
    shouldLoadDefaultStockToken: false,
    stockCategoryType: 'stocks',
  }),
}));

jest.mock('./useSwapStockDisplaySnapshot', () => ({
  useSwapStockDisplaySelectionBootstrap: () => ({
    selection: undefined,
  }),
  useSwapStockDisplaySnapshot: () => ({}),
}));

jest.mock('./useSwapStockMarketWebSocket', () => ({
  useSwapStockMarketWebSocket: () => ({
    realtimeChartPoint: undefined,
    realtimeTokenDetail: undefined,
  }),
}));

jest.mock('./useSwapStockPayTokens', () => ({
  useSwapStockPayTokens: () => ({
    payTokenStatus: 'empty',
    payTokenOptionsLoading: false,
    payTokens: [],
    selectablePayTokens: [],
    speedConfigReady: true,
  }),
}));

const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isStock: true,
};

const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

describe('useSwapStockChannel recent pair selection', () => {
  beforeEach(() => {
    mockSetFromTokenAmount.mockClear();
    mockSetToTokenAmount.mockClear();
    mockSetStockSelectedToken.mockClear();
    mockSelectStockExecutionTokens.mockClear();
  });

  it('preserves the input amount and clears only the derived receive amount', () => {
    const { result } = renderHook(() => useSwapStockChannel());

    act(() => {
      void result.current.selectRecentTokenPair({
        fromToken: usdcToken,
        toToken: appleStockToken,
      });
    });

    expect(result.current.tradeSide).toBe(ESwapStockTradeSide.Buy);
    expect(mockSetFromTokenAmount).not.toHaveBeenCalled();
    expect(mockSetToTokenAmount).toHaveBeenCalledWith({
      value: '',
      isInput: false,
    });
  });

  it('clears both amounts before publishing a recent pair on the other side', () => {
    const { result } = renderHook(() => useSwapStockChannel());

    act(() => {
      void result.current.selectRecentTokenPair({
        fromToken: appleStockToken,
        toToken: usdcToken,
      });
    });

    expect(mockSetFromTokenAmount).toHaveBeenCalledWith({
      value: '',
      isInput: false,
    });
    expect(mockSetToTokenAmount).toHaveBeenCalledWith({
      value: '',
      isInput: false,
    });
    expect(mockSetFromTokenAmount.mock.invocationCallOrder[0]).toBeLessThan(
      mockSelectStockExecutionTokens.mock.invocationCallOrder[0],
    );
  });
});
