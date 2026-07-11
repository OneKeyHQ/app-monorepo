import { getOrderBookLiveMidPrice, getOrderBookMidPrice } from './utils';

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

  it('only uses the real spot mid price for spot books', () => {
    expect(
      getOrderBookLiveMidPrice({
        isSpot: true,
        spotMidPrice: undefined,
        tradingMidPrice: '99',
      }),
    ).toBeUndefined();
  });
});
