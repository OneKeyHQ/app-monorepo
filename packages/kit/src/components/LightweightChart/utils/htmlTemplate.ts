import { LIGHTWEIGHT_CHARTS_CDN } from './constants';

import type { ILightweightChartConfig } from '../types';

function getStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #chart { width: 100%; height: 100%; }
    .tv-lightweight-charts table tr:last-child { pointer-events: none !important; }
  `.trim();
}

function getChartInitScript(): string {
  return `
      const chart = LightweightCharts.createChart(container, {
        layout: {
          background: { color: config.theme.bgColor },
          textColor: config.theme.textSubduedColor,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
          vertLine: {
            color: config.theme.lineColor,
            width: 1,
            style: 3,
            labelVisible: false,
          },
          horzLine: { visible: false },
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
          lockVisibleTimeRangeOnResize: true,
          tickMarkFormatter: (time) => {
            const date = new Date(time * 1000);
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            const day = date.getDate().toString().padStart(2, '0');
            return month + ' ' + day;
          },
        },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: false,
          horzTouchDrag: false,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: false,
          mouseWheel: false,
          pinch: false,
          axisDoubleClickReset: false,
        },
        kineticScroll: {
          touch: false,
          mouse: false,
        },
      });

      const series = chart.addAreaSeries({
        topColor: config.theme.topColor,
        bottomColor: config.theme.bottomColor,
        lineColor: config.theme.lineColor,
        lineWidth: 2.5,
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (price) => price.toFixed(2) + '%',
        },
      });

      series.setData(config.data);
      chart.timeScale().fitContent();
  `.trim();
}

function getEventHandlers(): string {
  return `
      chart.subscribeCrosshairMove((param) => {
        const message = param.time && param.seriesPrices?.size > 0 && param.point
          ? {
              type: 'hover',
              time: String(param.time),
              price: String(param.seriesPrices.get(series)),
              x: param.point.x,
              y: param.point.y,
            }
          : { type: 'hover', time: undefined, price: undefined, x: undefined, y: undefined };

        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      });

      new ResizeObserver(entries => {
        if (entries.length) {
          const { width, height } = entries[0].contentRect;
          chart.applyOptions({ width, height });
        }
      }).observe(container);

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  `.trim();
}

function getChartScript(config: ILightweightChartConfig): string {
  const configJSON = JSON.stringify(config);

  return `
    (function() {
      const config = ${configJSON};
      const container = document.getElementById('chart');

      ${getChartInitScript()}
      ${getEventHandlers()}
    })();
  `.trim();
}

/**
 * Generates HTML template for LightweightChart WebView
 * This is a self-contained HTML page that renders a chart using lightweight-charts library
 */
export function generateChartHTML(config: ILightweightChartConfig): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="${LIGHTWEIGHT_CHARTS_CDN}"></script>
  <style>${getStyles()}</style>
</head>
<body>
  <div id="chart"></div>
  <script>${getChartScript(config)}</script>
</body>
</html>`;
}
