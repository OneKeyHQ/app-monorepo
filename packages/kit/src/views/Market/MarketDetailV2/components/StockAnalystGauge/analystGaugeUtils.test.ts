import {
  describeStockAnalystGaugeArc,
  getStockAnalystGaugeAngle,
  getStockAnalystGaugeScore,
  getStockAnalystGaugeZoneIndex,
  parseStockAnalystRatingCounts,
  polarToCartesian,
} from './analystGaugeUtils';

describe('analystGaugeUtils', () => {
  it('parses the string rating buckets and ignores unusable values', () => {
    expect(
      parseStockAnalystRatingCounts({
        analystRatingsStrongBuy: '20',
        analystRatingsBuy: '15',
        analystRatingsHold: '10',
        analystRatingsSell: '',
        analystRatingsStrongSell: 'n/a',
      }),
    ).toEqual({
      strongSell: 0,
      sell: 0,
      hold: 10,
      buy: 15,
      strongBuy: 20,
      total: 45,
    });
    expect(parseStockAnalystRatingCounts().total).toBe(0);
  });

  it('scores the dial from the five rating buckets', () => {
    const counts = parseStockAnalystRatingCounts({
      analystRatingsStrongBuy: '1',
      analystRatingsBuy: '1',
      analystRatingsHold: '1',
      analystRatingsSell: '1',
      analystRatingsStrongSell: '1',
    });
    // Evenly spread ratings average out to the middle of the dial.
    expect(getStockAnalystGaugeScore({ counts })).toBe(2);
    expect(
      getStockAnalystGaugeScore({
        counts: parseStockAnalystRatingCounts({
          analystRatingsStrongBuy: '4',
        }),
      }),
    ).toBe(4);
    expect(
      getStockAnalystGaugeScore({
        counts: parseStockAnalystRatingCounts({
          analystRatingsStrongSell: '3',
        }),
      }),
    ).toBe(0);
  });

  it('falls back to the normalized percentages when counts are missing', () => {
    expect(
      getStockAnalystGaugeScore({
        counts: parseStockAnalystRatingCounts(),
        ratings: { buy: 70, hold: 20, sell: 10 },
      }),
    ).toBeCloseTo(2.6, 5);
    // Percentages that do not add up to 100 are normalized by their own sum.
    expect(
      getStockAnalystGaugeScore({
        ratings: { buy: 1, hold: 1, sell: 0 },
      }),
    ).toBeCloseTo(2.5, 5);
  });

  it('has no score when neither counts nor percentages carry data', () => {
    expect(getStockAnalystGaugeScore({})).toBeUndefined();
    expect(
      getStockAnalystGaugeScore({
        counts: parseStockAnalystRatingCounts(),
        ratings: { buy: 0, hold: 0, sell: 0 },
      }),
    ).toBeUndefined();
  });

  it('maps the score onto the half circle', () => {
    expect(getStockAnalystGaugeAngle(0)).toBe(180);
    expect(getStockAnalystGaugeAngle(2)).toBe(90);
    expect(getStockAnalystGaugeAngle(4)).toBe(0);
    expect(getStockAnalystGaugeAngle(3)).toBe(45);
    // Out of range scores clamp to the dial ends.
    expect(getStockAnalystGaugeAngle(-1)).toBe(180);
    expect(getStockAnalystGaugeAngle(9)).toBe(0);
    expect(getStockAnalystGaugeAngle(Number.NaN)).toBe(180);
  });

  it('resolves the zone the needle points at', () => {
    expect(getStockAnalystGaugeZoneIndex(0)).toBe(0);
    expect(getStockAnalystGaugeZoneIndex(1)).toBe(1);
    expect(getStockAnalystGaugeZoneIndex(2)).toBe(2);
    expect(getStockAnalystGaugeZoneIndex(3)).toBe(3);
    expect(getStockAnalystGaugeZoneIndex(4)).toBe(4);
    // Zone boundaries sit every 0.8 score points, mirroring the 36deg bands.
    expect(getStockAnalystGaugeZoneIndex(0.79)).toBe(0);
    expect(getStockAnalystGaugeZoneIndex(0.8)).toBe(1);
    expect(getStockAnalystGaugeZoneIndex(3.19)).toBe(3);
    expect(getStockAnalystGaugeZoneIndex(3.2)).toBe(4);
  });

  it('places dial points with the screen y axis pointing down', () => {
    expect(
      polarToCartesian({ cx: 100, cy: 100, radius: 50, angle: 180 }),
    ).toEqual({ x: 50, y: 100 });
    const top = polarToCartesian({ cx: 100, cy: 100, radius: 50, angle: 90 });
    expect(top.x).toBeCloseTo(100, 5);
    expect(top.y).toBeCloseTo(50, 5);
  });

  it('draws the band clockwise from the sell end', () => {
    expect(
      describeStockAnalystGaugeArc({
        cx: 100,
        cy: 100,
        radius: 50,
        startAngle: 180,
        endAngle: 0,
      }),
    ).toBe('M 50 100 A 50 50 0 0 1 150 100');
    expect(
      describeStockAnalystGaugeArc({
        cx: 100,
        cy: 100,
        radius: 50,
        startAngle: 180,
        endAngle: 90,
      }),
    ).toBe('M 50 100 A 50 50 0 0 1 100 50');
  });

  it('draws nothing for an empty band', () => {
    expect(
      describeStockAnalystGaugeArc({
        cx: 100,
        cy: 100,
        radius: 50,
        startAngle: 180,
        endAngle: 180,
      }),
    ).toBe('');
    expect(
      describeStockAnalystGaugeArc({
        cx: 100,
        cy: 100,
        radius: 0,
        startAngle: 180,
        endAngle: 0,
      }),
    ).toBe('');
  });
});
