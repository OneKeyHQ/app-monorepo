import {
  createChartOptions,
  formatChartTickMarkInTimeZone,
} from './chartOptions';

import type { UTCTimestamp } from 'lightweight-charts';

const theme = {
  bgColor: 'transparent',
  textSubduedColor: '#666666',
  lineColor: '#008000',
  topColor: 'transparent',
  bottomColor: 'transparent',
};

describe('createChartOptions', () => {
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
});
