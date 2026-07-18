/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  getStockAmountInputInteractionProps,
  shouldHideStockEstimatedReceive,
} from '../pages/components/SwapStockDesktopContainer.utils';

import {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
  getTokenIdentityKey,
} from './swapStockChannelUtils';
import {
  useSwapStockAmountInputState,
  useSwapStockEstimatedReceiveState,
} from './useSwapStockTradeInputs';

import type { IUseSwapStockChannelReturn } from './useSwapStockChannel';

const mockSetToTokenAmount = jest.fn();
const mockSelectPayToken = jest.fn();
const mockSetFromTokenAmount = jest.fn();
const mockSetSwapAlerts = jest.fn();
const mockSetFromTokenBalance = jest.fn();
const mockResetQuoteAction = jest.fn();

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { ready: false },
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _callback: unknown,
    _dependencies: unknown,
    options?: { initResult?: unknown },
  ) => ({
    result: options?.initResult,
    isLoading: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({
    current: { resetQuoteAction: mockResetQuoteAction },
  }),
  useSwapAlertsAtom: () => [undefined, mockSetSwapAlerts],
  useSwapFromTokenAmountAtom: () => [
    { value: '1000', isInput: true },
    mockSetFromTokenAmount,
  ],
  useSwapStockSelectedFromTokenBalanceAtom: () => ['', mockSetFromTokenBalance],
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

function buildAmountInputStockChannel({
  channelStage,
  tradeSide,
}: {
  channelStage: ESwapStockChannelStage;
  tradeSide: ESwapStockTradeSide;
}): IUseSwapStockChannelReturn {
  const amountIdentity = {
    accountKey: 'account-1',
    stockTokenKey: getTokenIdentityKey(stockToken),
    payTokenKey: getTokenIdentityKey(payToken),
    tradeSide,
    amountSessionId: 0,
  };
  return {
    channelStage,
    currentStockToken: stockToken,
    disableNativePayToken: false,
    payToken,
    payTokenOptionsLoading: false,
    payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
    payTokens: [payToken],
    selectablePayTokens: [payToken],
    selectPayToken: mockSelectPayToken,
    stockDisplay: {
      amount: {
        commitSnapshot: jest.fn(),
        identity: amountIdentity,
        ownerKey: 'account-1|stock|pay|side',
        restoredValue: '1000',
      },
      commitSnapshotPatch: jest.fn(),
      identityKey: 'display-owner',
      selection: { snapshot: undefined },
      snapshot: undefined,
    },
    stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
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
    mockResetQuoteAction.mockClear();
    mockSetFromTokenAmount.mockClear();
    mockSetFromTokenBalance.mockClear();
    mockSetSwapAlerts.mockClear();
    mockSetToTokenAmount.mockClear();
    mockSelectPayToken.mockClear();
  });

  it.each([
    { tradeSide: ESwapStockTradeSide.Buy },
    { tradeSide: ESwapStockTradeSide.Sell },
  ])(
    'keeps the canonical $tradeSide amount owner editable across a ready-to-closed transition',
    ({ tradeSide }) => {
      const readyChannel = buildAmountInputStockChannel({
        channelStage: ESwapStockChannelStage.Ready,
        tradeSide,
      });
      const closedChannel = buildAmountInputStockChannel({
        channelStage: ESwapStockChannelStage.MarketClosed,
        tradeSide,
      });
      const { result, rerender } = renderHook(
        ({ stockChannel }: { stockChannel: IUseSwapStockChannelReturn }) => {
          const inputState = useSwapStockAmountInputState({ stockChannel });
          return getStockAmountInputInteractionProps(inputState.inputEditable);
        },
        { initialProps: { stockChannel: readyChannel } },
      );

      expect(result.current).toEqual({ readonly: false });

      rerender({ stockChannel: closedChannel });

      expect(result.current).toEqual({ readonly: false });
    },
  );

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
    'maps the upstream loading signal to $expectedLoading when the market is $state',
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
