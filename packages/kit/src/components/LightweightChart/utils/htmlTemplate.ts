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
      // Price formatter: use USD formatter when priceFormatterType is set, otherwise default %
      // NOTE: Keep in sync with formatChartUsdPrice in shared/src/utils/perpsUtils.ts
      function usdPriceFormatter(price) {
        var abs = Math.abs(price);
        var sign = price < 0 ? '-' : '';
        if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(1) + 'M';
        if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'K';
        if (Number.isInteger(abs)) return sign + '$' + abs.toFixed(0);
        return sign + '$' + abs.toFixed(2);
      }
      function pctPriceFormatter(price) {
        return price.toFixed(2) + '%';
      }
      var priceFormatter = config.priceFormatterType === 'usd' ? usdPriceFormatter : pctPriceFormatter;

      var normalizedLineWidth = Math.min(4, Math.max(1, Math.round(config.lineWidth ?? 3)));

      const chart = LightweightCharts.createChart(container, {
        layout: {
          background: { color: config.theme.bgColor },
          textColor: config.theme.textSubduedColor,
          fontSize: config.fontSize || 12,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: config.showHorzGridLines
            ? {
                visible: true,
                color: config.horzLineColor || '#E5E5EA',
                style: config.horzLineStyle ?? 2,
              }
            : { visible: false },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
          vertLine: {
            color: 'rgba(150, 150, 150, 0.4)',
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
        rightPriceScale: Object.assign(
          { visible: Boolean(config.showPriceScale), borderVisible: false },
          config.priceScaleMargins ? { scaleMargins: config.priceScaleMargins } : {}
        ),
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

      var isBaseline = config.seriesType === 'baseline';
      var showLast = Boolean(config.showLastValue);
      var series;

      if (isBaseline && config.baselineOptions) {
        series = chart.addBaselineSeries(Object.assign({}, config.baselineOptions, {
          lineWidth: normalizedLineWidth,
          lastValueVisible: showLast,
          priceLineVisible: showLast,
          crosshairMarkerRadius: 5,
          priceFormat: { type: 'custom', formatter: priceFormatter },
        }));
      } else {
        series = chart.addAreaSeries({
          topColor: config.theme.topColor,
          bottomColor: config.theme.bottomColor,
          lineColor: config.theme.lineColor,
          lineWidth: normalizedLineWidth,
          lastValueVisible: showLast,
          priceLineVisible: showLast,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: config.theme.lineColor,
          crosshairMarkerBackgroundColor: '#ffffff',
          priceFormat: { type: 'custom', formatter: priceFormatter },
        });
      }

      series.setData(config.data);

      let secondarySeries = null;
      if (
        Array.isArray(config.secondaryLineData) &&
        config.secondaryLineData.length > 0
      ) {
        secondarySeries = chart.addLineSeries({
          color: config.secondaryLineColor || '#0177E5',
          lineWidth: config.secondaryLineWidth ?? 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        secondarySeries.setData(config.secondaryLineData);
      }
      chart.timeScale().fitContent();

      window.chart = chart;
      window.series = series;
      window.secondarySeries = secondarySeries;
  `.trim();
}

function getEventHandlers(): string {
  return `
      var _isTouch = 'ontouchstart' in window;
      var _lastDataTime = 0;

      chart.subscribeCrosshairMove((param) => {
        let message;
        if (param.time && param.seriesPrices?.size > 0 && param.point) {
          _lastDataTime = Date.now();
          const rawSecondary = secondarySeries ? param.seriesPrices.get(secondarySeries) : undefined;
          message = {
            type: 'hover',
            time: String(param.time),
            price: String(param.seriesPrices.get(series)),
            secondaryPrice: rawSecondary !== undefined ? String(rawSecondary) : undefined,
            x: param.point.x,
            y: param.point.y,
          };
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        } else {
          if (_isTouch && (Date.now() - _lastDataTime < 300)) { return; }
          message = { type: 'hover', time: undefined, price: undefined, secondaryPrice: undefined, x: undefined, y: undefined };
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
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
