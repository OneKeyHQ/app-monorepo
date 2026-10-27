import {
  buildNativeChartCrosshair,
  buildNativeChartScene,
  formatNativeChartPrice,
  getNativeChartHover,
} from './chartScene';

import type { ILightweightChartConfig, ILightweightChartTime } from '../types';

const series = (values: number[]) =>
  values.map((value, index) => ({
    time: ((index + 1) * 100) as ILightweightChartTime,
    value,
  }));
const config: ILightweightChartConfig = {
  theme: {
    bgColor: 'transparent',
    textSubduedColor: '#666',
    lineColor: '#008347',
    topColor: '#00834726',
    bottomColor: '#00834700',
  },
  lineWidth: 2,
  showPriceScale: true,
  showTimeScale: true,
  priceScaleFormat: 'stock',
  data: series([100, 110, 105]),
};
const scene = (
  overrides: Partial<ILightweightChartConfig> = {},
  width = 402,
  height = 280,
) =>
  buildNativeChartScene({
    config: { ...config, ...overrides },
    width,
    height,
    measureText: (text) => text.length * 6,
  });

it('reserves the measured axis and keeps the last point away from its labels', () => {
  const chart = scene({ timeScaleRightOffsetPixels: 16 });
  expect(chart.lastPoint?.x).toBe(chart.plot.width - 18);
  expect(chart.plot.height).toBe(252);
  expect(
    chart.commands.filter((c) => c.kind === 'text' && c.font === 'priceAxis')
      .length,
  ).toBeGreaterThan(1);
  const left = scene({ priceScalePosition: 'left' });
  expect(left.plot.x).toBe(left.axisWidth);
  expect(getNativeChartHover(left, 1, 30)).toEqual({});
});

it('keeps stock formatting, custom precision and full-price tick formatting', () => {
  expect(formatNativeChartPrice(341.7, config)).toBe('$341.70');
  expect(formatNativeChartPrice(0.000_000_123_45, config)).toContain('₆');
  expect(
    formatNativeChartPrice(-0.012_34, {
      ...config,
      priceScaleFormat: undefined,
      priceFormatter: (price) => `${price.toFixed(4)}%`,
    }),
  ).toBe('-0.0123%');
  const chart = scene({
    priceScaleFormat: 'full',
    data: series([2400, 2500]),
  });
  expect(chart.commands).toContainEqual(
    expect.objectContaining({
      kind: 'text',
      font: 'priceAxis',
      text: expect.stringMatching(/^\$2,\d{3}$/),
    }),
  );
});

it('clips the stock dot pattern under the curve and preserves the previous-close tag', () => {
  const chart = scene({
    seriesType: 'dotted-area',
    referenceLine: {
      price: 90,
      color: '#aaa',
      title: 'Previous close',
      axisLabelVisible: true,
      includeInAutoscale: true,
    },
    showLastValue: true,
    showLastValuePriceLine: false,
  });
  expect(chart.commands).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'clipPolygon' }),
      expect.objectContaining({ kind: 'circle', customPaintId: 'pattern' }),
      expect.objectContaining({ kind: 'line', customPaintId: 'referenceLine' }),
      expect.objectContaining({ kind: 'text', text: 'Previous close' }),
      expect.objectContaining({ kind: 'text', text: '$105.00' }),
    ]),
  );
  expect(chart.commands).not.toContainEqual(
    expect.objectContaining({
      kind: 'line',
      customPaintId: 'lastValueLine',
    }),
  );
});

it('preserves overlay-only timestamps, gaps, isolated points and hover values', () => {
  const chart = scene({
    secondaryLineData: [
      { time: 100 as ILightweightChartTime, value: 102 },
      { time: 150 as ILightweightChartTime, value: 104 },
      { time: 175 as ILightweightChartTime },
      { time: 250 as ILightweightChartTime, value: 107 },
    ],
  });
  expect(chart.secondarySegments.map((s) => s.length)).toEqual([2, 1]);
  const overlay = chart.hoverPoints.find((p) => p.time === 150);
  expect(overlay).toBeDefined();
  expect(getNativeChartHover(chart, overlay!.x, overlay!.y)).toEqual(
    expect.objectContaining({
      time: 150 as ILightweightChartTime,
      price: undefined,
      secondaryPrice: 104,
    }),
  );
  expect(chart.commands).toContainEqual(
    expect.objectContaining({
      kind: 'circle',
      customPaintId: 'secondaryPoint',
    }),
  );
});

it('fills baseline lobes toward zero and preserves both line colors', () => {
  const chart = scene({
    seriesType: 'baseline',
    priceScalePosition: 'left',
    data: series([-1, 2]),
    baselineOptions: {
      baseValue: { type: 'price', price: 0 },
      topLineColor: '#0f0',
      bottomLineColor: '#f00',
    },
  });
  const clip = chart.commands.find((c) => c.kind === 'clipPolygon');
  expect(clip?.points[0].y).toBeGreaterThan(chart.points[1].y);
  expect(clip?.points[0].y).toBeLessThan(chart.points[0].y);
  expect(chart.customPaintStyles.positive.color).toBe('#0f0');
  expect(chart.customPaintStyles.negative.color).toBe('#f00');
});

it('draws narrow signed histogram bars and leaves exact zero empty', () => {
  const chart = scene({
    seriesType: 'histogram',
    data: series([-1, 0, 2]),
    histogramOptions: {
      positiveColor: '#0f0',
      negativeColor: '#f00',
      maxBarWidth: 4,
    },
  });
  const bars = chart.commands.filter((c) => c.kind === 'rect');
  expect(bars).toHaveLength(2);
  expect(bars.every((c) => c.width <= 4 && c.height > 0)).toBe(true);
});

it('renders step segments and their area with matching geometry', () => {
  const chart = scene({ lineType: 'steps' });
  const stroke = chart.commands.find((c) => c.kind === 'polyline');
  expect(stroke?.points[1]).toEqual({
    x: chart.points[1].x,
    y: chart.points[0].y,
  });
  const clip = chart.commands.find((c) => c.kind === 'clipPolygon');
  expect(clip?.points.slice(1, -1)).toEqual(stroke?.points);
});

it('draws a native scrub card and cuts only the solid overlay at the cursor', () => {
  const chart = scene({
    secondaryLineData: config.data,
    secondaryLineColor: '#0f0',
    hideCrosshairPriceLabel: true,
  });
  const point = chart.points[1];
  const overlay = buildNativeChartCrosshair(chart, point.x, 100, {
    labels: { 200: { time: '2026/10/22 12:00', price: '$110.00' } },
    backgroundColor: '#fff',
    borderColor: '#ddd',
    textColor: '#000',
    timeColor: '#888',
    largePrice: false,
  });
  expect(overlay.customPaintStyles.hoverDot.color).toBe('#0f0');
  expect(overlay.commands.find((c) => c.kind === 'polyline')).toEqual(
    expect.objectContaining({ points: chart.secondarySegments[0].slice(0, 2) }),
  );
  expect(overlay.commands).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'text', text: '$110.00' }),
      expect.objectContaining({
        kind: 'roundRect',
        customPaintId: 'tooltip',
        radius: 8,
      }),
    ]),
  );
  expect(overlay.commands).not.toContainEqual(
    expect.objectContaining({
      kind: 'rect',
      customPaintId: 'hoverBackground',
    }),
  );
  expect(buildNativeChartCrosshair(chart, -1, 20).commands).toHaveLength(0);
});

it.each(['left', 'right'] as const)(
  'keeps the scrub guide under the finger on the %s price scale',
  (priceScalePosition) => {
    const chart = scene({ priceScalePosition, hideCrosshairPriceLabel: true });
    const point = chart.hoverPoints[1];
    const scrub = {
      labels: { 200: { time: 'selected point', price: '$110.00' } },
      backgroundColor: '#fff',
      borderColor: '#ddd',
      textColor: '#000',
      timeColor: '#888',
      largePrice: false,
    };
    for (const x of [point.x - 4, point.x + 4]) {
      const overlay = buildNativeChartCrosshair(chart, x, 100, scrub);
      expect(overlay.commands).toContainEqual(
        expect.objectContaining({ kind: 'line', x1: x, x2: x }),
      );
      expect(overlay.commands).toContainEqual(
        expect.objectContaining({ kind: 'circle', cx: point.x, cy: point.y }),
      );
      expect(overlay.commands).toContainEqual(
        expect.objectContaining({ kind: 'text', text: '$110.00' }),
      );
      expect(buildNativeChartCrosshair(chart, x, 100).commands).toContainEqual(
        expect.objectContaining({ kind: 'line', x1: point.x, x2: point.x }),
      );
    }
  },
);

it('localizes axis dates in the configured timezone including year boundaries', () => {
  const chart = scene({
    data: [
      {
        time: (Date.UTC(2025, 11, 31, 23) / 1000) as ILightweightChartTime,
        value: 1,
      },
      {
        time: (Date.UTC(2026, 0, 1, 2) / 1000) as ILightweightChartTime,
        value: 2,
      },
    ],
    locale: 'en-US',
    timeZone: 'UTC',
  });
  expect(chart.commands).toContainEqual(
    expect.objectContaining({
      kind: 'text',
      text: '2026',
    }),
  );
});

it('uses a distinct month label only at the month boundary', () => {
  const chart = scene({
    data: [
      Date.UTC(2026, 9, 31),
      Date.UTC(2026, 10, 1),
      Date.UTC(2026, 10, 2),
    ].map((time, index) => ({
      time: (time / 1000) as ILightweightChartTime,
      value: index + 1,
    })),
    locale: 'en',
    timeZone: 'UTC',
  });
  const labels = chart.commands.flatMap((command) =>
    command.kind === 'text' &&
    command.font === 'axis' &&
    command.y > chart.plot.y + chart.plot.height
      ? [{ text: command.text, x: command.x }]
      : [],
  );
  expect(
    labels.toSorted((a, b) => a.x - b.x).map((label) => label.text),
  ).toEqual(['31', 'Nov', '02']);
});

it('separates nearby last-price and previous-close badges and clamps time labels without overlap', () => {
  const chart = scene(
    {
      showLastValue: true,
      referenceLine: { price: 105.1, color: '#aaa', axisLabelVisible: true },
    },
    180,
  );
  const badges = chart.commands.filter((c) => c.kind === 'rect');
  const last = badges.find((c) => c.customPaintId === 'lastLabel')!;
  const reference = badges.find((c) => c.customPaintId === 'referenceLabel')!;
  expect(Math.abs(last.y - reference.y)).toBeGreaterThanOrEqual(last.height);
  const times = chart.commands
    .filter((c) => c.kind === 'text')
    .filter((c) => c.font === 'axis')
    .toSorted((a, b) => a.x - b.x);
  for (let i = 1; i < times.length; i += 1) {
    const previous = times[i - 1];
    expect(times[i].x).toBeGreaterThanOrEqual(
      previous.x + previous.text.length * 6 + 20,
    );
  }
});

it('keeps unitless time labels without creating unused timezone formatters', () => {
  const formatter = jest.spyOn(Intl, 'DateTimeFormat');
  try {
    const chart = scene({
      useTimeScaleTickMarkWithoutUnit: true,
      data: Array.from({ length: 288 }, (_, index) => ({
        time: (Date.UTC(2026, 9, 22) / 1000 +
          index * 300) as ILightweightChartTime,
        value: 100 + index / 10,
      })),
    });
    const labels = chart.commands.filter(
      (command) => command.kind === 'text' && command.font === 'axis',
    );
    expect(labels.length).toBeGreaterThan(1);
    expect(
      labels.every(
        (command) =>
          command.kind === 'text' && /^(\d{2}|\d{2}:\d{2})$/.test(command.text),
      ),
    ).toBe(true);
    expect(formatter).not.toHaveBeenCalled();
  } finally {
    formatter.mockRestore();
  }
});

it('resolves the default timezone once while preserving explicit-zone labels', () => {
  const data = Array.from({ length: 48 }, (_, index) => ({
    time: (Date.UTC(2026, 9, 22) / 1000 +
      index * 1800) as ILightweightChartTime,
    value: 100 + index,
  }));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const expected = scene({ data, timeZone: timezone, locale: 'en-US' });
  const formatter = jest.spyOn(Intl, 'DateTimeFormat');
  try {
    expect(scene({ data, locale: 'en-US' })).toEqual(expected);
    expect(formatter).toHaveBeenCalledTimes(1);
  } finally {
    formatter.mockRestore();
  }
});

it('preserves fixed precision for default percent readouts', () => {
  expect(
    formatNativeChartPrice(4, {
      ...config,
      priceScaleFormat: undefined,
      priceFormatterType: 'percent',
    }),
  ).toBe('4.00%');
  expect(
    formatNativeChartPrice(4.5, {
      ...config,
      priceScaleFormat: undefined,
      priceFormatterType: 'percent',
      priceFormatterPrecision: 4,
    }),
  ).toBe('4.5000%');
});

it.each(['baseline', 'histogram'] as const)(
  'uses signed %s colors for hover, the last value and its price line',
  (seriesType) => {
    const chart = scene({
      seriesType,
      showLastValue: true,
      data: series([1, -1]),
      baselineOptions: { topLineColor: '#0f0', bottomLineColor: '#f00' },
      histogramOptions: { positiveColor: '#0f0', negativeColor: '#f00' },
    });
    expect(chart.customPaintStyles.lastLabel.color).toBe('#f00');
    expect(chart.customPaintStyles.lastValueLine.color).toBe('#f00');
    for (const [index, color] of [
      [0, '#0f0'],
      [1, '#f00'],
    ] as const) {
      const point = chart.points[index];
      expect(
        buildNativeChartCrosshair(chart, point.x, point.y).customPaintStyles
          .hoverDot.color,
      ).toBe(color);
    }
    expect(
      scene({ seriesType, showLastValue: true, lastValueLabelColor: '#abc' })
        .customPaintStyles.lastLabel.color,
    ).toBe('#abc');
  },
);

it('uses the primary color at shared timestamps and the secondary color only for overlay-only points', () => {
  const chart = scene({
    secondaryLineColor: '#00f',
    secondaryLineData: [
      { time: 100 as ILightweightChartTime, value: 102 },
      { time: 150 as ILightweightChartTime, value: 104 },
    ],
  });
  for (const [time, color] of [
    [100, config.theme.lineColor],
    [150, '#00f'],
  ] as const) {
    const point = chart.hoverPoints.find((p) => p.time === time)!;
    expect(
      buildNativeChartCrosshair(chart, point.x, point.y).customPaintStyles
        .hoverDot.color,
    ).toBe(color);
  }
});

it.each([1, -1])(
  'autoscales narrow baseline data on the same side of zero (%s)',
  (sign) => {
    const chart = scene({
      seriesType: 'baseline',
      data: series([sign * 0.01, sign * 0.0101]),
    });
    expect(Math.abs(chart.points[0].y - chart.points[1].y)).toBeGreaterThan(
      chart.plot.height / 2,
    );
    const polygon = chart.commands.find((c) => c.kind === 'clipPolygon');
    expect(polygon?.points[0].y).toBe(sign > 0 ? chart.plot.height : 0);
  },
);

it.each([
  { priceScaleFormat: undefined, priceFormatterType: 'percent' as const },
  { priceFormatBase: 100 },
])('avoids duplicate tick labels on narrow ranges: %j', (overrides) => {
  const chart = scene({
    ...overrides,
    data: series([4.12, 4.121]),
  });
  const labels = chart.commands.flatMap((c) =>
    c.kind === 'text' && c.font === 'priceAxis' ? [c.text] : [],
  );
  expect(labels.length).toBeLessThanOrEqual(1);
});
