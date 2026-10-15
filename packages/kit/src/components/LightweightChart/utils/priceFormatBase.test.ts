import { getChartPriceFormatBase } from './priceFormatBase';

describe('getChartPriceFormatBase', () => {
  it('keeps the default cent step from $1 up', () => {
    expect(getChartPriceFormatBase([2377.04, 2540])).toBe(100);
    expect(getChartPriceFormatBase([1, 1.5])).toBe(100);
  });

  it('steps at the fourth significant digit of the smallest sub-dollar quote', () => {
    expect(getChartPriceFormatBase([0.000_411_4, 0.0005])).toBe(1e7);
    expect(getChartPriceFormatBase([0.5, 0.8])).toBe(1e4);
    expect(getChartPriceFormatBase([0.012, 2])).toBe(1e5);
  });

  it('ignores zero, negative sign and non-finite values', () => {
    expect(getChartPriceFormatBase([0, -0.0004, Number.NaN])).toBe(1e7);
    expect(getChartPriceFormatBase([])).toBe(100);
    expect(getChartPriceFormatBase([0])).toBe(100);
  });

  it('caps the base so the step stays clear of the library epsilon', () => {
    expect(getChartPriceFormatBase([1e-15])).toBe(1e12);
  });
});
