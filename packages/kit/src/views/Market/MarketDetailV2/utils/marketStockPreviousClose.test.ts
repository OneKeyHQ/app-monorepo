import {
  getMarketStockPreviousClose,
  getMarketStockTokenPreviousClose,
} from './marketStockPreviousClose';

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

describe('getMarketStockTokenPreviousClose', () => {
  const stockDetail = { previousClose: '316.22' };

  it('rescales the share close by the shares per token', () => {
    expect(
      getMarketStockTokenPreviousClose({
        stockDetail,
        tokenToAssetRatio: '0.5',
      }),
    ).toBeCloseTo(158.11);
  });

  it('treats a missing or unusable ratio as one share per token', () => {
    for (const tokenToAssetRatio of [undefined, '', '0', 'n/a']) {
      expect(
        getMarketStockTokenPreviousClose({ stockDetail, tokenToAssetRatio }),
      ).toBe(316.22);
    }
  });

  it('has nothing to rescale without a share close', () => {
    expect(
      getMarketStockTokenPreviousClose({
        stockDetail: undefined,
        tokenToAssetRatio: '1',
      }),
    ).toBeUndefined();
  });
});
