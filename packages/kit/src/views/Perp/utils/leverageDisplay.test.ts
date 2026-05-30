import {
  getPerpsDisplayLeverage,
  getPerpsFormLeverage,
} from './leverageDisplay';

describe('perps leverage display helpers', () => {
  it('prefers live leverage over cached leverage and max leverage', () => {
    expect(
      getPerpsDisplayLeverage({
        liveLeverage: 18,
        cachedLeverage: 20,
        maxLeverage: 40,
      }),
    ).toBe(18);
  });

  it('uses cached leverage before max leverage while live asset data is pending', () => {
    expect(
      getPerpsDisplayLeverage({
        cachedLeverage: 18,
        maxLeverage: 40,
      }),
    ).toBe(18);
  });

  it('clamps cached display leverage to the market maximum', () => {
    expect(
      getPerpsDisplayLeverage({
        cachedLeverage: 40,
        maxLeverage: 25,
      }),
    ).toBe(25);
  });

  it('clamps live display leverage to the market maximum', () => {
    expect(
      getPerpsDisplayLeverage({
        liveLeverage: 40,
        cachedLeverage: 20,
        maxLeverage: 25,
      }),
    ).toBe(25);
  });

  it('does not inject max leverage into the trading form', () => {
    expect(
      getPerpsFormLeverage({
        isSpot: false,
      }),
    ).toBeUndefined();
  });

  it('keeps cached leverage out of the trading form', () => {
    expect(
      getPerpsFormLeverage({
        isSpot: false,
        cachedLeverage: 20,
      }),
    ).toBeUndefined();
  });

  it('rejects invalid live leverage in the trading form', () => {
    [0, -5, Number.NaN, Number.POSITIVE_INFINITY].forEach((liveLeverage) => {
      expect(
        getPerpsFormLeverage({
          isSpot: false,
          liveLeverage,
        }),
      ).toBeUndefined();
    });
  });

  it('falls back to 1 when no valid display leverage exists', () => {
    expect(
      getPerpsDisplayLeverage({
        liveLeverage: Number.NaN,
        cachedLeverage: -1,
        maxLeverage: 0,
      }),
    ).toBe(1);
  });

  it('does not clamp a valid leverage down to an invalid maximum', () => {
    expect(
      getPerpsDisplayLeverage({
        liveLeverage: 12,
        maxLeverage: 0,
      }),
    ).toBe(12);
  });

  it('uses spot leverage as 1', () => {
    expect(
      getPerpsFormLeverage({
        isSpot: true,
        liveLeverage: 18,
        cachedLeverage: 20,
      }),
    ).toBe(1);
  });
});
