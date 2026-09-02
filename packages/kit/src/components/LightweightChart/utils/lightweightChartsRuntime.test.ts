import type { UTCTimestamp } from 'lightweight-charts';

jest.mock('./lightweightChartsStandalone.text-js', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  return fs.readFileSync(
    'packages/kit/src/components/LightweightChart/utils/lightweightChartsStandalone.text-js',
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
