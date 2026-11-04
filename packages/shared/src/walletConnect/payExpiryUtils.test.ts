import {
  getWcPayEffectiveExpiryMs,
  isWcPayExpired,
  normalizeWcPayExpiryMs,
} from './payExpiryUtils';

const SEC_EPOCH = 1_754_300_000; // seconds epoch (~2025)
const MS_EPOCH = 1_754_300_000_000; // same instant in milliseconds

describe('normalizeWcPayExpiryMs', () => {
  it('passes milliseconds epochs through unchanged', () => {
    expect(normalizeWcPayExpiryMs(MS_EPOCH)).toBe(MS_EPOCH);
  });

  it('converts seconds epochs to milliseconds', () => {
    expect(normalizeWcPayExpiryMs(SEC_EPOCH)).toBe(MS_EPOCH);
  });

  it('treats missing or non-positive values as no deadline', () => {
    expect(normalizeWcPayExpiryMs(undefined)).toBeUndefined();
    expect(normalizeWcPayExpiryMs(0)).toBeUndefined();
    expect(normalizeWcPayExpiryMs(-1)).toBeUndefined();
  });
});

describe('getWcPayEffectiveExpiryMs', () => {
  it('returns the earlier of info and option deadlines', () => {
    expect(
      getWcPayEffectiveExpiryMs({
        infoExpiresAt: MS_EPOCH + 60_000,
        optionExpiresAt: MS_EPOCH,
      }),
    ).toBe(MS_EPOCH);
    expect(
      getWcPayEffectiveExpiryMs({
        infoExpiresAt: MS_EPOCH,
        optionExpiresAt: MS_EPOCH + 60_000,
      }),
    ).toBe(MS_EPOCH);
  });

  it('compares mixed seconds/milliseconds units on the same scale', () => {
    // option in seconds expires before info in milliseconds
    expect(
      getWcPayEffectiveExpiryMs({
        infoExpiresAt: MS_EPOCH + 60_000,
        optionExpiresAt: SEC_EPOCH,
      }),
    ).toBe(MS_EPOCH);
  });

  it('falls back to whichever deadline exists', () => {
    expect(
      getWcPayEffectiveExpiryMs({
        infoExpiresAt: undefined,
        optionExpiresAt: SEC_EPOCH,
      }),
    ).toBe(MS_EPOCH);
    expect(
      getWcPayEffectiveExpiryMs({
        infoExpiresAt: MS_EPOCH,
        optionExpiresAt: undefined,
      }),
    ).toBe(MS_EPOCH);
    expect(
      getWcPayEffectiveExpiryMs({
        infoExpiresAt: undefined,
        optionExpiresAt: undefined,
      }),
    ).toBeUndefined();
  });
});

describe('isWcPayExpired', () => {
  it('is false without a deadline', () => {
    expect(isWcPayExpired(undefined, MS_EPOCH)).toBe(false);
  });

  it('flips exactly at the deadline', () => {
    expect(isWcPayExpired(MS_EPOCH, MS_EPOCH - 1)).toBe(false);
    expect(isWcPayExpired(MS_EPOCH, MS_EPOCH)).toBe(true);
    expect(isWcPayExpired(MS_EPOCH, MS_EPOCH + 1)).toBe(true);
  });
});
