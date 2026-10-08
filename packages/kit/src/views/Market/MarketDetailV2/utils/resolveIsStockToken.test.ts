import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import {
  resolveIsStockToken,
  resolveMarketStockId,
} from './resolveIsStockToken';

const previewStock: IMarketStockInfo = {
  subtitle: 'Apple Inc.',
  sourceLogoUri: 'https://example.com/logo.png',
};

const detailStock: IMarketStockInfo = {
  ...previewStock,
  stockId: 'AAPL',
  underlyingAssetTicker: 'AAPL',
};

describe('resolveIsStockToken', () => {
  it('identifies a stock from preview data before full detail loads', () => {
    expect(resolveIsStockToken(undefined, { stock: previewStock })).toBe(true);
  });

  it('identifies a stock from full detail data', () => {
    expect(resolveIsStockToken({ stock: detailStock })).toBe(true);
  });

  it('returns false when neither source identifies a stock', () => {
    expect(resolveIsStockToken({}, {})).toBe(false);
  });
});

describe('resolveMarketStockId', () => {
  it('uses the stock id returned by the market search payload', () => {
    expect(
      resolveMarketStockId({
        stock: {
          stockId: ' abnb ',
        },
      }),
    ).toBe('ABNB');
  });

  it('does not treat an underlying ticker as a stock id', () => {
    expect(
      resolveMarketStockId({
        stock: { stockId: undefined },
      }),
    ).toBeUndefined();
  });

  it('uses an explicit stock id supplied by an adapter', () => {
    expect(resolveMarketStockId({ stockId: ' tsla ' })).toBe('TSLA');
  });

  it.each(['', ' ', '\t\n'])('skips blank stock ids (%j)', (stockId) => {
    expect(
      resolveMarketStockId({
        stockId,
        stock: { stockId: ' abnb ' },
      }),
    ).toBe('ABNB');
    expect(
      resolveMarketStockId({
        stockId,
        stock: { stockId },
      }),
    ).toBeUndefined();
  });

  it('prefers a nonblank adapter stock id over nested identifiers', () => {
    expect(
      resolveMarketStockId({
        stockId: ' tsla ',
        stock: { stockId: 'ABNB' },
      }),
    ).toBe('TSLA');
  });

  it('does not infer a stock id from xStock naming', () => {
    expect(
      resolveMarketStockId({
        stockId: '',
        stock: { stockId: ' ' },
      }),
    ).toBeUndefined();
  });

  it('does not classify ordinary tokens as stocks', () => {
    expect(resolveMarketStockId({})).toBeUndefined();
  });
});
