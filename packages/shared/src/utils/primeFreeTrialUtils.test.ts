import { appLocale } from '../locale/appLocale';

import {
  formatPrimeFreeTrialReservationEnd,
  formatPrimeFreeTrialResetDate,
} from './primeFreeTrialUtils';

import type { ILocaleSymbol } from '../locale';

// Built from local components so the output does not depend on the time zone.
const RESET_AT = new Date(2026, 10, 1, 8, 0).getTime();

// Date formatting only reads the locale, not the messages.
function setLocale(locale: ILocaleSymbol) {
  appLocale.setLocale(locale, {} as Parameters<typeof appLocale.setLocale>[1]);
}

describe('primeFreeTrialUtils time formatting', () => {
  afterEach(() => {
    setLocale('en-US');
  });

  it('formats the reset date in the app language', () => {
    setLocale('en-US');
    expect(formatPrimeFreeTrialResetDate(RESET_AT)).toBe(
      'Nov 1, 2026, 8:00 AM',
    );

    setLocale('zh-CN');
    expect(formatPrimeFreeTrialResetDate(RESET_AT)).toBe(
      '2026-11-01 上午 8:00',
    );

    setLocale('ja-JP');
    expect(formatPrimeFreeTrialResetDate(RESET_AT)).toBe('2026/11/01 8:00');
  });

  it('formats the reservation end time in the app language', () => {
    setLocale('zh-CN');
    expect(formatPrimeFreeTrialReservationEnd(RESET_AT)).toBe('上午 8:00');

    setLocale('en-US');
    expect(formatPrimeFreeTrialReservationEnd(RESET_AT)).toBe('8:00 AM');
  });

  it('returns undefined for a missing or invalid time', () => {
    expect(formatPrimeFreeTrialResetDate(undefined)).toBeUndefined();
    expect(formatPrimeFreeTrialResetDate(Number.NaN)).toBeUndefined();
    expect(formatPrimeFreeTrialReservationEnd(0)).toBeUndefined();
  });
});
