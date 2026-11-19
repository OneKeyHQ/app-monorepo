import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';
import { getDefaultLocale } from '../locale/getDefaultLocale';

import {
  formatDate,
  formatDateFns,
  formatDateTimeParts,
  formatMonth,
  formatRelativeDate,
  formatRelativeTimeAbbr,
  formatTime,
  getDateFormatTemplate,
  getDateTimeParts,
} from './dateUtils';

import type { ILocaleSymbol } from '../locale';

jest.mock('../locale/getDefaultLocale', () => ({
  getDefaultLocale: jest.fn(() => 'en-US'),
}));

const DATE = new Date(2026, 9, 14, 19, 26, 32, 7);

describe('App date and time display policy', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 24, 12));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each<[ILocaleSymbol, string]>([
    ['en', '10/14/2026'],
    ['en-US', '10/14/2026'],
    ['zh-CN', '2026/10/14'],
    ['zh-HK', '14/10/2026'],
    ['zh-TW', '2026/10/14'],
    ['ja-JP', '2026/10/14'],
    ['ko-KR', '2026. 10. 14.'],
    ['bn', '14/10/2026'],
    ['de', '14.10.2026'],
    ['es', '14/10/2026'],
    ['fr-FR', '14/10/2026'],
    ['hi-IN', '14/10/2026'],
    ['id', '14/10/2026'],
    ['it-IT', '14/10/2026'],
    ['pt', '14/10/2026'],
    ['pt-BR', '14/10/2026'],
    ['ru', '14.10.2026'],
    ['th-TH', '14/10/2026'],
    ['uk-UA', '14.10.2026'],
    ['vi', '14/10/2026'],
  ])(
    'uses the agreed numeric date and 24-hour clock for %s',
    (locale, date) => {
      expect(formatDate(DATE, { locale })).toBe(`${date} 19:26:32`);
      expect(formatDate(DATE, { locale, hideSeconds: true })).toBe(
        `${date} 19:26`,
      );
      expect(formatDate(DATE, { locale, hideTimeForever: true })).toBe(date);
      expect(formatTime(DATE, { locale, hideMilliseconds: true })).toBe(
        '19:26:32',
      );
    },
  );

  it('uses the current App language at call time and resolves Auto', () => {
    const locale = jest.spyOn(appLocale, 'getLocale');
    locale.mockReturnValue('fr-FR');
    expect(formatDate(DATE, { hideSeconds: true })).toBe('14/10/2026 19:26');
    locale.mockReturnValue('en');
    expect(formatDate(DATE, { hideSeconds: true })).toBe('10/14/2026 19:26');
    jest.mocked(getDefaultLocale).mockReturnValue('fr-FR');
    expect(formatDate(DATE, { locale: 'system', hideSeconds: true })).toBe(
      '14/10/2026 19:26',
    );
  });

  it.each<[ILocaleSymbol, string, string, string]>([
    ['en', '10/14', '14/2026', '14'],
    ['zh-CN', '10/14', '2026/14', '14'],
    ['fr-FR', '14/10', '14/2026', '14'],
    ['de', '14.10', '14.2026', '14'],
    ['ko-KR', '10. 14.', '2026. 14.', '14.'],
  ])(
    'removes hidden fields and their separators for %s',
    (locale, noYear, noMonth, day) => {
      expect(
        formatDate(DATE, { locale, hideTimeForever: true, hideYear: true }),
      ).toBe(noYear);
      expect(
        formatDate(DATE, { locale, hideTimeForever: true, hideMonth: true }),
      ).toBe(noMonth);
      expect(
        formatDate(DATE, {
          locale,
          hideTimeForever: true,
          hideYear: true,
          hideMonth: true,
        }),
      ).toBe(day);
    },
  );

  it('preserves conditional hiding independently from always-hidden fields', () => {
    const options = { locale: 'fr-FR', hideTimeForever: true } as const;
    expect(formatDate(DATE, { ...options, hideTheYear: true })).toBe('14/10');
    expect(
      formatDate(new Date(2025, 9, 14), { ...options, hideTheYear: true }),
    ).toBe('14/10/2025');
    expect(formatDate(DATE, { ...options, hideTheMonth: true })).toBe(
      '14/2026',
    );
    expect(
      formatDate(new Date(2026, 8, 14), { ...options, hideTheMonth: true }),
    ).toBe('14/09/2026');
    expect(
      formatDate(new Date(2025, 9, 14), { ...options, hideTheMonth: true }),
    ).toBe('14/2025');
  });

  it('keeps time-only, seconds and milliseconds behavior', () => {
    expect(
      formatDate(DATE, {
        onlyTime: true,
        hideTimeForever: true,
        hideSeconds: true,
      }),
    ).toBe('19:26');
    expect(formatDate(DATE, { onlyTime: true })).toBe('19:26:32');
    expect(formatTime(DATE)).toBe('19:26:32.007');
    expect(formatTime(DATE, { hideSeconds: true })).toBe('19:26');
    expect(formatTime(new Date(2026, 9, 14, 0, 0), { hideSeconds: true })).toBe(
      '00:00',
    );
  });

  it('keeps explicit machine templates and their legacy options', () => {
    expect(
      formatDate(DATE, { formatTemplate: 'ddMMyy', locale: 'th-TH' }),
    ).toBe('141026');
    expect(formatDateFns(DATE, 'yyyyMMdd')).toBe('20261014');
    expect(formatTime(DATE, { formatTemplate: 'yyyyLLdd-HHmmss' })).toBe(
      '20261014-192632',
    );
    expect(
      formatDate(DATE, {
        formatTemplate: 'yyyy/LL/dd, HH:mm:ss',
        hideYear: true,
        hideSeconds: true,
      }),
    ).toBe('10/14, 19:26');
    expect(
      formatDate(DATE, {
        formatTemplate: 'yyyy/LL/dd, HH:mm:ss',
        hideMonth: true,
        hideTimeForever: true,
      }),
    ).toBe('2026/14');
  });

  it('formats year/month fields and the default date-fns wrapper consistently', () => {
    expect(formatMonth(DATE, { locale: 'fr-FR' })).toBe('10/2026');
    expect(formatMonth(DATE, { locale: 'zh-CN' })).toBe('2026/10');
    expect(formatMonth(DATE, { locale: 'fr-FR', hideTheYear: true })).toBe(
      '10',
    );
    expect(formatDateFns(DATE, undefined, 'bn')).toBe('14/10/2026 19:26');
    expect(getDateFormatTemplate('unknown')).toBe('MM/dd/yyyy');
  });

  it('retains Today/Yesterday and localizes older relative dates', () => {
    jest.spyOn(appLocale, 'getLocale').mockReturnValue('fr-FR');
    jest
      .spyOn(appLocale.intl, 'formatMessage')
      .mockImplementation(({ id }) =>
        id === ETranslations.global_date_today ? 'Today' : 'Yesterday',
      );
    expect(formatRelativeDate(DATE)).toBe('14/10/2026');
    expect(formatRelativeDate(new Date(2026, 9, 24))).toBe('Today');
    expect(formatRelativeDate(new Date(2026, 9, 23))).toBe('Yesterday');
  });

  it('preserves explicit time zones, midnight and repeated DST hours', () => {
    const options = {
      locale: 'en',
      hideSeconds: true,
      timeZone: 'America/New_York',
    } as const;
    expect(formatDate('2026-11-01T05:30:00Z', options)).toBe(
      '11/01/2026 01:30',
    );
    expect(formatDate('2026-11-01T06:30:00Z', options)).toBe(
      '11/01/2026 01:30',
    );
    expect(
      formatDate('2026-10-14T16:00:00Z', {
        locale: 'fr-FR',
        hideSeconds: true,
        timeZone: 'Asia/Shanghai',
      }),
    ).toBe('15/10/2026 00:00');
    expect(
      formatTime('2026-10-14T16:00:00Z', {
        hideSeconds: true,
        timeZone: 'UTC',
      }),
    ).toBe('16:00');
  });

  it('uses the same numeric rendering on chart UI runtimes', () => {
    expect(
      formatDateTimeParts(getDateTimeParts(DATE), 'dd/MM/yyyy HH:mm'),
    ).toBe('14/10/2026 19:26');
  });

  it('honors the requested time zone with explicit date and time templates', () => {
    const date = '2026-10-14T16:26:32.007Z';
    expect(
      formatDate(date, {
        formatTemplate: "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        timeZone: 'America/New_York',
        locale: 'en',
      }),
    ).toBe('2026-10-14T12:26:32.007-04:00');
    expect(
      formatTime(date, {
        formatTemplate: 'yyyyLLdd-HHmmss.SSS',
        timeZone: 'Asia/Shanghai',
      }),
    ).toBe('20261015-002632.007');
    expect(
      formatDate(date, {
        formatTemplate: 'yyyy/LL/dd, HH:mm:ss',
        timeZone: 'Asia/Shanghai',
        hideYear: true,
        hideSeconds: true,
      }),
    ).toBe('10/15, 00:26');
    expect(
      formatTime(date, {
        formatTemplate: 'HH:mm:ss.SSS',
        timeZone: 'UTC',
        hideSeconds: true,
      }),
    ).toBe('16:26');
  });

  it('preserves distinct DST offsets for repeated hours in explicit templates', () => {
    const options = {
      formatTemplate: 'yyyy-MM-dd HH:mm XXX',
      timeZone: 'America/New_York',
    };
    expect(formatDate('2026-11-01T05:30:00Z', options)).toBe(
      '2026-11-01 01:30 -04:00',
    );
    expect(formatDate('2026-11-01T06:30:00Z', options)).toBe(
      '2026-11-01 01:30 -05:00',
    );
  });

  it.each([new Date(Number.NaN), 'invalid'])(
    'renders invalid dates as a placeholder',
    (date) => {
      expect(formatDate(date)).toBe('-');
      expect(formatTime(date)).toBe('-');
    },
  );
});

test('formatRelativeTimeAbbr', () => {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  expect(formatRelativeTimeAbbr(oneMinuteAgo)).toBe('1m');
});

test('formatRelativeTimeAbbr auto-detects timestamp format', () => {
  const now = Math.floor(Date.now() / 1000);
  const oneMinuteAgo = now - 60;

  expect(formatRelativeTimeAbbr(oneMinuteAgo)).toBe('1m');
});
