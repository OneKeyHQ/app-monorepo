/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { ESwapStockMarketQuoteGateStatus } from '../../../states/jotai/contexts/swap/stockMarketQuoteGate';

import { getTokenIdentityKey } from './swapStockChannelUtils';
import {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
  useSwapStockChannel,
} from './useSwapStockChannel';

const mockSetFromTokenAmount = jest.fn();
const mockSetToTokenAmount = jest.fn();
const mockSetStockSelectedToken = jest.fn();
const mockSelectStockExecutionTokens = jest.fn(() => Promise.resolve());
const mockSetSwapStockMarketQuoteGate = jest.fn();
let mockSelectedFromToken: ISwapToken | undefined;
let mockSelectedToToken: ISwapToken | undefined;
let mockStockExecutionTokens:
  | { fromToken: ISwapToken; toToken: ISwapToken; syncId: number }
  | undefined;
let mockStockSelectedToken: ISwapToken | undefined;
let mockStockTokenDetailState:
  | {
      scope: string;
      token?: {
        stock?: {
          description?: string;
          isOpen?: boolean;
        };
      };
      perpsInfo?: undefined;
      fetchedAt?: number;
    }
  | undefined;
let mockPayTokenStatus: ESwapStockChannelAsyncStatus;
let mockPayTokens: ISwapToken[];

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: mockStockTokenDetailState,
    isLoading: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({
    current: {
      selectStockExecutionTokens: mockSelectStockExecutionTokens,
      setSwapStockMarketQuoteGate: mockSetSwapStockMarketQuoteGate,
    },
  }),
  useSwapFromTokenAmountAtom: () => [
    { value: '12.5', isInput: true },
    mockSetFromTokenAmount,
  ],
  useSwapSelectFromTokenAtom: () => [mockSelectedFromToken],
  useSwapSelectToTokenAtom: () => [mockSelectedToToken],
  useSwapStockExecutionTokensAtom: () => [mockStockExecutionTokens],
  useSwapStockSelectedTokenAtom: () => [
    mockStockSelectedToken,
    mockSetStockSelectedToken,
  ],
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
  useSwapStockMarketWebSocket: ({
    tokenDetail,
  }: {
    tokenDetail?: unknown;
  }) => ({
    realtimeChartPoint: undefined,
    realtimeTokenDetail: tokenDetail,
  }),
}));

jest.mock('./useSwapStockPayTokens', () => ({
  useSwapStockPayTokens: () => ({
    payTokenStatus: mockPayTokenStatus,
    payTokenOptionsLoading: false,
    payTokens: mockPayTokens,
    selectablePayTokens: mockPayTokens,
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

const teslaStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xtsla',
  symbol: 'TSLA',
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
    mockSetSwapStockMarketQuoteGate.mockClear();
    mockSelectedFromToken = undefined;
    mockSelectedToToken = undefined;
    mockStockExecutionTokens = undefined;
    mockStockSelectedToken = undefined;
    mockStockTokenDetailState = {
      scope: '',
      token: undefined,
      perpsInfo: undefined,
    };
    mockPayTokenStatus = ESwapStockChannelAsyncStatus.Empty;
    mockPayTokens = [];
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

  it.each([
    {
      name: 'Ready',
      isOpen: true,
      payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      expectedStage: ESwapStockChannelStage.Ready,
      expectedGateStatus: ESwapStockMarketQuoteGateStatus.Allowed,
    },
    {
      name: 'MarketClosed',
      isOpen: false,
      payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      expectedStage: ESwapStockChannelStage.MarketClosed,
      expectedGateStatus: ESwapStockMarketQuoteGateStatus.Closed,
    },
    {
      name: 'MarketUnavailable with a ready pay token',
      isOpen: undefined,
      payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
      expectedStage: ESwapStockChannelStage.MarketUnavailable,
      expectedGateStatus: ESwapStockMarketQuoteGateStatus.Allowed,
    },
    {
      name: 'MarketUnavailable before the pay token is ready',
      isOpen: undefined,
      payTokenStatus: ESwapStockChannelAsyncStatus.Empty,
      expectedStage: ESwapStockChannelStage.MarketUnavailable,
      expectedGateStatus: ESwapStockMarketQuoteGateStatus.Checking,
    },
    {
      name: 'MissingPayToken',
      isOpen: true,
      payTokenStatus: ESwapStockChannelAsyncStatus.Empty,
      expectedStage: ESwapStockChannelStage.MissingPayToken,
      expectedGateStatus: ESwapStockMarketQuoteGateStatus.Checking,
    },
  ])(
    'publishes the owned market quote gate for $name',
    ({ expectedGateStatus, expectedStage, isOpen, payTokenStatus }) => {
      const stockTokenKey = getTokenIdentityKey(appleStockToken);
      mockSelectedFromToken = usdcToken;
      mockSelectedToToken = appleStockToken;
      mockStockExecutionTokens = {
        fromToken: usdcToken,
        toToken: appleStockToken,
        syncId: 1,
      };
      mockStockSelectedToken = appleStockToken;
      mockStockTokenDetailState = {
        scope: stockTokenKey,
        token: {
          stock: {
            description: isOpen === undefined ? 'status unavailable' : '',
            isOpen,
          },
        },
        perpsInfo: undefined,
        fetchedAt: Date.now(),
      };
      mockPayTokenStatus = payTokenStatus;
      mockPayTokens =
        payTokenStatus === ESwapStockChannelAsyncStatus.Ready
          ? [usdcToken]
          : [];

      const { result } = renderHook(() => useSwapStockChannel());

      expect(result.current.channelStage).toBe(expectedStage);
      expect(mockSetSwapStockMarketQuoteGate).toHaveBeenLastCalledWith({
        ownerStockKey: stockTokenKey,
        status: expectedGateStatus,
      });
    },
  );

  it('publishes the Ready -> Closed -> Ready market gate transition for the same owner', () => {
    const stockTokenKey = getTokenIdentityKey(appleStockToken);
    mockSelectedFromToken = usdcToken;
    mockSelectedToToken = appleStockToken;
    mockStockExecutionTokens = {
      fromToken: usdcToken,
      toToken: appleStockToken,
      syncId: 1,
    };
    mockStockSelectedToken = appleStockToken;
    mockPayTokenStatus = ESwapStockChannelAsyncStatus.Ready;
    mockPayTokens = [usdcToken];
    mockStockTokenDetailState = {
      scope: stockTokenKey,
      token: { stock: { isOpen: true } },
      perpsInfo: undefined,
      fetchedAt: Date.now(),
    };

    const { rerender } = renderHook(() => useSwapStockChannel());

    mockStockTokenDetailState = {
      scope: stockTokenKey,
      token: { stock: { isOpen: false } },
      perpsInfo: undefined,
      fetchedAt: Date.now(),
    };
    rerender();

    mockStockTokenDetailState = {
      scope: stockTokenKey,
      token: { stock: { isOpen: true } },
      perpsInfo: undefined,
      fetchedAt: Date.now(),
    };
    rerender();

    expect(mockSetSwapStockMarketQuoteGate.mock.calls).toEqual([
      [
        {
          ownerStockKey: stockTokenKey,
          status: ESwapStockMarketQuoteGateStatus.Allowed,
        },
      ],
      [
        {
          ownerStockKey: stockTokenKey,
          status: ESwapStockMarketQuoteGateStatus.Closed,
        },
      ],
      [
        {
          ownerStockKey: stockTokenKey,
          status: ESwapStockMarketQuoteGateStatus.Allowed,
        },
      ],
    ]);
  });

  it('publishes the new owner as Checking until that stock detail lands, ignoring a late detail from the previous owner', () => {
    const appleStockKey = getTokenIdentityKey(appleStockToken);
    const teslaStockKey = getTokenIdentityKey(teslaStockToken);
    mockSelectedFromToken = usdcToken;
    mockSelectedToToken = appleStockToken;
    mockStockExecutionTokens = {
      fromToken: usdcToken,
      toToken: appleStockToken,
      syncId: 1,
    };
    mockStockSelectedToken = appleStockToken;
    mockPayTokenStatus = ESwapStockChannelAsyncStatus.Ready;
    mockPayTokens = [usdcToken];
    mockStockTokenDetailState = {
      scope: appleStockKey,
      token: { stock: { isOpen: true } },
      perpsInfo: undefined,
      fetchedAt: Date.now(),
    };

    const { rerender } = renderHook(() => useSwapStockChannel());
    expect(mockSetSwapStockMarketQuoteGate).toHaveBeenLastCalledWith({
      ownerStockKey: appleStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    });
    mockSetSwapStockMarketQuoteGate.mockClear();

    mockSelectedFromToken = usdcToken;
    mockSelectedToToken = teslaStockToken;
    mockStockExecutionTokens = {
      fromToken: usdcToken,
      toToken: teslaStockToken,
      syncId: 2,
    };
    mockStockSelectedToken = teslaStockToken;
    // A late AAPL response is still visible to the async result holder.
    // It must never authorize or close TSLA's owner gate.
    rerender();

    expect(mockSetSwapStockMarketQuoteGate).toHaveBeenLastCalledWith({
      ownerStockKey: teslaStockKey,
      status: ESwapStockMarketQuoteGateStatus.Checking,
    });
    expect(mockSetSwapStockMarketQuoteGate).not.toHaveBeenCalledWith({
      ownerStockKey: teslaStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    });

    mockStockTokenDetailState = {
      scope: teslaStockKey,
      token: { stock: { isOpen: false } },
      perpsInfo: undefined,
      fetchedAt: Date.now(),
    };
    rerender();

    expect(mockSetSwapStockMarketQuoteGate).toHaveBeenLastCalledWith({
      ownerStockKey: teslaStockKey,
      status: ESwapStockMarketQuoteGateStatus.Closed,
    });

    mockStockTokenDetailState = {
      scope: teslaStockKey,
      token: { stock: { isOpen: true } },
      perpsInfo: undefined,
      fetchedAt: Date.now(),
    };
    rerender();

    expect(mockSetSwapStockMarketQuoteGate).toHaveBeenLastCalledWith({
      ownerStockKey: teslaStockKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    });
  });
});
