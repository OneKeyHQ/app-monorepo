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
          underlyingAssetTicker: 'fallback',
        },
      }),
    ).toBe('ABNB');
  });

  it('prefers the explicit underlying ticker', () => {
    expect(
      resolveMarketStockId({
        stock: { underlyingAssetTicker: 'aapl' },
      }),
    ).toBe('AAPL');
  });

  it('uses an explicit stock id supplied by an adapter', () => {
    expect(resolveMarketStockId({ stockId: ' tsla ' })).toBe('TSLA');
  });

  it.each(['', ' ', '\t\n'])('skips blank stock ids (%j)', (stockId) => {
    expect(
      resolveMarketStockId({
        stockId,
        stock: { stockId: ' abnb ', underlyingAssetTicker: 'AAPL' },
      }),
    ).toBe('ABNB');
    expect(
      resolveMarketStockId({
        stockId,
        stock: { stockId, underlyingAssetTicker: ' aapl ' },
      }),
    ).toBe('AAPL');
    expect(
      resolveMarketStockId({
        stock: { stockId, underlyingAssetTicker: ' aapl ' },
      }),
    ).toBe('AAPL');
  });

  it('prefers a nonblank adapter stock id over other identifiers', () => {
    expect(
      resolveMarketStockId({
        stockId: ' tsla ',
        stock: { stockId: 'ABNB', underlyingAssetTicker: 'AAPL' },
      }),
    ).toBe('TSLA');
  });

  it('infers xStocks identity when every explicit identifier is blank', () => {
    expect(
      resolveMarketStockId({
        stockId: '',
        stock: { stockId: ' ', underlyingAssetTicker: '\t' },
        name: 'Airbnb xStock',
        symbol: 'ABNBx',
      }),
    ).toBe('ABNB');
  });

  it('resolves an xStocks token when search metadata omits stock', () => {
    expect(
      resolveMarketStockId({
        name: 'Airbnb xStock',
        symbol: 'ABNBx',
      }),
    ).toBe('ABNB');
  });

  it('does not infer stock identity from the x suffix alone', () => {
    expect(
      resolveMarketStockId({
        name: 'Example Token',
        symbol: 'ABNBx',
      }),
    ).toBeUndefined();
  });

  it('does not classify ordinary tokens as stocks', () => {
    expect(resolveMarketStockId({})).toBeUndefined();
  });
});
