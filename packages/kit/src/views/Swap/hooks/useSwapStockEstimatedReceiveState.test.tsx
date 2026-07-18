/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { shouldHideStockEstimatedReceive } from '../pages/components/SwapStockDesktopContainer.utils';

import {
  ESwapStockChannelStage,
  ESwapStockTradeSide,
} from './swapStockChannelUtils';
import { useSwapStockEstimatedReceiveState } from './useSwapStockTradeInputs';

import type { IUseSwapStockChannelReturn } from './useSwapStockChannel';

const mockSetToTokenAmount = jest.fn();
const mockSelectPayToken = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapFromTokenAmountAtom: () => [{ value: '1000', isInput: true }],
  useSwapToTokenAmountAtom: () => [
    { value: 'stale-atom-amount', isInput: false },
    mockSetToTokenAmount,
  ],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [
    {
      currencyMap: {
        usd: { unit: '$' },
      },
    },
  ],
  useSettingsPersistAtom: () => [
    {
      currencyInfo: {
        id: 'usd',
        symbol: '$',
      },
    },
  ],
}));

jest.mock('./useSwapStockChannel', () => ({
  ESwapStockChannelAsyncStatus: {
    Empty: 'empty',
    Idle: 'idle',
    Initializing: 'initializing',
    Ready: 'ready',
  },
  ESwapStockTradeSide: {
    Buy: 'buy',
    Sell: 'sell',
  },
}));

const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isStock: true,
};

const payToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

function buildStockChannel(
  tradeSide: ESwapStockTradeSide,
): IUseSwapStockChannelReturn {
  return {
    currentStockToken: stockToken,
    payToken,
    selectablePayTokens: [payToken],
    selectPayToken: mockSelectPayToken,
    tradeSide,
  } as unknown as IUseSwapStockChannelReturn;
}

function buildQuote(tradeSide: ESwapStockTradeSide): IFetchQuoteResult {
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  return {
    fromAmount: '1000',
    fromTokenInfo: isBuySide ? payToken : stockToken,
    info: { provider: 'stock' },
    toAmount: isBuySide ? '10' : '995',
    toTokenInfo: isBuySide ? stockToken : payToken,
  } as IFetchQuoteResult;
}

describe('useSwapStockEstimatedReceiveState', () => {
  beforeEach(() => {
    mockSetToTokenAmount.mockClear();
    mockSelectPayToken.mockClear();
  });

  it.each([
    {
      expectedAmount: '10',
      expectedReceiveToken: stockToken,
      tradeSide: ESwapStockTradeSide.Buy,
    },
    {
      expectedAmount: '995',
      expectedReceiveToken: payToken,
      tradeSide: ESwapStockTradeSide.Sell,
    },
  ])(
    'hides a retained $tradeSide quote without showing request loading when the market closes',
    ({ expectedAmount, expectedReceiveToken, tradeSide }) => {
      const displayQuoteResult = buildQuote(tradeSide);
      const stockChannel = buildStockChannel(tradeSide);
      const { result, rerender } = renderHook(
        ({ channelStage }: { channelStage: ESwapStockChannelStage }) =>
          useSwapStockEstimatedReceiveState({
            displayQuoteResult,
            forceHideQuote: shouldHideStockEstimatedReceive({
              channelStage,
              hasQuoteBlocker: false,
            }),
            quoteEventFetching: false,
            quoteLoading: true,
            quoteResult: displayQuoteResult,
            stockChannel,
          }),
        {
          initialProps: {
            channelStage: ESwapStockChannelStage.Ready,
          },
        },
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.receiveAmount).toBe(expectedAmount);
      expect(result.current.receiveToken).toBe(expectedReceiveToken);
      expect(result.current.isSellSide).toBe(
        tradeSide === ESwapStockTradeSide.Sell,
      );

      rerender({ channelStage: ESwapStockChannelStage.MarketClosed });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.receiveAmount).toBe('');
      expect(result.current.receiveToken).toBe(expectedReceiveToken);
      expect(result.current.isSellSide).toBe(
        tradeSide === ESwapStockTradeSide.Sell,
      );
    },
  );

  it.each([
    {
      channelStage: ESwapStockChannelStage.Ready,
      expectedLoading: true,
      state: 'open and ready',
    },
    {
      channelStage: ESwapStockChannelStage.MarketUnavailable,
      expectedLoading: true,
      state: 'missing optional market detail',
    },
    {
      channelStage: ESwapStockChannelStage.MarketClosed,
      expectedLoading: false,
      state: 'explicitly closed',
    },
  ])(
    'reports quote-request loading as $expectedLoading when the market is $state',
    ({ channelStage, expectedLoading }) => {
      const { result } = renderHook(() =>
        useSwapStockEstimatedReceiveState({
          forceHideQuote: shouldHideStockEstimatedReceive({
            channelStage,
            hasQuoteBlocker: false,
          }),
          quoteEventFetching: false,
          quoteLoading: true,
          stockChannel: buildStockChannel(ESwapStockTradeSide.Buy),
        }),
      );

      expect(result.current.isLoading).toBe(expectedLoading);
      expect(result.current.receiveAmount).toBe('');
    },
  );
});
