import { isSwapQuoteAvailable } from '@onekeyhq/kit/src/views/Swap/utils/swapErrorUtils';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { selectPrivateSendQuote } from './privateSendQuoteUtils';

const token = {
  networkId: 'evm--56',
  contractAddress: '0xtoken',
  symbol: 'USDT',
  decimals: 18,
};

function makeQuote(
  provider: string,
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    quoteId: provider,
    info: { provider, providerName: provider },
    fromTokenInfo: token,
    toTokenInfo: token,
    toAmount: '10',
    ...overrides,
  };
}

describe('isSwapQuoteAvailable', () => {
  it.each([
    ['missing quote', undefined, '10', false],
    [
      'missing output amount',
      makeQuote('p', { toAmount: undefined }),
      '10',
      false,
    ],
    ['zero output amount', makeQuote('p', { toAmount: '0' }), '10', false],
    ['negative output amount', makeQuote('p', { toAmount: '-1' }), '10', false],
    ['invalid output amount', makeQuote('p', { toAmount: 'NaN' }), '10', false],
    [
      'infinite output amount',
      makeQuote('p', { toAmount: 'Infinity' }),
      '10',
      false,
    ],
    ['provider error', makeQuote('p', { errorMessage: 'failed' }), '10', false],
    [
      'missing provider',
      makeQuote('p', { info: { provider: '', providerName: 'p' } }),
      '10',
      false,
    ],
    [
      'below min',
      makeQuote('p', { limit: { min: '1' } }),
      '0.999999999999999999',
      false,
    ],
    ['at min', makeQuote('p', { limit: { min: '1' } }), '1', true],
    ['at max', makeQuote('p', { limit: { max: '1' } }), '1', true],
    [
      'above max',
      makeQuote('p', { limit: { max: '1' } }),
      '1.000000000000000001',
      false,
    ],
    [
      'inside range',
      makeQuote('p', { limit: { min: '1', max: '20' } }),
      '10',
      true,
    ],
  ] as const)('%s', (_name, quote, amount, expected) => {
    expect(isSwapQuoteAvailable(quote, amount)).toBe(expected);
  });
});

describe('selectPrivateSendQuote', () => {
  it('selects and ranks actionable quotes before unavailable providers', () => {
    const unavailable = makeQuote('limited', {
      toAmount: '100',
      limit: { max: '9' },
    });
    const worse = makeQuote('worse', { toAmount: '5' });
    const best = makeQuote('best', { toAmount: '10' });

    expect(
      selectPrivateSendQuote([unavailable, worse, best], '10')?.info.provider,
    ).toBe('best');
  });

  it('retains an out-of-range provider so its limit can be shown', () => {
    const genericError = makeQuote('error', {
      toAmount: undefined,
      errorMessage: 'failed',
    });
    const limited = makeQuote('limited', {
      toAmount: undefined,
      limit: { max: '9000' },
    });

    expect(selectPrivateSendQuote([genericError, limited], '100000')).toBe(
      limited,
    );
  });

  it('falls back to the first provider when no actionable or limited quote exists', () => {
    const first = makeQuote('first', { toAmount: undefined });
    const second = makeQuote('second', { errorMessage: 'failed' });

    expect(selectPrivateSendQuote([first, second], '10')).toBe(first);
    expect(selectPrivateSendQuote([], '10')).toBeUndefined();
  });
});
