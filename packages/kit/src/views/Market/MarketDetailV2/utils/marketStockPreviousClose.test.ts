import { getMarketStockPreviousClose } from './marketStockPreviousClose';

describe('getMarketStockPreviousClose', () => {
  it('parses the reported previous close', () => {
    expect(getMarketStockPreviousClose({ previousClose: '328.21' })).toBe(
      328.21,
    );
    expect(getMarketStockPreviousClose({ previousClose: ' 12.5 ' })).toBe(12.5);
  });

  it('drops missing, empty, and unusable figures', () => {
    expect(getMarketStockPreviousClose(undefined)).toBeUndefined();
    expect(getMarketStockPreviousClose(null)).toBeUndefined();
    expect(getMarketStockPreviousClose({})).toBeUndefined();
    expect(getMarketStockPreviousClose({ previousClose: '' })).toBeUndefined();
    expect(getMarketStockPreviousClose({ previousClose: '0' })).toBeUndefined();
    expect(
      getMarketStockPreviousClose({ previousClose: 'n/a' }),
    ).toBeUndefined();
  });
});
