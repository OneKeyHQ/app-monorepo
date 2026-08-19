// otsuThreshold/toGrayScale are pure functions, but the module's top-level
// imports pull in native-only packages this environment doesn't support.
import { otsuThreshold, toGrayScale } from './imageUtils';

jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('stackblur-canvas', () => ({ canvasRGBA: () => {} }));

describe('toGrayScale', () => {
  it('weights green highest and blue lowest, matching ITU-R BT.601 luma', () => {
    expect(toGrayScale(255, 0, 0)).toBe(76);
    expect(toGrayScale(0, 255, 0)).toBe(150);
    expect(toGrayScale(0, 0, 255)).toBe(29);
    expect(toGrayScale(255, 255, 255)).toBe(255);
    expect(toGrayScale(0, 0, 0)).toBe(0);
  });
});

describe('otsuThreshold', () => {
  it('splits a clearly bimodal histogram between the two clusters', () => {
    const luminance = new Uint8ClampedArray(200);
    luminance.fill(30, 0, 100);
    luminance.fill(220, 100, 200);
    const threshold = otsuThreshold(luminance);
    expect(threshold).toBeGreaterThanOrEqual(30);
    expect(threshold).toBeLessThan(220);
  });

  it('falls back to the default 128 when every pixel is identical', () => {
    const luminance = new Uint8ClampedArray(100).fill(90);
    expect(otsuThreshold(luminance)).toBe(128);
  });

  it('does not throw on an empty array', () => {
    expect(otsuThreshold(new Uint8ClampedArray(0))).toBe(128);
  });

  it('picks a threshold inside a two-value histogram, not defaulting to 128', () => {
    const luminance = new Uint8ClampedArray(20);
    luminance.fill(10, 0, 10);
    luminance.fill(10, 10, 20);
    luminance[15] = 200;
    const threshold = otsuThreshold(luminance);
    expect(threshold).toBeGreaterThanOrEqual(10);
    expect(threshold).toBeLessThan(200);
  });
});
