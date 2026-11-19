import {
  createChartOptions,
  formatChartTickMarkInTimeZone,
  formatChartTickMarkWithoutUnit,
} from './chartOptions';

import type { TickMarkFormatter, UTCTimestamp } from 'lightweight-charts';

const theme = {
  bgColor: 'transparent',
  textSubduedColor: '#666666',
  lineColor: '#008000',
  topColor: 'transparent',
  bottomColor: 'transparent',
};

describe('createChartOptions', () => {
  it('reads unit-less tick marks as UTC, since web feeds local wall-clock times', () => {
    const options = createChartOptions(
      theme,
      true,
      11,
      undefined,
      true,
      true,
      true,
    );
    const formatter = options.timeScale?.tickMarkFormatter as
      | TickMarkFormatter
      | undefined;
    // 2026-11-19 00:00 local wall-clock time, as the shifted chart time.
    const localMidnight = (Date.UTC(2026, 10, 19) / 1000) as UTCTimestamp;

    expect(formatter?.(localMidnight, 2, 'en')).toBe('19');
    expect(formatter?.(localMidnight, 3, 'en')).toBe('00:00');
  });

  it('keeps the native unit-less formatter on device local time', () => {
    const time = (Date.UTC(2026, 10, 19, 13, 5) / 1000) as UTCTimestamp;
    const date = new Date(time * 1000);
    const pad = (value: number) => value.toString().padStart(2, '0');

    expect(formatChartTickMarkWithoutUnit(time, 3, 'en')).toBe(
      `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    );
  });

  it('locks the right edge with no gap by default', () => {
    const options = createChartOptions(theme);

    expect(options.timeScale).toMatchObject({ fixRightEdge: true });
    expect(options.timeScale).not.toHaveProperty('rightOffsetPixels');
  });

  it('opens a pixel gap after the last point when asked', () => {
    const options = createChartOptions(
      theme,
      true,
      11,
      undefined,
      true,
      false,
      false,
      undefined,
      'right',
      undefined,
      undefined,
      undefined,
      16,
    );

    expect(options.timeScale).toMatchObject({
      fixRightEdge: false,
      rightOffsetPixels: 16,
    });
  });

  it('reserves the requested price scale width on the first layout', () => {
    const options = createChartOptions(
      theme,
      true,
      11,
      { top: 0.12, bottom: 0.1 },
      true,
      true,
      true,
      64,
    );

    expect(options.rightPriceScale).toMatchObject({
      visible: true,
      minimumWidth: 64,
    });
  });

  it('keeps the library default width when no minimum is requested', () => {
    const options = createChartOptions(theme);

    expect(options.rightPriceScale).not.toHaveProperty('minimumWidth');
  });

  it('keeps the shared faint crosshair when no override is passed', () => {
    const options = createChartOptions(theme);

    expect(options.crosshair?.vertLine).toMatchObject({
      color: 'rgba(150, 150, 150, 0.4)',
      style: 3,
    });
  });

  it('applies the caller crosshair overrides', () => {
    const options = createChartOptions(
      theme,
      true,
      11,
      undefined,
      true,
      false,
      false,
      undefined,
      'right',
      undefined,
      undefined,
      { color: '#0000009b', style: 2 },
    );

    expect(options.crosshair?.vertLine).toMatchObject({
      color: '#0000009b',
      style: 2,
    });
  });

  it('places the visible price scale and reserved width on the left', () => {
    const options = createChartOptions(
      theme,
      true,
      11,
      { top: 0.12, bottom: 0.1 },
      true,
      false,
      false,
      64,
      'left',
    );

    expect(options.leftPriceScale).toMatchObject({
      visible: true,
      minimumWidth: 64,
    });
    expect(options.rightPriceScale).toEqual({ visible: false });
  });

  it.each([
    ['UTC', '03:12'],
    ['Asia/Shanghai', '11:12'],
    ['America/New_York', '22:12'],
  ])('formats time ticks in %s', (timeZone, expected) => {
    expect(
      formatChartTickMarkInTimeZone({
        time: (Date.UTC(2026, 0, 2, 3, 12) / 1000) as UTCTimestamp,
        tickMarkType: 3,
        timeZone,
        locale: 'en-US',
      }),
    ).toBe(expected);
  });

  it.each(['en', 'zh-CN', 'bn', 'id', 'th-TH', 'ko-KR'])(
    'uses Latin digits and colon-separated midnight for %s',
    (locale) => {
      expect(
        formatChartTickMarkInTimeZone({
          time: (Date.UTC(2026, 9, 14, 0, 5) / 1000) as UTCTimestamp,
          tickMarkType: 3,
          timeZone: 'UTC',
          locale,
        }),
      ).toBe('00:05');
      expect(
        formatChartTickMarkInTimeZone({
          time: (Date.UTC(2026, 9, 14) / 1000) as UTCTimestamp,
          tickMarkType: 0,
          timeZone: 'UTC',
          locale,
        }),
      ).toBe('2026');
    },
  );

  it.each([
    ['en', 'Nov'],
    ['zh-CN', '11月'],
    ['fr-FR', 'nov.'],
    ['de', 'Nov'],
    ['ko-KR', '11월'],
  ])('distinguishes month boundaries from day ticks in %s', (locale, month) => {
    const options = {
      time: (Date.UTC(2026, 10, 1) / 1000) as UTCTimestamp,
      timeZone: 'UTC',
      locale,
    };
    expect(formatChartTickMarkInTimeZone({ ...options, tickMarkType: 1 })).toBe(
      month,
    );
    expect(formatChartTickMarkInTimeZone({ ...options, tickMarkType: 2 })).toBe(
      '01',
    );
  });

  it('uses the month in the chart timezone and preserves business-day values', () => {
    expect(
      formatChartTickMarkInTimeZone({
        time: (Date.UTC(2026, 9, 31, 16) / 1000) as UTCTimestamp,
        tickMarkType: 1,
        timeZone: 'Asia/Shanghai',
        locale: 'en',
      }),
    ).toBe('Nov');
    expect(
      formatChartTickMarkInTimeZone({
        time: '2026-11-01',
        tickMarkType: 1,
        timeZone: 'America/New_York',
        locale: 'en',
      }),
    ).toBe('Nov');
  });
});
