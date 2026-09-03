// otsuThreshold/toGrayScale/shouldInvertForMajorityWhite are pure functions,
// but the module's top-level imports pull in native-only packages this
// environment doesn't support.
import {
  hasSplittableLuminanceRange,
  otsuThreshold,
  shouldInvertForMajorityWhite,
  toGrayScale,
} from './imageUtils';

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
    const luminance = new Uint8ClampedArray(20).fill(10);
    luminance[15] = 200;
    const threshold = otsuThreshold(luminance);
    expect(threshold).toBeGreaterThanOrEqual(10);
    expect(threshold).toBeLessThan(200);
  });
});

describe('hasSplittableLuminanceRange', () => {
  it('splits once the spread is wide enough', () => {
    expect(hasSplittableLuminanceRange(100, 132)).toBe(true);
  });

  it('refuses a mid-gray spread rather than cutting it at 128', () => {
    // The failure this guard exists for: a spread narrow enough to be noise but
    // sitting across the cut point, which a threshold turns into a checkerboard.
    expect(hasSplittableLuminanceRange(113, 144)).toBe(false);
    expect(hasSplittableLuminanceRange(112, 142)).toBe(false);
  });

  it('refuses near-black and near-white spreads', () => {
    expect(hasSplittableLuminanceRange(0, 20)).toBe(false);
    expect(hasSplittableLuminanceRange(235, 255)).toBe(false);
  });
});

describe('shouldInvertForMajorityWhite', () => {
  it('does not invert when white is a clear minority (skewed cartoon art)', () => {
    // A handful of bright accent-color pixels can pull the image's overall
    // look brighter even though most pixels land on the black side of the
    // Otsu threshold. White stays a clear ~39% minority, so this must not invert.
    expect(shouldInvertForMajorityWhite(386, 1000)).toBe(false);
  });

  it('does not invert when the ratio sits inside the dead zone around 50%', () => {
    expect(shouldInvertForMajorityWhite(510, 1000)).toBe(false);
    expect(shouldInvertForMajorityWhite(490, 1000)).toBe(false);
  });

  it('inverts once white is unambiguously past the dead zone', () => {
    expect(shouldInvertForMajorityWhite(560, 1000)).toBe(true);
    expect(shouldInvertForMajorityWhite(950, 1000)).toBe(true);
  });

  it('never inverts a fully black image and always inverts a fully white one', () => {
    expect(shouldInvertForMajorityWhite(0, 1000)).toBe(false);
    expect(shouldInvertForMajorityWhite(1000, 1000)).toBe(true);
  });

  it('keeps the (50%, 55%] band un-inverted, unlike the old plain >50% rule', () => {
    // The pre-fix code inverted as soon as post-threshold white passed 50%.
    // This dead zone is the actual behavior change: values here now stay
    // un-inverted where they used to flip.
    expect(shouldInvertForMajorityWhite(501, 1000)).toBe(false);
    expect(shouldInvertForMajorityWhite(550, 1000)).toBe(false);
    expect(shouldInvertForMajorityWhite(551, 1000)).toBe(true);
  });
});
