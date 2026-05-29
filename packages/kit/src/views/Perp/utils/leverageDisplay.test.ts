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
