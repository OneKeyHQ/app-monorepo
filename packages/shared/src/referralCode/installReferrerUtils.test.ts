import {
  INSTALL_REFERRER_CAPTURE_WINDOW_DAYS,
  INSTALL_REFERRER_TTL_DAYS,
  isInstallReferrerCaptureFinal,
  isInstallReferrerCaptureWindowClosed,
  isInstallReferrerExpired,
  isValidInviteCode,
  pickInviteCodeFromReferrerValue,
} from './installReferrerUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('isValidInviteCode', () => {
  it('accepts alphanumeric codes up to 30 characters', () => {
    expect(isValidInviteCode('ABC123')).toBe(true);
    expect(isValidInviteCode('a'.repeat(30))).toBe(true);
  });

  it('rejects empty, over-long and non-alphanumeric codes', () => {
    expect(isValidInviteCode(undefined)).toBe(false);
    expect(isValidInviteCode('')).toBe(false);
    expect(isValidInviteCode('a'.repeat(31))).toBe(false);
    expect(isValidInviteCode('abc-123')).toBe(false);
  });
});

describe('pickInviteCodeFromReferrerValue', () => {
  it('accepts a valid code', () => {
    expect(pickInviteCodeFromReferrerValue('ABC123')).toBe('ABC123');
  });

  it('trims surrounding whitespace', () => {
    expect(pickInviteCodeFromReferrerValue('  ABC  ')).toBe('ABC');
  });

  it('returns undefined for a missing or unusable value', () => {
    expect(pickInviteCodeFromReferrerValue(undefined)).toBeUndefined();
    expect(pickInviteCodeFromReferrerValue('')).toBeUndefined();
    expect(pickInviteCodeFromReferrerValue('   ')).toBeUndefined();
    expect(pickInviteCodeFromReferrerValue('bad-code')).toBeUndefined();
  });
});

describe('isInstallReferrerExpired', () => {
  const now = 1_700_000_000_000;

  it('accepts a code inside the TTL', () => {
    expect(
      isInstallReferrerExpired({
        attributedAt: now - (INSTALL_REFERRER_TTL_DAYS - 1) * DAY_MS,
        now,
      }),
    ).toBe(false);
  });

  it('accepts a code exactly at the TTL boundary', () => {
    expect(
      isInstallReferrerExpired({
        attributedAt: now - INSTALL_REFERRER_TTL_DAYS * DAY_MS,
        now,
      }),
    ).toBe(false);
  });

  it('rejects a code past the TTL', () => {
    expect(
      isInstallReferrerExpired({
        attributedAt: now - (INSTALL_REFERRER_TTL_DAYS + 1) * DAY_MS,
        now,
      }),
    ).toBe(true);
  });

  it('does not expire a timestamp slightly ahead of device time', () => {
    expect(isInstallReferrerExpired({ attributedAt: now + 60_000, now })).toBe(
      false,
    );
  });

  it('treats a missing or invalid timestamp as expired', () => {
    expect(isInstallReferrerExpired({ attributedAt: 0, now })).toBe(true);
    expect(isInstallReferrerExpired({ attributedAt: Number.NaN, now })).toBe(
      true,
    );
  });

  it('honours a custom ttl', () => {
    expect(
      isInstallReferrerExpired({
        attributedAt: now - 20 * DAY_MS,
        now,
        ttlDays: 14,
      }),
    ).toBe(true);
  });
});

describe('isInstallReferrerCaptureWindowClosed', () => {
  const now = 1_700_000_000_000;

  it('stays open inside the window', () => {
    expect(
      isInstallReferrerCaptureWindowClosed({
        installedAt: now - (INSTALL_REFERRER_CAPTURE_WINDOW_DAYS - 1) * DAY_MS,
        now,
      }),
    ).toBe(false);
  });

  it('stays open exactly at the boundary', () => {
    expect(
      isInstallReferrerCaptureWindowClosed({
        installedAt: now - INSTALL_REFERRER_CAPTURE_WINDOW_DAYS * DAY_MS,
        now,
      }),
    ).toBe(false);
  });

  it('closes past the window', () => {
    expect(
      isInstallReferrerCaptureWindowClosed({
        installedAt: now - (INSTALL_REFERRER_CAPTURE_WINDOW_DAYS + 1) * DAY_MS,
        now,
      }),
    ).toBe(true);
  });

  it('treats a missing or invalid install time as closed', () => {
    expect(isInstallReferrerCaptureWindowClosed({ installedAt: 0, now })).toBe(
      true,
    );
    expect(
      isInstallReferrerCaptureWindowClosed({ installedAt: Number.NaN, now }),
    ).toBe(true);
  });
});

describe('isInstallReferrerCaptureFinal', () => {
  const now = 1_700_000_000_000;
  const recentInstall = now - DAY_MS;
  const staleInstall =
    now - (INSTALL_REFERRER_CAPTURE_WINDOW_DAYS + 1) * DAY_MS;

  it('is final when a non-empty referrer carried no code', () => {
    expect(
      isInstallReferrerCaptureFinal({
        hasReferrer: true,
        installedAt: recentInstall,
        now,
      }),
    ).toBe(true);
  });

  it('keeps retrying an empty referrer inside the window', () => {
    expect(
      isInstallReferrerCaptureFinal({
        hasReferrer: false,
        installedAt: recentInstall,
        now,
      }),
    ).toBe(false);
  });

  it('gives up on an empty referrer once the window has closed', () => {
    expect(
      isInstallReferrerCaptureFinal({
        hasReferrer: false,
        installedAt: staleInstall,
        now,
      }),
    ).toBe(true);
  });
});
