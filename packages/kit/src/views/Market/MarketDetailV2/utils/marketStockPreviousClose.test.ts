import {
  getMarketStockChartPreviousClose,
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

describe('getMarketStockChartPreviousClose', () => {
  const stockDetail = { previousClose: '316.22' };
  const tokenDetail = {
    address: '0xAbC',
    stock: { tokenToAssetRatio: '0.5' },
  };
  const tokenDetailNetworkId = 'evm--1';

  it('uses the share close as is in share price mode', () => {
    expect(
      getMarketStockChartPreviousClose({
        priceSource: 'share',
        stockDetail,
        tokenDetail,
        tokenDetailNetworkId,
      }),
    ).toBe(316.22);
  });

  it("prefers the selected variant's own ratio", () => {
    expect(
      getMarketStockChartPreviousClose({
        priceSource: 'token',
        stockDetail,
        selectedTokenVariant: {
          networkId: 'evm--56',
          contractAddress: '0xother',
          tokenToAssetRatio: '2',
        },
        tokenDetail,
        tokenDetailNetworkId,
      }),
    ).toBeCloseTo(632.44);
  });

  it('falls back to the token detail ratio for the same token', () => {
    for (const tokenToAssetRatio of [undefined, '', '0', 'n/a']) {
      expect(
        getMarketStockChartPreviousClose({
          priceSource: 'token',
          stockDetail,
          selectedTokenVariant: {
            networkId: 'evm--1',
            contractAddress: '0xabc',
            tokenToAssetRatio,
          },
          tokenDetail,
          tokenDetailNetworkId,
        }),
      ).toBeCloseTo(158.11);
    }
    expect(
      getMarketStockChartPreviousClose({
        priceSource: 'token',
        stockDetail,
        tokenDetail,
        tokenDetailNetworkId,
      }),
    ).toBeCloseTo(158.11);
  });

  it("never borrows another token's ratio", () => {
    expect(
      getMarketStockChartPreviousClose({
        priceSource: 'token',
        stockDetail,
        selectedTokenVariant: {
          networkId: 'evm--56',
          contractAddress: '0xother',
          tokenToAssetRatio: 'n/a',
        },
        tokenDetail,
        tokenDetailNetworkId,
      }),
    ).toBe(316.22);
  });
});
