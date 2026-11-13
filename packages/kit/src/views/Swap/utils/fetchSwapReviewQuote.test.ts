import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  IFetchSwapQuoteParams,
  ISwapQuoteEventPayload,
} from '@onekeyhq/shared/types/swap/types';

const mockFetchQuotesEvents: jest.MockedFunction<
  typeof backgroundApiProxy.serviceSwap.fetchQuotesEvents
> = jest.fn();
const mockCancelFetchQuoteEvents = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchQuotesEvents: mockFetchQuotesEvents,
      cancelFetchQuoteEvents: mockCancelFetchQuoteEvents,
    },
  },
}));

const { fetchSwapReviewQuote } =
  require('./fetchSwapReviewQuote') as typeof import('./fetchSwapReviewQuote');

const fromToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'FROM',
  decimals: 18,
};
const toToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'TO',
  decimals: 18,
};
const params: IFetchSwapQuoteParams = {
  fromToken,
  toToken,
  fromTokenAmount: '10',
  slippagePercentage: 1,
  autoSlippage: false,
  kind: ESwapQuoteKind.SELL,
  protocol: ESwapTabSwitchType.SWAP,
};
const quote: IFetchQuoteResult = {
  info: { provider: 'SwapOKX', providerName: 'OKX' },
  eventId: 'event-1',
  protocol: EProtocolOfExchange.SWAP,
  kind: ESwapQuoteKind.SELL,
  fromTokenInfo: fromToken,
  toTokenInfo: toToken,
  fromAmount: '10',
  toAmount: '9',
};

function emitEvent(
  requestIndex: number,
  event: ISwapQuoteEventPayload['event'],
) {
  const request = mockFetchQuotesEvents.mock.calls[requestIndex][0];
  appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
    quoteRequestId: request.quoteRequestId ?? '',
    accountId: request.accountId,
    type:
      event.type === 'exception' || event.type === 'timeout'
        ? 'error'
        : event.type,
    event,
    tokenPairs: { fromToken: request.fromToken, toToken: request.toToken },
    params: {
      fromNetworkId: request.fromToken.networkId,
      toNetworkId: request.toToken.networkId,
      fromTokenAddress: request.fromToken.contractAddress,
      toTokenAddress: request.toToken.contractAddress,
      fromTokenAmount: request.fromTokenAmount,
      protocol: request.protocol,
      slippagePercentage: request.slippagePercentage,
    },
  });
}

function emitMessage(requestIndex: number, data: unknown) {
  emitEvent(requestIndex, {
    type: 'message',
    data: JSON.stringify(data),
    lastEventId: null,
    url: '',
  });
}

describe('fetchSwapReviewQuote', () => {
  beforeEach(() => {
    mockFetchQuotesEvents.mockReset().mockResolvedValue(undefined);
    mockCancelFetchQuoteEvents.mockReset().mockResolvedValue(undefined);
  });

  it('ignores unrelated providers and amounts before resolving the selected quote', async () => {
    const operation = fetchSwapReviewQuote({
      params,
      expectedQuote: quote,
      getErrorMessage: () => 'localized retry message',
      signal: new AbortController().signal,
    });
    emitMessage(0, {
      data: [
        { ...quote, info: { provider: 'other', providerName: 'Other' } },
        { ...quote, fromAmount: '11' },
        quote,
      ],
    });
    await expect(operation).resolves.toEqual(quote);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      mockFetchQuotesEvents.mock.calls[0][0].quoteRequestId,
    );
  });

  it('waits for matching automatic slippage and ignores another event id', async () => {
    const operation = fetchSwapReviewQuote({
      params: { ...params, autoSlippage: true },
      expectedQuote: quote,
      getErrorMessage: () => 'localized retry message',
      signal: new AbortController().signal,
    });
    emitMessage(0, { data: [quote] });
    emitMessage(0, {
      eventId: 'other',
      autoSuggestedSlippage: 2,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
    });
    emitMessage(0, {
      eventId: 'event-1',
      autoSuggestedSlippage: 3,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
    });
    await expect(operation).resolves.toEqual({
      ...quote,
      autoSuggestedSlippage: 3,
    });
  });

  it('cancels only the aborted review stream', async () => {
    const controller = new AbortController();
    const first = fetchSwapReviewQuote({
      params,
      expectedQuote: quote,
      getErrorMessage: () => 'localized retry message',
      signal: controller.signal,
    });
    const second = fetchSwapReviewQuote({
      params,
      expectedQuote: quote,
      getErrorMessage: () => 'localized retry message',
      signal: new AbortController().signal,
    });
    controller.abort();
    await expect(first).rejects.toMatchObject({ autoToast: false });
    emitMessage(1, { data: [quote] });
    await expect(second).resolves.toEqual(quote);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      mockFetchQuotesEvents.mock.calls[0][0].quoteRequestId,
    );
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      mockFetchQuotesEvents.mock.calls[1][0].quoteRequestId,
    );
  });

  it('uses translated retry copy when no selected-provider quote is available', async () => {
    const operation = fetchSwapReviewQuote({
      params,
      expectedQuote: quote,
      getErrorMessage: () => 'localized retry message',
      signal: new AbortController().signal,
    });
    emitEvent(0, { type: 'done' });
    await expect(operation).rejects.toMatchObject({
      message: 'localized retry message',
    });
  });

  it('uses translated retry copy on a stream error', async () => {
    const operation = fetchSwapReviewQuote({
      params,
      expectedQuote: quote,
      getErrorMessage: () => 'localized retry message',
      signal: new AbortController().signal,
    });
    emitEvent(0, {
      type: 'exception',
      message: 'network failed',
      error: new Error('network failed'),
    });
    await expect(operation).rejects.toMatchObject({
      message: 'localized retry message',
    });
  });

  it('times out without a quote and releases the stream', async () => {
    jest.useFakeTimers();
    try {
      const operation = fetchSwapReviewQuote({
        params,
        expectedQuote: quote,
        getErrorMessage: () => 'localized retry message',
        signal: new AbortController().signal,
      });
      const rejected = operation.catch((error: unknown) => error);
      jest.advanceTimersByTime(25_000);
      expect(await rejected).toMatchObject({
        message: 'localized retry message',
      });
      expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
        mockFetchQuotesEvents.mock.calls[0][0].quoteRequestId,
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
