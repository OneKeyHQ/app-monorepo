import { getMarketSearchMetricAmount } from './marketSearchMetric';

describe('getMarketSearchMetricAmount', () => {
  it('uses market cap for stock listings', () => {
    expect(
      getMarketSearchMetricAmount({
        isStockListing: true,
        liquidity: '0',
        marketCap: '4200000000000',
      }),
    ).toEqual({
      metric: 'marketCap',
      amount: '4200000000000',
    });
  });

  it('uses liquidity for token listings', () => {
    expect(
      getMarketSearchMetricAmount({
        isStockListing: false,
        liquidity: '2340000',
        marketCap: '4200000000000',
      }),
    ).toEqual({
      metric: 'liquidity',
      amount: '2340000',
    });
  });
});
