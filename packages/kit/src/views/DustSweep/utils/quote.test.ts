import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import {
  EQuoteShowTipType,
  ESwapQuoteSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  ISwapQuoteEventData,
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

const { DUST_SWEEP_PROVIDER, fetchDustSweepQuote, getDustSweepQuoteRisk } =
  require('./quote') as typeof import('./quote');

const token: IDustSweepToken = {
  key: 'evm--1_0xtoken',
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'DUST',
  decimals: 18,
  amount: '10',
  valueUsd: '10',
  price: '1',
  suspicious: false,
};
const snapshot: IDustSweepSnapshot = {
  id: 'session',
  accountId: 'account',
  address: '0xuser',
  networkId: token.networkId,
  slippage: 5,
  tokens: [token],
  nativeToken: {
    networkId: token.networkId,
    contractAddress: '',
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
    price: '1000',
  },
};
const quote: IFetchQuoteResult = {
  info: { provider: 'SwapOKX', providerName: 'OKX' },
  fromTokenInfo: token,
  toTokenInfo: snapshot.nativeToken,
  fromAmount: '10',
  toAmount: '0.01',
};

describe('Dust Sweep quote execution guards', () => {
  it('accepts the exact positive quote identity', () => {
    expect(quote.info.provider).toBe(DUST_SWEEP_PROVIDER);
    expect(getDustSweepQuoteRisk(quote, token, snapshot)).toBeUndefined();
  });

  it.each(['okx', 'OKX', 'Swap0x'])('rejects provider %s', (provider) => {
    expect(
      getDustSweepQuoteRisk(
        { ...quote, info: { ...quote.info, provider } },
        token,
        snapshot,
      ),
    ).toBe('noQuote');
  });

  it.each(['Infinity', 'NaN', '0', '-1'])(
    'rejects invalid received amount %s',
    (toAmount) => {
      expect(
        getDustSweepQuoteRisk({ ...quote, toAmount }, token, snapshot),
      ).toBe('noQuote');
    },
  );

  it('rejects another token, network, or input amount', () => {
    for (const change of [
      { fromTokenInfo: { ...token, contractAddress: '0xother' } },
      { toTokenInfo: { ...snapshot.nativeToken, networkId: 'evm--56' } },
      { fromAmount: '100' },
    ]) {
      expect(
        getDustSweepQuoteRisk({ ...quote, ...change }, token, snapshot),
      ).toBe('unknown');
    }
  });

  it('keeps extra value-drop confirmation distinct from the impact cap', () => {
    expect(
      getDustSweepQuoteRisk(
        {
          ...quote,
          toAmount: '0.001',
          quoteShowTip: {
            type: EQuoteShowTipType.PRICE_IMPACT,
            priceImpactLoss: 30,
            showCheckbox: true,
          },
        },
        token,
        snapshot,
      ),
    ).toBe('valueDrop');
    expect(
      getDustSweepQuoteRisk({ ...quote, valueDropPercent: 6 }, token, snapshot),
    ).toBe('priceImpact');
  });

  it('uses the quoted impact fallback even when local tip recalculation clears the tip', () => {
    expect(
      getDustSweepQuoteRisk(
        {
          ...quote,
          quoteShowTip: {
            type: EQuoteShowTipType.PRICE_IMPACT,
            priceImpact: 6,
            priceImpactLoss: 30,
          },
        },
        token,
        snapshot,
      ),
    ).toBe('priceImpact');
    expect(
      getDustSweepQuoteRisk(
        { ...quote, valueDropPercent: Infinity },
        token,
        snapshot,
      ),
    ).toBe('unknown');
  });

  it('does not bypass custom extra confirmation or scaled token restrictions', () => {
    expect(
      getDustSweepQuoteRisk(
        { ...quote, quoteShowTip: { showCheckbox: true } },
        token,
        snapshot,
      ),
    ).toBe('unknown');
    expect(
      getDustSweepQuoteRisk(
        quote,
        { ...token, balanceMultiplier: '2' },
        snapshot,
      ),
    ).toBe('unknown');
  });
});

function emitQuoteEvent(
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
      source: request.source,
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

function emitQuoteMessage(requestIndex: number, data: ISwapQuoteEventData) {
  emitQuoteEvent(requestIndex, {
    type: 'message',
    data: JSON.stringify(data),
    lastEventId: null,
    url: '',
  });
}

describe('Dust Sweep quote stream ownership', () => {
  beforeEach(() => {
    mockFetchQuotesEvents.mockReset().mockResolvedValue(undefined);
    mockCancelFetchQuoteEvents.mockReset().mockResolvedValue(undefined);
  });

  it('selects the real SwapOKX contract from a multi-provider stream', async () => {
    const operation = fetchDustSweepQuote(
      token,
      snapshot,
      new AbortController().signal,
    );
    expect(mockFetchQuotesEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        source: ESwapQuoteSource.SWEEP,
        protocol: ESwapTabSwitchType.SWAP,
      }),
    );
    emitQuoteMessage(0, { totalQuoteCount: 10, eventId: 'info' });
    emitQuoteMessage(0, {
      data: [{ ...quote, info: { provider: 'Swap0x', providerName: '0x' } }],
    });
    expect(mockCancelFetchQuoteEvents).not.toHaveBeenCalled();
    emitQuoteMessage(0, { data: [quote] });
    emitQuoteEvent(0, { type: 'done' });
    await expect(operation).resolves.toEqual(quote);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(1);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      mockFetchQuotesEvents.mock.calls[0][0].quoteRequestId,
    );
  });

  it.each(['done', 'close'] as const)(
    'settles an unavailable OKX quote immediately on %s',
    async (type) => {
      const operation = fetchDustSweepQuote(
        token,
        snapshot,
        new AbortController().signal,
      );
      emitQuoteMessage(0, { totalQuoteCount: 10, eventId: 'info' });
      emitQuoteMessage(0, {
        data: [{ ...quote, info: { provider: 'Swap0x', providerName: '0x' } }],
      });
      emitQuoteEvent(0, { type });
      await expect(operation).rejects.toMatchObject({ reason: 'noQuote' });
      expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves the native transport error immediately following done', async () => {
    const operation = fetchDustSweepQuote(
      token,
      snapshot,
      new AbortController().signal,
    );
    emitQuoteEvent(0, { type: 'done' });
    emitQuoteEvent(0, {
      type: 'error',
      message: 'Connection dropped',
      xhrState: 4,
      xhrStatus: 0,
    });
    await expect(operation).rejects.toMatchObject({
      reason: 'noQuote',
      message: 'Connection dropped',
    });
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(1);
  });

  it('isolates concurrent request results and cancellation', async () => {
    const controller = new AbortController();
    const first = fetchDustSweepQuote(token, snapshot, controller.signal);
    const second = fetchDustSweepQuote(
      token,
      snapshot,
      new AbortController().signal,
    );
    emitQuoteMessage(1, { data: [quote] });
    await expect(second).resolves.toEqual(quote);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(1);
    controller.abort();
    await expect(first).rejects.toMatchObject({
      message: 'Dust Sweep cancelled',
    });
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(2);
  });
});
