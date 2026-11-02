import { resolveDisplayedPriceChange } from './stockMobilePriceChange';

describe('resolveDisplayedPriceChange', () => {
  it('keeps a reported share-price move at two decimals', () => {
    expect(
      resolveDisplayedPriceChange({
        price: '312.77',
        priceChangePercent: '2.76',
        reportedPriceChangeValue: '9.4612',
      })?.toFixed(),
    ).toBe('9.46');
  });

  it('derives the move from the price and the percent', () => {
    const change = resolveDisplayedPriceChange({
      price: '100',
      priceChangePercent: '10',
    });
    expect(change?.toFixed(2)).toBe('9.09');
  });

  it('returns nothing when the quote is missing', () => {
    expect(resolveDisplayedPriceChange({})).toBeUndefined();
    expect(
      resolveDisplayedPriceChange({
        price: '10',
        priceChangePercent: 'not-a-number',
      }),
    ).toBeUndefined();
  });
});
