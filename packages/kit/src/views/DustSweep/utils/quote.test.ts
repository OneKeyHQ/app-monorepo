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
  EProtocolOfExchange,
  EQuoteShowTipType,
  ESwapQuoteKind,
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

const { fetchDustSweepQuote, getDustSweepQuoteRisk } =
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

function createWrappedCase(
  networkId = 'evm--56',
  contractAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
) {
  const wrappedToken: IDustSweepToken = {
    ...token,
    networkId,
    contractAddress,
    symbol: 'WRAPPED',
    amount: '0.001',
    isNative: false,
    price: undefined,
  };
  const wrappedSnapshot: IDustSweepSnapshot = {
    ...snapshot,
    networkId,
    nativeToken: { ...snapshot.nativeToken, networkId, price: undefined },
    tokens: [wrappedToken],
  };
  const wrappedQuote: IFetchQuoteResult = {
    quoteId: 'unwrap-quote',
    protocol: EProtocolOfExchange.SWAP,
    kind: ESwapQuoteKind.SELL,
    info: { provider: 'wrapped', providerName: 'Wrap Contract' },
    isWrapped: true,
    fromTokenInfo: wrappedToken,
    toTokenInfo: wrappedSnapshot.nativeToken,
    fromAmount: wrappedToken.amount,
    toAmount: wrappedToken.amount,
    fee: { percentageFee: 0 },
  };
  return { wrappedToken, wrappedSnapshot, wrappedQuote };
}

describe('Dust Sweep quote execution guards', () => {
  it.each([
    { protocol: EProtocolOfExchange.LIMIT },
    { protocol: EProtocolOfExchange.STOCK },
    { protocol: EProtocolOfExchange.PRIVATE_SEND },
    { kind: ESwapQuoteKind.BUY },
  ])('rejects a mismatched trade contract: %j', (contract) => {
    expect(
      getDustSweepQuoteRisk({ ...quote, ...contract }, token, snapshot),
    ).toBe('unknown');
  });

  it.each([
    {},
    { protocol: EProtocolOfExchange.SWAP, kind: ESwapQuoteKind.SELL },
  ])('accepts the exact positive quote identity: %j', (contract) => {
    expect(quote.info.provider).toBe('SwapOKX');
    expect(
      getDustSweepQuoteRisk({ ...quote, ...contract }, token, snapshot),
    ).toBeUndefined();
  });

  it.each([
    { ...snapshot.nativeToken, price: '1000' },
    { ...token, contractAddress: '0xother', price: '1' },
  ])(
    'rejects undisclosed fees paid with an unselected token ($contractAddress)',
    (feeToken) => {
      expect(
        getDustSweepQuoteRisk(
          {
            ...quote,
            fee: {
              percentageFee: 0,
              otherFeeInfos: [{ token: feeToken, amount: '0.01' }],
            },
          },
          token,
          snapshot,
        ),
      ).toBe('unknown');
      expect(
        getDustSweepQuoteRisk(
          {
            ...quote,
            fee: {
              percentageFee: 0,
              otherFeeInfos: [{ token: feeToken, amount: '0' }],
            },
          },
          token,
          snapshot,
        ),
      ).toBeUndefined();
    },
  );

  it('allows selected-token fees for the subsequent combined balance check', () => {
    expect(
      getDustSweepQuoteRisk(
        {
          ...quote,
          fee: {
            percentageFee: 0,
            otherFeeInfos: [
              { token: { ...token, price: '1' }, amount: '0.01' },
            ],
          },
        },
        token,
        snapshot,
      ),
    ).toBeUndefined();
  });

  it.each([undefined, '', '0', '-1', 'NaN', 'Infinity'])(
    'uses matched quote prices when local prices are invalid (%s)',
    (price) => {
      const unpricedToken = { ...token, price };
      const unpricedSnapshot = {
        ...snapshot,
        nativeToken: { ...snapshot.nativeToken, price },
      };
      expect(
        getDustSweepQuoteRisk(quote, unpricedToken, unpricedSnapshot),
      ).toBeUndefined();
      expect(
        getDustSweepQuoteRisk(
          { ...quote, toAmount: '0.009' },
          unpricedToken,
          unpricedSnapshot,
        ),
      ).toBe('priceImpact');
      expect(
        getDustSweepQuoteRisk(
          {
            ...quote,
            fromTokenInfo: unpricedToken,
            toTokenInfo: unpricedSnapshot.nativeToken,
          },
          unpricedToken,
          unpricedSnapshot,
        ),
      ).toBe('unknown');
      expect(
        getDustSweepQuoteRisk(
          {
            ...quote,
            fromTokenInfo: unpricedToken,
            toTokenInfo: unpricedSnapshot.nativeToken,
            valueDropPercent: 0,
          },
          unpricedToken,
          unpricedSnapshot,
        ),
      ).toBeUndefined();
    },
  );

  it('clears an unknown-value tip using valid prices from the matched quote', () => {
    expect(
      getDustSweepQuoteRisk(
        {
          ...quote,
          quoteShowTip: {
            type: EQuoteShowTipType.TRADE_UNKNOWN,
            title: 'Unknown',
            detail: 'Unknown value',
          },
        },
        { ...token, price: '0' },
        {
          ...snapshot,
          nativeToken: { ...snapshot.nativeToken, price: '' },
        },
      ),
    ).toBeUndefined();
  });

  it('accepts native token address aliases returned by build-tx', () => {
    expect(
      getDustSweepQuoteRisk(
        {
          ...quote,
          toTokenInfo: {
            ...snapshot.nativeToken,
            contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          },
        },
        token,
        snapshot,
      ),
    ).toBeUndefined();
  });

  it.each(['okx', 'OKX', 'Swap0x', 'SwapLiquidMesh', 'SwapChangelly'])(
    'rejects provider %s outside the Dust Sweep contract',
    (provider) => {
      expect(
        getDustSweepQuoteRisk(
          { ...quote, info: { ...quote.info, provider } },
          token,
          snapshot,
        ),
      ).toBe('noQuote');
    },
  );

  it.each([
    ['evm--56', '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'],
    ['evm--1', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
  ])(
    'accepts a verified 1:1 unwrap without market prices (%s)',
    (networkId, address) => {
      const { wrappedQuote, wrappedToken, wrappedSnapshot } = createWrappedCase(
        networkId,
        address.toUpperCase(),
      );
      expect(
        getDustSweepQuoteRisk(
          { ...wrappedQuote, toAmount: '0.0010' },
          wrappedToken,
          wrappedSnapshot,
        ),
      ).toBeUndefined();
    },
  );

  it.each<Partial<IFetchQuoteResult>>([
    { isWrapped: undefined },
    { isWrapped: false },
    { info: { provider: 'SwapOKX', providerName: 'OKX' } },
    { fromAmount: '0.002' },
    { toAmount: '0.002' },
    { protocol: EProtocolOfExchange.LIMIT },
    { kind: ESwapQuoteKind.BUY },
    { allowanceResult: { allowanceTarget: '0xspender', amount: '0.001' } },
    { quoteShowTip: { showCheckbox: true } },
    { fee: { percentageFee: 1 } },
    { fee: { percentageFee: Number.NaN } },
    { fee: { percentageFee: 0, protocolFees: 0.01 } },
    { fee: { percentageFee: 0, protocolFees: Number.NaN } },
  ])('rejects a contradictory unwrap quote: %j', (change) => {
    const { wrappedQuote, wrappedToken, wrappedSnapshot } = createWrappedCase();
    expect(
      getDustSweepQuoteRisk(
        { ...wrappedQuote, ...change },
        wrappedToken,
        wrappedSnapshot,
      ),
    ).toBe('unknown');
  });

  it.each([
    { contractAddress: '0xother' },
    { networkId: 'evm--1' },
    { isNative: true },
    { decimals: 6 },
    { balanceMultiplier: '2' },
  ])('rejects an invalid unwrap input identity: %j', (change) => {
    const { wrappedQuote, wrappedToken, wrappedSnapshot } = createWrappedCase();
    const changedToken = { ...wrappedToken, ...change };
    expect(
      getDustSweepQuoteRisk(
        { ...wrappedQuote, fromTokenInfo: changedToken },
        changedToken,
        wrappedSnapshot,
      ),
    ).toBe('unknown');
  });

  it('rejects a non-native output, extra wrap step or undisclosed unwrap fee', () => {
    const { wrappedQuote, wrappedToken, wrappedSnapshot } = createWrappedCase();
    const nonNativeOutput = { ...wrappedSnapshot.nativeToken, isNative: false };
    expect(
      getDustSweepQuoteRisk(
        { ...wrappedQuote, toTokenInfo: nonNativeOutput },
        wrappedToken,
        { ...wrappedSnapshot, nativeToken: nonNativeOutput },
      ),
    ).toBe('unknown');
    for (const change of [
      { shouldWrappedToken: wrappedToken },
      {
        fee: {
          percentageFee: 0,
          otherFeeInfos: [
            { token: { ...wrappedToken, price: '1' }, amount: '0.0001' },
          ],
        },
      },
    ]) {
      expect(
        getDustSweepQuoteRisk(
          { ...wrappedQuote, ...change },
          wrappedToken,
          wrappedSnapshot,
        ),
      ).toBe('unknown');
    }
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

  it('accepts the wrapped quote and cleans up only its own stream', async () => {
    const { wrappedQuote, wrappedToken, wrappedSnapshot } = createWrappedCase();
    const operation = fetchDustSweepQuote(
      wrappedToken,
      wrappedSnapshot,
      new AbortController().signal,
    );
    emitQuoteMessage(0, { data: [wrappedQuote] });
    emitQuoteEvent(0, { type: 'done' });
    await expect(operation).resolves.toEqual(wrappedQuote);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(1);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      mockFetchQuotesEvents.mock.calls[0][0].quoteRequestId,
    );
  });

  it('waits for OKX rather than accepting another provider first', async () => {
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
    const otherProviderQuote = {
      ...quote,
      info: { provider: 'SwapLiquidMesh', providerName: 'LiquidMesh' },
    };
    emitQuoteMessage(0, { data: [otherProviderQuote] });
    expect(mockCancelFetchQuoteEvents).not.toHaveBeenCalled();
    emitQuoteMessage(0, { data: [quote] });
    emitQuoteEvent(0, { type: 'done' });
    await expect(operation).resolves.toEqual(quote);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(1);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledWith(
      mockFetchQuotesEvents.mock.calls[0][0].quoteRequestId,
    );
  });

  it('keeps the stream open after an unavailable provider until a usable quote arrives', async () => {
    const operation = fetchDustSweepQuote(
      token,
      snapshot,
      new AbortController().signal,
    );
    emitQuoteMessage(0, {
      data: [{ ...quote, toAmount: '0', errorMessage: 'No liquidity' }],
    });
    expect(mockCancelFetchQuoteEvents).not.toHaveBeenCalled();
    const usable = { ...quote };
    emitQuoteMessage(0, { data: [usable] });
    await expect(operation).resolves.toEqual(usable);
  });

  it('does not fall back to another provider or surface its error message', async () => {
    const operation = fetchDustSweepQuote(
      token,
      snapshot,
      new AbortController().signal,
    );
    emitQuoteMessage(0, {
      data: [
        {
          ...quote,
          info: { provider: 'SwapLiquidMesh', providerName: 'LiquidMesh' },
          errorMessage: 'Another provider error',
        },
      ],
    });
    emitQuoteEvent(0, { type: 'done' });
    await expect(operation).rejects.toMatchObject({
      reason: 'noQuote',
      providerErrorMessage: undefined,
    });
  });

  it('passes the Sweep source and provider restrictions on every quote', async () => {
    const operation = fetchDustSweepQuote(
      token,
      { ...snapshot, denySingleSwapProvider: 'SwapLiquidMesh,Swap0x' },
      new AbortController().signal,
    );
    expect(mockFetchQuotesEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'Sweep',
        denySingleSwapProvider: 'SwapLiquidMesh,Swap0x',
      }),
    );
    emitQuoteMessage(0, { data: [quote] });
    await expect(operation).resolves.toEqual(quote);
  });

  it('retains the risk reason if the stream ends with no executable quote', async () => {
    const operation = fetchDustSweepQuote(
      token,
      snapshot,
      new AbortController().signal,
    );
    emitQuoteMessage(0, {
      data: [{ ...quote, errorMessage: 'Previous provider error' }],
    });
    emitQuoteMessage(0, { data: [{ ...quote, valueDropPercent: 20 }] });
    emitQuoteEvent(0, { type: 'done' });
    await expect(operation).rejects.toMatchObject({
      reason: 'priceImpact',
      providerErrorMessage: undefined,
    });
  });

  it('keeps the slippage cap when the provider omits a numeric impact', () => {
    expect(
      getDustSweepQuoteRisk(
        {
          ...quote,
          toAmount: '0.009',
          quoteShowTip: {
            type: EQuoteShowTipType.PRICE_IMPACT,
            priceImpactLoss: 30,
          },
        },
        token,
        snapshot,
      ),
    ).toBe('priceImpact');
  });

  it.each(['done', 'close'] as const)(
    'preserves the selected provider error message on %s without changing the reason',
    async (type) => {
      const operation = fetchDustSweepQuote(
        token,
        snapshot,
        new AbortController().signal,
      );
      emitQuoteMessage(0, { totalQuoteCount: 1, eventId: 'info' });
      emitQuoteMessage(0, {
        data: [
          {
            ...quote,
            toAmount: undefined,
            toAmountSlippage: -1,
            errorMessage: '请增加金额后重试',
          },
        ],
      });
      emitQuoteEvent(0, { type });
      await expect(operation).rejects.toMatchObject({
        reason: 'noQuote',
        providerErrorMessage: '请增加金额后重试',
      });
      expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves the native transport error immediately following done', async () => {
    const operation = fetchDustSweepQuote(
      token,
      snapshot,
      new AbortController().signal,
    );
    emitQuoteMessage(0, {
      data: [{ ...quote, errorMessage: 'Previous provider error' }],
    });
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
      providerErrorMessage: undefined,
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
    emitQuoteMessage(0, {
      data: [
        { ...quote, toAmount: undefined, errorMessage: 'Old quote error' },
      ],
    });
    emitQuoteMessage(1, { data: [quote] });
    await expect(second).resolves.toEqual(quote);
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(1);
    controller.abort();
    await expect(first).rejects.toMatchObject({
      message: 'Dust Sweep cancelled',
    });
    expect(mockCancelFetchQuoteEvents).toHaveBeenCalledTimes(2);
  });

  it('does not surface provider messages belonging to another token pair', async () => {
    const operation = fetchDustSweepQuote(
      token,
      snapshot,
      new AbortController().signal,
    );
    emitQuoteMessage(0, {
      data: [
        {
          ...quote,
          fromTokenInfo: { ...token, contractAddress: '0xother' },
          errorMessage: 'Another token error',
        },
      ],
    });
    emitQuoteEvent(0, { type: 'done' });
    await expect(operation).rejects.toMatchObject({
      reason: 'noQuote',
      providerErrorMessage: undefined,
    });
  });
});
