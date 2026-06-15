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

describe('getLightweightChartsRuntimeScriptTag', () => {
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
        textColor: '#ffffff',
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
