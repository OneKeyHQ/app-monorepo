import {
  HERO_ATMOSPHERE_TOKEN_BY_INDEX,
  getAtmosphereToken,
} from './heroAtmosphereTokens';

describe('heroAtmosphereTokens', () => {
  it('maps index 0 (trading) to blue9', () => {
    expect(getAtmosphereToken(0)).toBe('blue9');
  });

  it('maps index 1 (earning) to amber9', () => {
    expect(getAtmosphereToken(1)).toBe('amber9');
  });

  it('maps index 2 (swapping) to purple9', () => {
    expect(getAtmosphereToken(2)).toBe('purple9');
  });

  it('maps index 3 (buying) to brand9', () => {
    expect(getAtmosphereToken(3)).toBe('brand9');
  });

  it('falls back to brand9 for out-of-range index', () => {
    expect(getAtmosphereToken(99)).toBe('brand9');
    expect(getAtmosphereToken(-1)).toBe('brand9');
  });

  it('exposes HERO_ATMOSPHERE_TOKEN_BY_INDEX with 4 entries', () => {
    expect(Object.keys(HERO_ATMOSPHERE_TOKEN_BY_INDEX)).toHaveLength(4);
  });
});
