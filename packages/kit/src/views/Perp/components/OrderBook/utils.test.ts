import {
  getOrderBookDistanceFromMid,
  getOrderBookHoverSummary,
  getOrderBookLiveMidPrice,
  getOrderBookMidPrice,
} from './utils';

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

describe('getOrderBookHoverSummary', () => {
  const levels = [
    {
      price: '100',
      size: '2',
      cumSize: '2',
    },
    {
      price: '102',
      size: '3',
      cumSize: '5',
    },
    {
      price: '105',
      size: '1',
      cumSize: '6',
    },
  ];

  it('summarizes levels from the best price through the hovered level', () => {
    expect(getOrderBookHoverSummary(levels, 1)).toEqual({
      averagePrice: '101.2',
      totalSize: '5',
      totalNotional: '506',
    });
  });

  it('uses only the best level when the first row is hovered', () => {
    expect(getOrderBookHoverSummary(levels, 0)).toEqual({
      averagePrice: '100',
      totalSize: '2',
      totalNotional: '200',
    });
  });

  it('returns null for an invalid level index', () => {
    expect(getOrderBookHoverSummary(levels, -1)).toBeNull();
    expect(getOrderBookHoverSummary(levels, levels.length)).toBeNull();
  });
});

describe('getOrderBookDistanceFromMid', () => {
  it('calculates the absolute percentage distance from the midpoint', () => {
    expect(getOrderBookDistanceFromMid('54.793', '54.8065')).toBe(
      '0.024632114803900997',
    );
    expect(getOrderBookDistanceFromMid('54.82', '54.8065')).toBe(
      '0.024632114803900997',
    );
  });

  it('returns null when the midpoint is invalid', () => {
    expect(getOrderBookDistanceFromMid('54.8', '0')).toBeNull();
    expect(getOrderBookDistanceFromMid('54.8', 'invalid')).toBeNull();
  });
});
