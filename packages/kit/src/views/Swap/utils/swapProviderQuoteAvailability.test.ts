import {
  ESwapQuoteKind,
  type IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

import { isSwapProviderQuoteSelectable } from './swapProviderQuoteAvailability';

function buildQuote(
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    info: {
      provider: 'provider-a',
      providerName: 'Provider A',
    },
    fromTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
    },
    toTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '0x1',
      symbol: 'USDC',
      decimals: 6,
      isNative: false,
    },
    eventId: 'event-current',
    fromAmount: '1',
    toAmount: '10',
    ...overrides,
  } as IFetchQuoteResult;
}

function isSelectable(
  params: Omit<
    Parameters<typeof isSwapProviderQuoteSelectable>[0],
    'currentEventId' | 'currentEventProviderKeys'
  >,
) {
  return isSwapProviderQuoteSelectable({
    ...params,
    currentEventId: params.quote.eventId,
    currentEventProviderKeys: [
      `${params.quote.info.provider}-${params.quote.info.providerName}`,
    ],
  });
}

describe('isSwapProviderQuoteSelectable', () => {
  it.each([undefined, '', '0'])(
    'rejects a non-actionable amount: %s',
    (toAmount) => {
      expect(
        isSelectable({
          fromAmount: '1',
          quote: buildQuote({ toAmount }),
          toAmount: '',
        }),
      ).toBe(false);
    },
  );

  it('rejects an amount below the provider minimum', () => {
    expect(
      isSelectable({
        fromAmount: '1',
        quote: buildQuote({ limit: { min: '2' } }),
        toAmount: '',
      }),
    ).toBe(false);
  });

  it('rejects an amount above the provider maximum', () => {
    expect(
      isSelectable({
        fromAmount: '1',
        quote: buildQuote({ limit: { max: '0.5' } }),
        toAmount: '',
      }),
    ).toBe(false);
  });

  it('rejects a provider error even if it carries a positive amount', () => {
    expect(
      isSelectable({
        fromAmount: '1',
        quote: buildQuote({ errorMessage: 'route unavailable' }),
        toAmount: '',
      }),
    ).toBe(false);
  });

  it('allows an actionable quote inside inclusive provider limits', () => {
    expect(
      isSelectable({
        fromAmount: '1',
        quote: buildQuote({ limit: { min: '1', max: '2' } }),
        toAmount: '',
      }),
    ).toBe(true);
  });

  it('fails closed for malformed amounts or limits', () => {
    expect(
      isSelectable({
        fromAmount: 'invalid',
        quote: buildQuote({ fromAmount: 'invalid', limit: { min: '1' } }),
        toAmount: '',
      }),
    ).toBe(false);
    expect(
      isSelectable({
        fromAmount: '1',
        quote: buildQuote({ limit: { min: 'invalid' } }),
        toAmount: '',
      }),
    ).toBe(false);
  });

  it('validates each exact-out provider against its own derived input', () => {
    const quotes = [
      buildQuote({
        info: { provider: 'provider-a', providerName: 'Provider A' },
        kind: ESwapQuoteKind.BUY,
        fromAmount: '0.9',
        toAmount: '10',
        limit: { max: '0.8' },
      }),
      buildQuote({
        info: { provider: 'provider-b', providerName: 'Provider B' },
        kind: ESwapQuoteKind.BUY,
        fromAmount: '0.7',
        toAmount: '10',
        limit: { max: '0.8' },
      }),
    ];

    expect(
      quotes.map((quote) =>
        isSelectable({
          fromAmount: '0.9',
          quote,
          toAmount: '10',
        }),
      ),
    ).toEqual([false, true]);
  });

  it('keeps a retained provider row display-only after the input changes', () => {
    expect(
      isSelectable({
        fromAmount: '0.012',
        quote: buildQuote({ fromAmount: '0.01' }),
        toAmount: '',
      }),
    ).toBe(false);
  });

  it('keeps same-input retained rows display-only until their event arrives', () => {
    const previousQuote = buildQuote({ eventId: 'event-previous' });

    expect(
      isSwapProviderQuoteSelectable({
        currentEventId: undefined,
        currentEventProviderKeys: [],
        fromAmount: '1',
        quote: previousQuote,
        toAmount: '',
      }),
    ).toBe(false);

    expect(
      isSwapProviderQuoteSelectable({
        currentEventId: 'event-current',
        currentEventProviderKeys: ['provider-a-Provider A'],
        fromAmount: '1',
        quote: previousQuote,
        toAmount: '',
      }),
    ).toBe(false);

    expect(
      isSelectable({
        fromAmount: '1',
        quote: buildQuote(),
        toAmount: '',
      }),
    ).toBe(true);
  });
});
