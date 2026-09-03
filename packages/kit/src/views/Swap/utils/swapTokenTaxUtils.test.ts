import {
  formatSwapTokenTaxPercentage,
  getSwapQuoteTokenTaxPercentages,
} from './swapTokenTaxUtils';

describe('formatSwapTokenTaxPercentage', () => {
  it('formats a quote tax ratio as a percentage', () => {
    expect(formatSwapTokenTaxPercentage(0.03)).toBe('3');
    expect(formatSwapTokenTaxPercentage(0.0497)).toBe('4.97');
    expect(formatSwapTokenTaxPercentage(0.0305)).toBe('3.05');
  });

  it('hides missing, zero, and invalid tax rates', () => {
    expect(formatSwapTokenTaxPercentage()).toBeUndefined();
    expect(formatSwapTokenTaxPercentage(0)).toBeUndefined();
    expect(formatSwapTokenTaxPercentage(-0.03)).toBeUndefined();
    expect(formatSwapTokenTaxPercentage(Number.NaN)).toBeUndefined();
  });
});

describe('getSwapQuoteTokenTaxPercentages', () => {
  it('uses tax fields from the selected quote', () => {
    expect(
      getSwapQuoteTokenTaxPercentages({ buyTax: 0.03, sellTax: 0.0497 }),
    ).toEqual({
      buyTaxPercentage: '3',
      sellTaxPercentage: '4.97',
    });
  });

  it('ignores legacy provider metadata', () => {
    const quoteWithLegacyProviderMetadata = {
      buyTax: 0,
      sellTax: 0,
      tokenMetadata: {
        buyToken: { buyTaxBps: '300', sellTaxBps: '300' },
        sellToken: { buyTaxBps: '300', sellTaxBps: '300' },
      },
    };

    expect(
      getSwapQuoteTokenTaxPercentages(quoteWithLegacyProviderMetadata),
    ).toEqual({
      buyTaxPercentage: undefined,
      sellTaxPercentage: undefined,
    });
  });
});
