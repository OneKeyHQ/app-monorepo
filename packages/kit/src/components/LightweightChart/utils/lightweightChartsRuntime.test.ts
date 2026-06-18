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
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('unpkg.com');
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
