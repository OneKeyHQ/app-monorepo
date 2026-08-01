import { normalizeDeviceProgress } from './deviceProgressUtils';

describe('normalizeDeviceProgress', () => {
  it.each([
    [undefined, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [-10, 0],
    [42.5, 42.5],
    [120, 100],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeDeviceProgress(input)).toBe(expected);
  });
});
