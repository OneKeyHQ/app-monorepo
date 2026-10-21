import { runInNewContext } from 'vm';

import type { ILightweightChartConfig } from '../types';
import type { UTCTimestamp } from 'lightweight-charts';

jest.mock('./lightweightChartsStandalone.text-js', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  return fs.readFileSync(
    'packages/kit/src/components/LightweightChart/utils/lightweightChartsStandalone.text-js',
    'utf8',
  );
});

jest.mock('./formatChartPrice.text-js', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  return fs.readFileSync(
    'packages/kit/src/components/LightweightChart/utils/formatChartPrice.text-js',
    'utf8',
  );
});

const { generateChartHTML } =
  jest.requireActual<typeof import('./htmlTemplate')>('./htmlTemplate');
const { getLightweightChartsRuntimeScriptTag } = jest.requireActual<
  typeof import('./lightweightChartsRuntime')
>('./lightweightChartsRuntime');
const { resolveSerializablePriceFormatterType } = jest.requireActual<
  typeof import('./priceFormatterType')
>('./priceFormatterType');
const { resolveSerializablePriceFormatterTickStep } = jest.requireActual<
  typeof import('./priceFormatterType')
>('./priceFormatterType');

it('updates the native scrub overlay without rebuilding the primary series or refitting', () => {
  const config: ILightweightChartConfig = {
    data: [1, 2, 3].map((time) => ({
      time: time as UTCTimestamp,
      value: time,
    })),
    secondaryLineData: [{ time: 1 as UTCTimestamp, value: 1 }],
    lineWidth: 2,
    theme: {
      bgColor: 'transparent',
      textSubduedColor: '#999999',
      lineColor: '#00aa00',
      topColor: 'transparent',
      bottomColor: 'transparent',
    },
  };
  const html = generateChartHTML(config);
  const primary = { setData: jest.fn(), applyOptions: jest.fn() };
  const overlay = { setData: jest.fn() };
  const createPrimarySeries = jest.fn(() => primary);
  const fitContent = jest.fn();
  const chart = {
    addSeries: jest.fn(() => overlay),
    removeSeries: jest.fn(),
    applyOptions: jest.fn(),
    timeScale: () => ({ fitContent }),
  };
  const page = {
    chart,
    series: null,
    secondarySeries: null,
    secondaryPointSeries: null,
    latestChartConfig: config,
    applyChartConfig: (_config: ILightweightChartConfig) => {},
    applyChartSecondaryData: (_data: Partial<ILightweightChartConfig>) => {},
    updatePulseDot: jest.fn(),
  };
  const seriesSource = html.slice(
    html.indexOf('function getSecondarySeriesOptions'),
    html.indexOf('// Price formatter: use a serializable'),
  );
  const applyStart = html.indexOf('window.applyChartConfig = function');
  const applyEnd = html.indexOf('window.applyChartConfig(config);', applyStart);
  runInNewContext(
    `${seriesSource}\n${html.slice(applyStart, applyEnd)}\nwindow.applyChartConfig(config);`,
    {
      window: page,
      document: { getElementById: () => null },
      config,
      LightweightCharts: { LineSeries: {} },
      createPrimarySeries,
      getPrimarySeriesType: () => 'area',
      getPriceScalePosition: () => 'right',
      getNormalizedLineWidth: (value: number | undefined, fallback: number) =>
        value ?? fallback,
      getLastValueSeriesOptions: () => ({}),
      getChartOptions: () => ({}),
      syncReferenceLine: jest.fn(),
    },
  );
  for (let index = 0; index < 20; index += 1) {
    page.applyChartSecondaryData({
      secondaryLineData: config.data.slice(0, (index % 3) + 1),
      secondaryPointData: [],
    });
  }
  expect(createPrimarySeries).toHaveBeenCalledTimes(1);
  expect(primary.setData).toHaveBeenCalledTimes(1);
  expect(chart.removeSeries).not.toHaveBeenCalled();
  expect(fitContent).toHaveBeenCalledTimes(1);
  expect(overlay.setData).toHaveBeenCalledTimes(21);

  page.applyChartSecondaryData({
    secondaryLineData: [],
    secondaryPointData: [],
  });
  expect(chart.removeSeries).toHaveBeenCalledWith(overlay);
  expect(primary.setData).toHaveBeenCalledTimes(1);
  page.applyChartConfig({ ...config, data: config.data.slice(0, 2) });
  expect(createPrimarySeries).toHaveBeenCalledTimes(2);
  expect(fitContent).toHaveBeenCalledTimes(2);
});

it('updates Android scrub visuals without bridge messages or series data updates', () => {
  const config: ILightweightChartConfig = {
    data: [1, 2, 3].map((time) => ({
      time: time as UTCTimestamp,
      value: time,
    })),
    secondaryLineData: [1, 2, 3].map((time) => ({
      time: time as UTCTimestamp,
      value: time,
    })),
    lineWidth: 1,
    theme: {
      bgColor: 'transparent',
      textSubduedColor: '#999',
      lineColor: '#080',
      topColor: 'transparent',
      bottomColor: 'transparent',
    },
    notifyOnHover: false,
    nativeScrubOptions: {
      labels: { '2': { time: '2026/10/21, 09:30', price: '$0.0₆12' } },
      backgroundColor: '#fff',
      borderColor: '#ddd',
      textColor: '#111',
      timeColor: '#999',
      largePrice: true,
    },
  };
  type IHoverEvent = {
    time?: number;
    point?: { x: number; y: number };
    sourceEvent?: object;
    seriesData?: Map<object, { value: number }>;
  };
  let handleCrosshair: (event: IHoverEvent) => void = () => {};
  const primary = { priceToCoordinate: (price: number) => price * 10 };
  const postMessage = jest.fn();
  const overlay = {
    setData: jest.fn(() => handleCrosshair({ time: 2 })),
  };
  const page = {
    latestChartConfig: config,
    series: primary,
    secondarySeries: overlay,
    nativeScrubTime: undefined as string | undefined,
    chart: {
      timeScale: () => ({ timeToCoordinate: (time: number) => time * 20 }),
    },
    ReactNativeWebView: { postMessage },
  };
  const elements: Record<
    string,
    { style: Record<string, string>; textContent: string }
  > = Object.fromEntries(
    ['scrub-tooltip', 'scrub-time', 'scrub-price'].map((id) => [
      id,
      { style: {}, textContent: '' },
    ]),
  );
  const html = generateChartHTML(config);
  const start = html.indexOf("var _isTouch = 'ontouchstart' in window;");
  const end = html.indexOf('window.repaintChart = function', start);
  let now = 1000;
  runInNewContext(html.slice(start, end), {
    window: page,
    container: { clientWidth: 400 },
    document: { getElementById: (id: string) => elements[id] },
    chart: {
      subscribeCrosshairMove: (callback: typeof handleCrosshair) => {
        handleCrosshair = callback;
      },
    },
    Date: { now: () => now },
  });

  for (let index = 0; index < 60; index += 1) {
    handleCrosshair({
      time: 2,
      point: { x: 250 + index, y: 100 },
      sourceEvent: {},
      seriesData: new Map([[primary, { value: 2 }]]),
    });
  }
  expect(postMessage).not.toHaveBeenCalled();
  expect(overlay.setData).not.toHaveBeenCalled();
  expect(page.nativeScrubTime).toBe('2');
  expect(elements['scrub-time'].textContent).toBe('2026/10/21, 09:30');
  expect(elements['scrub-price'].textContent).toBe('$0.0₆12');
  expect(elements['scrub-tooltip'].style).toMatchObject({
    display: 'block',
    left: '179px',
    top: '44px',
    backgroundColor: '#fff',
  });
  const context = {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
  };
  const primitiveSource = html.slice(
    html.indexOf('function createNativeScrubLine'),
    html.indexOf('// Rebuild both series'),
  );
  const draw = runInNewContext(
    `${primitiveSource}\ncreateNativeScrubLine(config).paneViews()[0].renderer().draw`,
    {
      config,
      window: page,
      getNormalizedLineWidth: () => 2,
    },
  ) as (target: {
    useMediaCoordinateSpace: (
      callback: (scope: { context: typeof context }) => void,
    ) => void;
  }) => void;
  const target = {
    useMediaCoordinateSpace: (
      callback: (scope: { context: typeof context }) => void,
    ) => callback({ context }),
  };
  draw(target);
  expect(context.moveTo).toHaveBeenLastCalledWith(20, 10);
  expect(context.lineTo).toHaveBeenCalledTimes(1);
  expect(context.lineTo).toHaveBeenLastCalledWith(40, 20);
  context.lineTo.mockClear();
  now += 500;
  handleCrosshair({});
  expect(elements['scrub-tooltip'].style.display).toBe('none');
  expect(page.nativeScrubTime).toBeUndefined();
  draw(target);
  expect(context.lineTo).toHaveBeenCalledTimes(2);
  expect(context.lineTo).toHaveBeenLastCalledWith(60, 30);
  expect(overlay.setData).not.toHaveBeenCalled();
  expect(postMessage).not.toHaveBeenCalled();
});

describe('getLightweightChartsRuntimeScriptTag', () => {
  it('loads the standalone runtime only when building the script tag', () => {
    jest.isolateModules(() => {
      const getLightweightChartsStandaloneScript = jest.fn(
        () => 'window.LightweightCharts = {}; </script>',
      );
      jest.doMock('./lightweightChartsRuntimeSource', () => ({
        getLightweightChartsStandaloneScript,
      }));

      const runtime = jest.requireActual<
        typeof import('./lightweightChartsRuntime')
      >('./lightweightChartsRuntime');

      expect(getLightweightChartsStandaloneScript).not.toHaveBeenCalled();

      const scriptTag = runtime.getLightweightChartsRuntimeScriptTag();

      expect(getLightweightChartsStandaloneScript).toHaveBeenCalledTimes(1);
      expect(scriptTag).toContain('window.LightweightCharts');
      expect(scriptTag).toContain('<\\/script>');
      jest.dontMock('./lightweightChartsRuntimeSource');
    });
  });

  it('inlines the lightweight-charts runtime without remote script loading', () => {
    const scriptTag = getLightweightChartsRuntimeScriptTag();

    expect(scriptTag).toContain('<script>');
    expect(scriptTag).toContain('</script>');
    expect(scriptTag).toContain('LightweightCharts');
    expect(scriptTag).not.toContain(' src=');
    expect(scriptTag).not.toContain('unpkg.com');
  });

  it('uses the inline runtime in the LightweightChart native HTML template', () => {
    const html = generateChartHTML({
      data: [{ time: 1 as UTCTimestamp, value: 1 }],
      lineWidth: 2,
      theme: {
        bgColor: '#000000',
        textSubduedColor: '#999999',
        lineColor: '#8D8FE8',
        topColor: 'transparent',
        bottomColor: 'transparent',
      },
    });

    expect(html).toContain('LightweightCharts');
    expect(html).toContain('LightweightCharts.LineType.WithSteps');
    expect(html).toContain("getPriceScaleOptions(nextConfig, 'left')");
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('unpkg.com');
  });

  it('serializes the configured time zone into the native chart template', () => {
    const html = generateChartHTML({
      data: [{ time: 1 as UTCTimestamp, value: 1 }],
      lineWidth: 2,
      locale: 'zh-CN',
      timeZone: 'Asia/Shanghai',
      theme: {
        bgColor: '#000000',
        textSubduedColor: '#999999',
        lineColor: '#8D8FE8',
        topColor: 'transparent',
        bottomColor: 'transparent',
      },
    });

    expect(html).toContain('"locale":"zh-CN"');
    expect(html).toContain('"timeZone":"Asia/Shanghai"');
    expect(html).toContain('getTimeScaleOptions(nextConfig)');
  });

  it('creates a dashed reference line in the native chart template', () => {
    const html = generateChartHTML({
      data: [{ time: 1 as UTCTimestamp, value: 1 }],
      lineWidth: 2,
      referenceLine: {
        price: 0,
        color: '#555555',
        lineWidth: 1,
        lineStyle: 'dashed',
        axisLabelVisible: false,
      },
      theme: {
        bgColor: '#000000',
        textSubduedColor: '#999999',
        lineColor: '#8D8FE8',
        topColor: 'transparent',
        bottomColor: 'transparent',
      },
    });

    expect(html).toContain('"referenceLine":{"price":0');
    expect(html).toContain("lineStyle === 'dashed'");
    expect(html).toContain('window.series.createPriceLine');
  });

  it('creates a signed histogram series in the native chart template', () => {
    const html = generateChartHTML({
      data: [
        { time: 1 as UTCTimestamp, value: 2, color: '#00aa00' },
        { time: 2 as UTCTimestamp, value: -3, color: '#ee0000' },
      ],
      lineWidth: 2,
      seriesType: 'histogram',
      histogramOptions: {
        positiveColor: '#00aa00',
        negativeColor: '#ee0000',
        base: 0,
        barWidthRatio: 0.5,
        maxBarWidth: 24,
      },
      theme: {
        bgColor: '#000000',
        textSubduedColor: '#999999',
        lineColor: '#00aa00',
        topColor: 'transparent',
        bottomColor: 'transparent',
      },
    });

    expect(html).toContain('"seriesType":"histogram"');
    expect(html).toContain('"color":"#00aa00"');
    expect(html).toContain('"color":"#ee0000"');
    expect(html).toContain('createHistogramSeriesPaneView()');
    expect(html).toContain('barWidthRatio: 0.5');
    expect(html).toContain('maxBarWidth: 24');
    expect(html).toContain('value === options.base) return');
    expect(html).toContain('getHistogramSeriesOptions(nextConfig)');
  });

  it('passes the tail gap to the native time scale', () => {
    const html = generateChartHTML({
      data: [{ time: 1 as UTCTimestamp, value: 1 }],
      lineWidth: 2,
      timeScaleRightOffsetPixels: 16,
      theme: {
        bgColor: '#000000',
        textSubduedColor: '#999999',
        lineColor: '#00aa00',
        topColor: 'transparent',
        bottomColor: 'transparent',
      },
    });

    expect(html).toContain('"timeScaleRightOffsetPixels":16');
    expect(html).toContain('fixRightEdge: rightGap <= 0');
    expect(html).toContain('options.rightOffsetPixels = rightGap');
  });

  it('preserves native adaptive tick labels when no time zone is provided', () => {
    const html = generateChartHTML({
      data: [{ time: 1 as UTCTimestamp, value: 1 }],
      lineWidth: 2,
      theme: {
        bgColor: '#000000',
        textSubduedColor: '#999999',
        lineColor: '#8D8FE8',
        topColor: 'transparent',
        bottomColor: 'transparent',
      },
    });

    expect(html).toContain('if (nextConfig.timeZone)');
    expect(html).toContain('options.tickMarkFormatter =');
    expect(html).not.toContain('date.toLocaleDateString');
  });

  it('hides the native crosshair price label only when requested', () => {
    const config = {
      data: [{ time: 1 as UTCTimestamp, value: 1 }],
      lineWidth: 2,
      theme: {
        bgColor: '#000000',
        textSubduedColor: '#999999',
        lineColor: '#8D8FE8',
        topColor: 'transparent',
        bottomColor: 'transparent',
      },
    };
    const defaultHtml = generateChartHTML(config);
    const requestedHtml = generateChartHTML({
      ...config,
      hideCrosshairPriceLabel: true,
    });

    expect(defaultHtml).not.toContain('"hideCrosshairPriceLabel":true');
    expect(requestedHtml).toContain('"hideCrosshairPriceLabel":true');
    expect(requestedHtml).toContain(
      'labelVisible: !config.hideCrosshairPriceLabel',
    );
  });

  it('serializes caller-provided percent precision for native charts', () => {
    const html = generateChartHTML({
      data: [{ time: 1 as UTCTimestamp, value: 0.001 }],
      lineWidth: 2,
      priceFormatterType: 'percent',
      priceFormatterPrecision: 4,
      theme: {
        bgColor: '#000000',
        textSubduedColor: '#999999',
        lineColor: '#8D8FE8',
        topColor: 'transparent',
        bottomColor: 'transparent',
      },
    });

    expect(html).toContain('"priceFormatterPrecision":4');
    expect(html).toContain('price.toFixed(precision)');
  });
});

describe('resolveSerializablePriceFormatterType', () => {
  it('keeps dotted area charts on numeric axis labels', () => {
    expect(
      resolveSerializablePriceFormatterType({
        seriesType: 'dotted-area',
        priceFormatter: (value) => `${value}%`,
      }),
    ).toBe('number');
  });

  it('infers percent and usd formatter output for native WebView', () => {
    expect(
      resolveSerializablePriceFormatterType({
        seriesType: 'baseline',
        priceFormatter: (value) => `${value.toFixed(2)}%`,
      }),
    ).toBe('percent');
    expect(
      resolveSerializablePriceFormatterType({
        seriesType: 'area',
        priceFormatter: (value) => `$${value.toFixed(2)}`,
      }),
    ).toBe('usd');
    expect(
      resolveSerializablePriceFormatterType({
        seriesType: 'histogram',
        priceFormatter: (value) => `$${value.toFixed(2)}`,
      }),
    ).toBe('usd');
  });
});

describe('resolveSerializablePriceFormatterTickStep', () => {
  it('does not force dotted area axis tick filtering by default', () => {
    expect(
      resolveSerializablePriceFormatterTickStep({
        seriesType: 'dotted-area',
      }),
    ).toBeUndefined();
  });

  it('uses only caller-provided tick steps for dotted area charts', () => {
    expect(
      resolveSerializablePriceFormatterTickStep({
        seriesType: 'dotted-area',
        priceFormatterTickStep: 2,
      }),
    ).toBe(2);
    expect(
      resolveSerializablePriceFormatterTickStep({
        seriesType: 'area',
        priceFormatterTickStep: 2,
      }),
    ).toBeUndefined();
  });
});

it('embeds and selects compact prices in the native chart', () => {
  const html = generateChartHTML({
    data: [],
    lineWidth: 2,
    compactPriceMaxCharacters: 7,
    priceScaleMinimumWidth: 88,
    theme: {
      bgColor: '#000000',
      textSubduedColor: '#999999',
      lineColor: '#8D8FE8',
      topColor: 'transparent',
      bottomColor: 'transparent',
    },
  });
  expect(html).toContain('"compactPriceMaxCharacters":7');
  expect(html).not.toContain('[bytecode]');
  expect(html).toContain('"priceScaleMinimumWidth":88');
  const start = html.indexOf('window.__onekeyFormatChartPrice =');
  const end = html.indexOf('function getNormalizedLineWidth', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const formatterSource = `var window = {};\n${html.slice(start, end)}`;
  expect(
    runInNewContext(`${formatterSource};
    getPriceFormatter({compactPriceMaxCharacters: 7})(-1e-30)`),
  ).toBe('-$0.0₂₉1');
  expect(
    runInNewContext(`${formatterSource};
    getPriceFormatter({compactPriceMaxCharacters: 7})(-1.23456789e-30)`),
  ).toBe('-$0.0₂₉12');
  expect(
    runInNewContext(`${formatterSource};
    getPriceFormatter({compactPriceMaxCharacters: 10})(0.184056)`),
  ).toBe('$0.1841');
  expect(
    runInNewContext(`${formatterSource};
    getPriceFormatter({compactPriceMaxCharacters: 10})(0.142991)`),
  ).toBe('$0.143');
  expect(
    runInNewContext(`${formatterSource};
    getPriceFormatter({priceScaleFormat: 'stock', compactPriceMaxCharacters: 10})(341.7)`),
  ).toBe('$341.70');
  for (const [price, expected] of [
    [1.005, '$1.01'],
    [-1.005, '-$1.01'],
    [9.995, '$10.00'],
  ]) {
    expect(
      runInNewContext(
        `${formatterSource}; getPriceFormatter({priceScaleFormat: 'stock'})(${price})`,
      ),
    ).toBe(expected);
  }
  expect(
    runInNewContext(`${formatterSource};
    getPriceFormatter({priceScaleFormat: 'full', compactPriceMaxCharacters: 10})(2377.04)`),
  ).toBe('$2,377.04');
  expect(
    runInNewContext(`${formatterSource};
    getTickPriceFormatter({priceScaleFormat: 'full'})([2535, 2540, 2545])`),
  ).toEqual(['$2,535', '$2,540', '$2,545']);
  expect(
    runInNewContext(`${formatterSource};
    getTickPriceFormatter({priceScaleFormat: 'full'})([2540, 2540.5])`),
  ).toEqual(['$2,540.00', '$2,540.50']);
  expect(
    runInNewContext(`${formatterSource};
    getTickPriceFormatter({compactPriceMaxCharacters: 10})`),
  ).toBeUndefined();
  expect(html).toContain('options.localization');
});

it('repaints a returning native canvas without accepting zero-size layouts', () => {
  const html = generateChartHTML({
    data: [{ time: 1 as UTCTimestamp, value: 1 }],
    lineWidth: 2,
    theme: {
      bgColor: 'transparent',
      textSubduedColor: '#999999',
      lineColor: '#00aa00',
      topColor: 'transparent',
      bottomColor: 'transparent',
    },
  });
  const start = html.indexOf('var _isTouch =');
  const end = html.indexOf(
    "window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));",
    start,
  );
  const resize = jest.fn();
  const container = { clientWidth: 390, clientHeight: 280 };
  const listeners: Record<string, () => void> = {};
  const page = {
    ReactNativeWebView: { postMessage: jest.fn() },
    addEventListener: (name: string, handler: () => void) => {
      listeners[name] = handler;
    },
    repaintChart: () => {},
  };
  const document = {
    hidden: false,
    addEventListener: (name: string, handler: () => void) => {
      listeners[name] = handler;
    },
  };
  runInNewContext(html.slice(start, end), {
    window: page,
    document,
    container,
    chart: { resize, subscribeCrosshairMove: jest.fn() },
    ResizeObserver: class {
      observe() {}
    },
  });
  page.repaintChart();
  expect(resize).toHaveBeenLastCalledWith(390, 280, true);
  resize.mockClear();
  container.clientWidth = 0;
  listeners.pageshow();
  expect(resize).not.toHaveBeenCalled();
  container.clientWidth = 390;
  listeners.visibilitychange();
  expect(resize).toHaveBeenLastCalledWith(390, 280, true);
});
