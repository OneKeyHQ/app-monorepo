import {
  getTickingPlaces,
  getTickingStepSeconds,
  splitTickingValue,
} from './earnTicking.utils';

const SECONDS_PER_DAY = 24 * 60 * 60;

describe('the places a growing total shows', () => {
  it('adds places until the last one moves at least every two seconds', () => {
    // $0.02 a day: 2.3 a second at seven places, one every four at six
    expect(getTickingPlaces(0.02 / SECONDS_PER_DAY)).toBe(7);
    // $1.37 a day (about $10,000 at 5%)
    expect(getTickingPlaces(1.37 / SECONDS_PER_DAY)).toBe(5);
    // $137 a day
    expect(getTickingPlaces(137 / SECONDS_PER_DAY)).toBe(3);
  });

  it('keeps to the cents when they move often enough themselves', () => {
    expect(getTickingPlaces(500 / SECONDS_PER_DAY)).toBe(2);
  });

  it('keeps to the cents when no place allowed would be seen moving', () => {
    expect(getTickingPlaces(0.0001 / SECONDS_PER_DAY)).toBe(2);
    expect(getTickingPlaces(0)).toBe(2);
    expect(getTickingPlaces(-1)).toBe(2);
  });

  it('says how long the last place takes to change', () => {
    expect(getTickingStepSeconds(0.005, 2)).toBeCloseTo(2, 6);
    expect(getTickingStepSeconds(0.000_02, 5)).toBeCloseTo(0.5, 6);
  });
});

describe('a total cut at its cents', () => {
  it('cuts, so the digits continue the cents before them', () => {
    expect(splitTickingValue(133.889_974_1, 7)).toEqual({
      cents: '133.88',
      digits: '99741',
    });
    expect(splitTickingValue(1_234_567.891, 3)).toEqual({
      cents: '1234567.89',
      digits: '1',
    });
  });

  it('leaves the total whole where it shows the cents alone', () => {
    expect(splitTickingValue(129.2, 2)).toEqual({ cents: '129.2', digits: '' });
  });

  it('leaves a total under a cent to the formatter', () => {
    expect(splitTickingValue(0.004, 8)).toEqual({ cents: '0.004', digits: '' });
    expect(splitTickingValue(-5, 6)).toEqual({ cents: '-5', digits: '' });
  });
});
