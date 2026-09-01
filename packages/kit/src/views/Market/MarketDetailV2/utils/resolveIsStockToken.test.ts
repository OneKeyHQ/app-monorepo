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

  it('does not infer stock identity from a token symbol', () => {
    expect(resolveMarketStockId({ stock: {} })).toBeUndefined();
  });

  it('does not classify ordinary tokens as stocks', () => {
    expect(resolveMarketStockId({})).toBeUndefined();
  });
});
