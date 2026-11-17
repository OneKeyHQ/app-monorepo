import {
  buildMarketStockDetailPreview,
  hasValidMarketDetailPreview,
} from './marketDetailPreview';

describe('buildMarketStockDetailPreview', () => {
  it('keeps the stock preview when the logo URL is empty', () => {
    expect(
      buildMarketStockDetailPreview({
        stockId: 'AAPL',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        logoUrl: '',
      }),
    ).toEqual({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
    });
  });

  it('requires the stock identity text', () => {
    expect(
      buildMarketStockDetailPreview({
        stockId: 'AAPL',
        symbol: '',
        name: 'Apple Inc.',
        logoUrl: '',
      }),
    ).toBeUndefined();
  });
});

describe('hasValidMarketDetailPreview', () => {
  it('uses the stock route preview while token resources are pending', () => {
    expect(
      hasValidMarketDetailPreview({
        isStockRoute: true,
        stockPreview: {
          stockId: 'AAPL',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          logoUrl: '',
        },
        previews: [],
        tokenAddress: '',
        networkId: '',
      }),
    ).toBe(true);
  });

  it('requires a matching token identity for token routes', () => {
    expect(
      hasValidMarketDetailPreview({
        isStockRoute: false,
        previews: [
          {
            address: '0x123',
            networkId: 'evm--1',
            name: 'Token',
            symbol: 'TKN',
            decimals: 18,
            selectedAt: 1,
          },
        ],
        tokenAddress: '0x456',
        networkId: 'evm--1',
      }),
    ).toBe(false);
  });
});
