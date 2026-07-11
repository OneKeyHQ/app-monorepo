import { getOrderBookMidPrice } from './utils';

describe('getOrderBookMidPrice', () => {
  it('keeps the live mid price independent from aggregated order book ticks', () => {
    expect(
      getOrderBookMidPrice({
        liveMidPrice: '64145.5',
        bestBid: '64000',
        bestAsk: '65000',
      }),
    ).toBe('64145.5');
  });

  it('falls back to the best bid and ask midpoint when live mid is unavailable', () => {
    expect(
      getOrderBookMidPrice({
        bestBid: '64000',
        bestAsk: '65000',
      }),
    ).toBe('64500');
  });
});
