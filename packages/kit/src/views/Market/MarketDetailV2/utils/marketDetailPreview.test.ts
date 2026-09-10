import { buildMarketStockDetailPreview } from './marketDetailPreview';

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
