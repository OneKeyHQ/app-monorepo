import { buildMarketStockDetail } from './marketStockUtils';

describe('buildMarketStockDetail', () => {
  it('maps stock asset fundamentals to the shared Market stock model', () => {
    const detail = buildMarketStockDetail({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: 'https://example.com/aapl.png',
      underlyingUpdatedAt: '2026-07-15T08:00:00.000Z',
      underlyingMeta: {
        introduction: 'Apple introduction',
        marketCap: '4624460910160',
        volume24h: '11438536975.32',
        volumeShares: '36328962',
        turnoverRate24h: '0.2473485493',
        weekHigh52: '323.45',
        weekLow52: '201.5',
        peRatioTTM: '38.28',
        priceToBookRatioTTM: '43.83',
        priceToSalesRatioTTM: '10.32',
        returnOnEquityTTM: '1.4669',
        returnOnAssetsTTM: '0.3303',
        netProfitMarginTTM: '0.2715',
        debtToEquityRatioTTM: '0.7955',
        dividendYieldTTM: '0.0033',
        dividendPerShareTTM: '1.05',
        sharesOutstanding: '14687356000',
      },
    });

    expect(detail).toEqual({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: 'https://example.com/aapl.png',
      introduction: 'Apple introduction',
      underlyingUpdatedAt: '2026-07-15T08:00:00.000Z',
      stock: {
        title: 'AAPL',
        subtitle: 'Apple Inc.',
        sourceLogoUri: 'https://example.com/aapl.png',
        assetAnalysis: {
          volume24h: '11438536975.32',
          volumeShares: '36328962',
          turnoverRate: '0.2473485493',
          weekHigh52: '323.45',
          weekLow52: '201.5',
        },
        tradingActivity: {
          peRatio: '38.28',
          pbRatio: '43.83',
          psRatio: '10.32',
          roe: '1.4669',
          roa: '0.3303',
          netProfitMargin: '0.2715',
          debtToEquity: '0.7955',
          dividendYield: '0.0033',
        },
        dividendPerShare: '1.05',
        marketCap: '4624460910160',
        sharesOutstanding: '14687356000',
        underlyingAssetTicker: 'AAPL',
        underlyingAssetName: 'Apple Inc.',
      },
    });
  });
});
