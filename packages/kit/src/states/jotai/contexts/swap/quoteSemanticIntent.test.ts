import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapQuoteLimitSemanticSettings,
  buildSwapQuoteSemanticIntent,
  getSwapQuoteAmountProjection,
} from './quoteSemanticIntent';

const fromToken: ISwapToken = {
  contractAddress: '0xfrom',
  decimals: 18,
  networkId: 'evm--1',
  symbol: 'FROM',
};
const toToken: ISwapToken = {
  contractAddress: '0xto',
  decimals: 6,
  networkId: 'evm--1',
  symbol: 'TO',
};

function buildIntent(
  overrides: Partial<Parameters<typeof buildSwapQuoteSemanticIntent>[0]> = {},
) {
  return buildSwapQuoteSemanticIntent({
    accountId: 'account-1',
    accountNetworkId: 'evm--1',
    fromAmount: { value: '1', isInput: true },
    fromToken,
    protocol: ESwapTabSwitchType.SWAP,
    receivingAddress: '0xreceiver',
    slippage: {
      key: ESwapSlippageSegmentKey.CUSTOM,
      value: 0.5,
    },
    toAmount: { value: '10', isInput: false },
    toToken,
    userAddress: '0xsender',
    ...overrides,
  });
}

function buildQuote(
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    fromAmount: '1',
    fromTokenInfo: fromToken,
    info: { provider: 'provider', providerName: 'Provider' },
    kind: ESwapQuoteKind.SELL,
    protocol: EProtocolOfExchange.SWAP,
    quoteId: 'quote-1',
    toAmount: '10',
    toTokenInfo: toToken,
    ...overrides,
  };
}

describe('swap quote semantic intent', () => {
  it('tracks only the SELL input side and ignores its projected output', () => {
    const current = buildIntent();

    expect(
      buildIntent({ toAmount: { value: '999', isInput: false } }).key,
    ).toBe(current.key);
    expect(
      buildIntent({ fromAmount: { value: '2', isInput: true } }).key,
    ).not.toBe(current.key);
    expect(current).toEqual(
      expect.objectContaining({
        hasValidInput: true,
        inputAmount: '1',
        kind: ESwapQuoteKind.SELL,
      }),
    );
  });

  it('tracks only the LIMIT BUY input side and ignores its projected output', () => {
    const current = buildIntent({
      fromAmount: { value: '5', isInput: false },
      protocol: ESwapTabSwitchType.LIMIT,
      toAmount: { value: '10', isInput: true },
    });

    expect(
      buildIntent({
        fromAmount: { value: '999', isInput: false },
        protocol: ESwapTabSwitchType.LIMIT,
        toAmount: { value: '10', isInput: true },
      }).key,
    ).toBe(current.key);
    expect(
      buildIntent({
        fromAmount: { value: '5', isInput: false },
        protocol: ESwapTabSwitchType.LIMIT,
        toAmount: { value: '11', isInput: true },
      }).key,
    ).not.toBe(current.key);
    expect(current.kind).toBe(ESwapQuoteKind.BUY);
  });

  it.each([
    ['account', { accountId: 'account-2' }],
    ['account network', { accountNetworkId: 'evm--10' }],
    ['sender', { userAddress: '0xother-sender' }],
    ['receiver', { receivingAddress: '0xother-receiver' }],
    [
      'custom slippage',
      {
        slippage: {
          key: ESwapSlippageSegmentKey.CUSTOM,
          value: 1,
        },
      },
    ],
    [
      'slippage mode',
      {
        slippage: {
          key: ESwapSlippageSegmentKey.AUTO,
          value: 0.5,
        },
      },
    ],
    [
      'from token',
      { fromToken: { ...fromToken, contractAddress: '0xother-from' } },
    ],
    ['protocol', { protocol: ESwapTabSwitchType.BRIDGE }],
  ] as const)('invalidates when %s changes', (_name, overrides) => {
    expect(buildIntent(overrides).key).not.toBe(buildIntent().key);
  });

  it('treats native identity as semantic and rejects non-native empty-address input', () => {
    const nativeFromToken = {
      ...fromToken,
      contractAddress: '',
      isNative: true,
    };
    const incompleteFromToken = {
      ...nativeFromToken,
      isNative: false,
    };
    const nativeIntent = buildIntent({ fromToken: nativeFromToken });
    const incompleteIntent = buildIntent({ fromToken: incompleteFromToken });

    expect(nativeIntent.hasValidInput).toBe(true);
    expect(incompleteIntent.hasValidInput).toBe(false);
    expect(incompleteIntent.key).not.toBe(nativeIntent.key);
  });

  it('does not treat an auto-slippage suggestion update as user intent', () => {
    const first = buildIntent({
      slippage: { key: ESwapSlippageSegmentKey.AUTO, value: 0.5 },
    });
    const suggested = buildIntent({
      slippage: { key: ESwapSlippageSegmentKey.AUTO, value: 1.25 },
    });

    expect(suggested.key).toBe(first.key);
  });

  it.each([
    [
      'rate',
      {
        expirationTime: 3600,
        limitPartiallyFillable: true,
        userMarketPriceRate: '11',
      },
    ],
    [
      'expiration',
      {
        expirationTime: 7200,
        limitPartiallyFillable: true,
        userMarketPriceRate: '10',
      },
    ],
    [
      'partial-fill policy',
      {
        expirationTime: 3600,
        limitPartiallyFillable: false,
        userMarketPriceRate: '10',
      },
    ],
  ] as const)(
    'invalidates LIMIT intent when %s changes',
    (_name, limitSettings) => {
      const current = buildIntent({
        limitSettings: {
          expirationTime: 3600,
          limitPartiallyFillable: true,
          userMarketPriceRate: '10',
        },
        protocol: ESwapTabSwitchType.LIMIT,
      });

      expect(
        buildIntent({
          limitSettings,
          protocol: ESwapTabSwitchType.LIMIT,
        }).key,
      ).not.toBe(current.key);
    },
  );

  it('ignores LIMIT-only settings outside the LIMIT protocol', () => {
    expect(
      buildIntent({
        limitSettings: {
          expirationTime: 3600,
          limitPartiallyFillable: true,
          userMarketPriceRate: '10',
        },
      }).key,
    ).toBe(buildIntent().key);
  });

  it('uses a limit rate only for the selected token pair', () => {
    const selected = buildSwapQuoteLimitSemanticSettings({
      expirationTime: '3600',
      fromToken,
      limitPartiallyFillable: true,
      limitPriceUseRate: { fromToken, toToken, rate: '10' },
      protocol: ESwapTabSwitchType.LIMIT,
      toToken,
    });
    const stalePair = buildSwapQuoteLimitSemanticSettings({
      expirationTime: '3600',
      fromToken,
      limitPartiallyFillable: true,
      limitPriceUseRate: {
        fromToken: { ...fromToken, contractAddress: '0xstale' },
        toToken,
        rate: '10',
      },
      protocol: ESwapTabSwitchType.LIMIT,
      toToken,
    });

    expect(selected).toEqual({
      expirationTime: 3600,
      limitPartiallyFillable: true,
      userMarketPriceRate: '10',
    });
    expect(stalePair?.userMarketPriceRate).toBeUndefined();
    expect(
      buildSwapQuoteLimitSemanticSettings({
        expirationTime: '3600',
        fromToken,
        limitPartiallyFillable: true,
        limitPriceUseRate: { fromToken, toToken, rate: '10' },
        protocol: ESwapTabSwitchType.SWAP,
        toToken,
      }),
    ).toBeUndefined();
  });

  it('projects a SELL quote only when token, kind, and input amount match', () => {
    expect(
      getSwapQuoteAmountProjection({
        expectedKind: ESwapQuoteKind.SELL,
        fromAmount: '1',
        fromToken,
        quote: buildQuote(),
        toAmount: '',
        toToken,
      }),
    ).toEqual({ direction: ESwapDirectionType.TO, value: '10' });
    expect(
      getSwapQuoteAmountProjection({
        expectedKind: ESwapQuoteKind.SELL,
        fromAmount: '12',
        fromToken,
        quote: buildQuote(),
        toAmount: '',
        toToken,
      }),
    ).toBeUndefined();
    expect(
      getSwapQuoteAmountProjection({
        expectedKind: ESwapQuoteKind.SELL,
        fromAmount: '1',
        fromToken,
        quote: buildQuote({
          toTokenInfo: { ...toToken, contractAddress: '0xstale' },
        }),
        toAmount: '',
        toToken,
      }),
    ).toBeUndefined();
  });

  it('projects a LIMIT BUY quote only for the current BUY input', () => {
    const quote = buildQuote({
      fromAmount: '5',
      kind: ESwapQuoteKind.BUY,
      protocol: EProtocolOfExchange.LIMIT,
      toAmount: '10',
    });
    expect(
      getSwapQuoteAmountProjection({
        expectedKind: ESwapQuoteKind.BUY,
        fromAmount: '',
        fromToken,
        quote,
        toAmount: '10',
        toToken,
      }),
    ).toEqual({ direction: ESwapDirectionType.FROM, value: '5' });
    expect(
      getSwapQuoteAmountProjection({
        expectedKind: ESwapQuoteKind.BUY,
        fromAmount: '',
        fromToken,
        quote,
        toAmount: '12',
        toToken,
      }),
    ).toBeUndefined();
    expect(
      getSwapQuoteAmountProjection({
        expectedKind: ESwapQuoteKind.SELL,
        fromAmount: '5',
        fromToken,
        quote,
        toAmount: '10',
        toToken,
      }),
    ).toBeUndefined();
  });

  it.each([
    {
      expectedKind: ESwapQuoteKind.SELL,
      fromAmount: '1000.0',
      quote: buildQuote({
        fromAmount: '1000',
        protocol: EProtocolOfExchange.STOCK,
      }),
      toAmount: '',
      expected: { direction: ESwapDirectionType.TO, value: '10' },
    },
    {
      expectedKind: ESwapQuoteKind.BUY,
      fromAmount: '',
      quote: buildQuote({
        fromAmount: '5',
        kind: ESwapQuoteKind.BUY,
        protocol: EProtocolOfExchange.STOCK,
        toAmount: '10',
      }),
      toAmount: '10.00',
      expected: { direction: ESwapDirectionType.FROM, value: '5' },
    },
  ])(
    'accepts numerically equivalent Stock $expectedKind input amounts',
    ({ expected, ...params }) => {
      expect(
        getSwapQuoteAmountProjection({
          ...params,
          fromToken,
          toToken,
        }),
      ).toEqual(expected);
    },
  );

  it('accepts numerically equivalent ordinary Swap input amounts', () => {
    expect(
      getSwapQuoteAmountProjection({
        expectedKind: ESwapQuoteKind.SELL,
        fromAmount: '1.0',
        fromToken,
        quote: buildQuote({ fromAmount: '1' }),
        toAmount: '',
        toToken,
      }),
    ).toEqual({ direction: ESwapDirectionType.TO, value: '10' });
  });
});
