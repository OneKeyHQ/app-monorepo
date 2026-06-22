import { getLightweightChartsRuntimeScriptTag } from './lightweightChartsRuntime';

import type { ILightweightChartConfig } from '../types';

function getStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { position: relative; }
    #chart { position: absolute; inset: 0; width: 100%; height: 100%; }
    .tv-lightweight-charts table tr:last-child { pointer-events: none !important; }
  `.trim();
}

function getChartInitScript(): string {
  return `
      function getPriceFormatter(nextConfig) {
        if (nextConfig.priceFormatterType === 'usd') return usdPriceFormatter;
        if (nextConfig.priceFormatterType === 'number') {
          return function(price) {
            return numberPriceFormatter(price, nextConfig);
          };
        }
        return pctPriceFormatter;
      }
      function getNormalizedLineWidth(lineWidth, fallback) {
        return Math.min(4, Math.max(1, Math.round(lineWidth ?? fallback ?? 3)));
      }
      function getChartOptions(nextConfig) {
        return {
          layout: {
            background: { color: nextConfig.theme.bgColor },
            textColor: nextConfig.theme.textSubduedColor,
            fontSize: nextConfig.fontSize || 12,
            attributionLogo: false,
          },
          grid: {
            vertLines: { visible: false },
            horzLines: nextConfig.showHorzGridLines
              ? {
                  visible: true,
                  color: nextConfig.horzLineColor || '#E5E5EA',
                  style: nextConfig.horzLineStyle ?? 2,
                }
              : { visible: false },
          },
          timeScale: {
            visible: nextConfig.showTimeScale !== false,
            borderVisible: false,
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
            lockVisibleTimeRangeOnResize: true,
          },
          rightPriceScale: Object.assign(
            { visible: Boolean(nextConfig.showPriceScale), borderVisible: false },
            nextConfig.priceScaleMargins
              ? { scaleMargins: nextConfig.priceScaleMargins }
              : {}
          ),
        };
      }
      function getPrimarySeriesType(nextConfig) {
        if (nextConfig.seriesType === 'baseline') return 'baseline';
        if (nextConfig.seriesType === 'dotted-area') return 'dotted-area';
        return 'area';
      }
      function createDottedAreaSeriesPaneView() {
        var defaultOptions = Object.assign(
          {},
          LightweightCharts.customSeriesDefaultOptions || {},
          {
            color: '#8D8FE8',
            lineColor: '#8D8FE8',
            lineWidth: 3,
            patternColor: '#8D8FE8',
            patternOpacity: 0.28,
            patternRadius: 0.9,
            patternSpacing: 10,
            showLastPointMarker: true,
            lastPointMarkerColor: '#8D8FE8',
            lastPointMarkerRadius: 5.5,
          }
        );
        var renderer = {
          data: null,
          options: defaultOptions,
          update: function(data, options) {
            this.data = data;
            this.options = options || defaultOptions;
          },
          draw: function(target, priceConverter) {
            if (!this.data || !this.data.bars || !this.data.bars.length) return;
            var bars = this.data.bars;
            var options = this.options || defaultOptions;
            target.useBitmapCoordinateSpace(function(scope) {
              var ctx = scope.context;
              var horizontalRatio = scope.horizontalPixelRatio;
              var verticalRatio = scope.verticalPixelRatio;
              var radius = Math.max(0.1, options.patternRadius) * Math.min(horizontalRatio, verticalRatio);
              var xSpacing = Math.max(1, options.patternSpacing) * horizontalRatio;
              var ySpacing = Math.max(1, options.patternSpacing) * verticalRatio;
              var bottom = scope.bitmapSize.height;
              var points = bars
                .map(function(bar) {
                  var y = priceConverter(bar.originalData.value);
                  if (y === null || y === undefined) return null;
                  return { x: bar.x * horizontalRatio, y: y * verticalRatio };
                })
                .filter(function(point) {
                  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
                });
              if (!points.length) return;

              var firstPoint = points[0];
              var lastPoint = points[points.length - 1];
              var minX = Math.min.apply(null, points.map(function(point) { return point.x; }));
              var maxX = Math.max.apply(null, points.map(function(point) { return point.x; }));
              var minY = Math.min.apply(null, points.map(function(point) { return point.y; }));

              if (points.length > 1) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(firstPoint.x, bottom);
                points.forEach(function(point) { ctx.lineTo(point.x, point.y); });
                ctx.lineTo(lastPoint.x, bottom);
                ctx.closePath();
                ctx.clip();
                ctx.globalAlpha = Math.max(0, Math.min(1, options.patternOpacity));
                ctx.fillStyle = options.patternColor;
                var startX = Math.floor(minX / xSpacing) * xSpacing + xSpacing / 2;
                var startY = Math.floor(minY / ySpacing) * ySpacing + ySpacing / 2;
                for (var x = startX; x <= maxX + xSpacing; x += xSpacing) {
                  for (var yDot = startY; yDot <= bottom + ySpacing; yDot += ySpacing) {
                    ctx.beginPath();
                    ctx.arc(x, yDot, radius, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }
                ctx.restore();
              }

              ctx.save();
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.strokeStyle = options.lineColor;
              ctx.lineWidth = getNormalizedLineWidth(options.lineWidth, 3) * verticalRatio;
              ctx.beginPath();
              points.forEach(function(point, index) {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
              });
              ctx.stroke();
              ctx.restore();

              if (options.showLastPointMarker) {
                ctx.save();
                ctx.fillStyle = options.lastPointMarkerColor;
                ctx.beginPath();
                ctx.arc(
                  lastPoint.x,
                  lastPoint.y,
                  Math.max(1, options.lastPointMarkerRadius) * Math.min(horizontalRatio, verticalRatio),
                  0,
                  Math.PI * 2
                );
                ctx.fill();
                ctx.restore();
              }
            });
          },
        };
        return {
          renderer: function() { return renderer; },
          update: function(data, seriesOptions) { renderer.update(data, seriesOptions); },
          priceValueBuilder: function(plotRow) { return [plotRow.value]; },
          isWhitespace: function(data) {
            return !data || typeof data.value !== 'number' || !Number.isFinite(data.value);
          },
          defaultOptions: function() { return defaultOptions; },
        };
      }
      function getDottedAreaSeriesOptions(nextConfig) {
        var priceFormatter = getPriceFormatter(nextConfig);
        var showLast = Boolean(nextConfig.showLastValue);
        return {
          color: nextConfig.theme.lineColor,
          lineColor: nextConfig.theme.lineColor,
          lineWidth: getNormalizedLineWidth(nextConfig.lineWidth, 3),
          patternColor: nextConfig.theme.lineColor,
          patternOpacity: 0.28,
          patternRadius: 0.9,
          patternSpacing: 10,
          showLastPointMarker: nextConfig.showLastPointMarker !== false,
          lastPointMarkerColor: nextConfig.theme.lineColor,
          lastPointMarkerRadius: 5.5,
          lastValueVisible: showLast,
          priceLineVisible: showLast,
          priceFormat: { type: 'custom', formatter: priceFormatter },
        };
      }
      function createPrimarySeries(nextConfig) {
        var priceFormatter = getPriceFormatter(nextConfig);
        var showLast = Boolean(nextConfig.showLastValue);
        var normalizedLineWidth = getNormalizedLineWidth(nextConfig.lineWidth, 3);
        if (getPrimarySeriesType(nextConfig) === 'dotted-area') {
          return chart.addCustomSeries(
            createDottedAreaSeriesPaneView(),
            getDottedAreaSeriesOptions(nextConfig)
          );
        }
        if (getPrimarySeriesType(nextConfig) === 'baseline') {
          return chart.addSeries(LightweightCharts.BaselineSeries, Object.assign({}, nextConfig.baselineOptions, {
            lineWidth: normalizedLineWidth,
            lastValueVisible: showLast,
            priceLineVisible: showLast,
            crosshairMarkerRadius: 5,
            priceFormat: { type: 'custom', formatter: priceFormatter },
          }));
        }
        return chart.addSeries(LightweightCharts.AreaSeries, {
          topColor: nextConfig.theme.topColor,
          bottomColor: nextConfig.theme.bottomColor,
          lineColor: nextConfig.theme.lineColor,
          lineWidth: normalizedLineWidth,
          lastValueVisible: showLast,
          priceLineVisible: showLast,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: nextConfig.theme.lineColor,
          crosshairMarkerBackgroundColor: '#ffffff',
          priceFormat: { type: 'custom', formatter: priceFormatter },
        });
      }
      function applyPrimarySeriesOptions(nextConfig) {
        if (!window.series) return;
        var priceFormatter = getPriceFormatter(nextConfig);
        var showLast = Boolean(nextConfig.showLastValue);
        var normalizedLineWidth = getNormalizedLineWidth(nextConfig.lineWidth, 3);
        if (window.seriesType === 'dotted-area') {
          window.series.applyOptions(getDottedAreaSeriesOptions(nextConfig));
          return;
        }
        if (window.seriesType === 'baseline') {
          window.series.applyOptions(Object.assign({}, nextConfig.baselineOptions, {
            lineWidth: normalizedLineWidth,
            lastValueVisible: showLast,
            priceLineVisible: showLast,
            crosshairMarkerRadius: 5,
            priceFormat: { type: 'custom', formatter: priceFormatter },
          }));
          return;
        }
        window.series.applyOptions({
          topColor: nextConfig.theme.topColor,
          bottomColor: nextConfig.theme.bottomColor,
          lineColor: nextConfig.theme.lineColor,
          lineWidth: normalizedLineWidth,
          lastValueVisible: showLast,
          priceLineVisible: showLast,
          crosshairMarkerRadius: 5,
          crosshairMarkerBorderColor: nextConfig.theme.lineColor,
          crosshairMarkerBackgroundColor: '#ffffff',
          priceFormat: { type: 'custom', formatter: priceFormatter },
        });
      }
      function syncPrimarySeries(nextConfig) {
        var nextSeriesType = getPrimarySeriesType(nextConfig);
        if (!window.series || window.seriesType !== nextSeriesType) {
          if (window.series) {
            chart.removeSeries(window.series);
          }
          window.series = createPrimarySeries(nextConfig);
          window.seriesType = nextSeriesType;
        } else {
          applyPrimarySeriesOptions(nextConfig);
        }
        window.series.setData(Array.isArray(nextConfig.data) ? nextConfig.data : []);
      }
      function getSecondarySeriesOptions(nextConfig) {
        return {
          color: nextConfig.secondaryLineColor || '#0177E5',
          lineWidth: getNormalizedLineWidth(nextConfig.secondaryLineWidth, 2),
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        };
      }
      function syncSecondarySeries(nextConfig) {
        var hasSecondaryData =
          Array.isArray(nextConfig.secondaryLineData) &&
          nextConfig.secondaryLineData.length > 0;
        if (!hasSecondaryData) {
          if (window.secondarySeries) {
            chart.removeSeries(window.secondarySeries);
            window.secondarySeries = null;
          }
          return;
        }
        if (!window.secondarySeries) {
          window.secondarySeries = chart.addSeries(
            LightweightCharts.LineSeries,
            getSecondarySeriesOptions(nextConfig)
          );
        } else {
          window.secondarySeries.applyOptions(getSecondarySeriesOptions(nextConfig));
        }
        window.secondarySeries.setData(nextConfig.secondaryLineData);
      }
      // Price formatter: use a serializable formatter type in WebView, otherwise default %
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
      function numberPriceFormatter(price, nextConfig) {
        var tickStep = Number(nextConfig && nextConfig.priceFormatterTickStep);
        if (Number.isFinite(tickStep) && tickStep > 0) {
          var roundedPrice = Math.round(Number(price));
          if (Math.abs(roundedPrice / tickStep - Math.round(roundedPrice / tickStep)) > 0.000001) {
            return '';
          }
          return roundedPrice.toLocaleString('en-US');
        }
        return Number(price).toLocaleString('en-US', { maximumFractionDigits: 2 });
      }

      const chart = LightweightCharts.createChart(container, {
        layout: {
          background: { color: config.theme.bgColor },
          textColor: config.theme.textSubduedColor,
          fontSize: config.fontSize || 12,
          attributionLogo: false,
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
          visible: config.showTimeScale !== false,
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

      window.chart = chart;
      window.series = null;
      window.seriesType = null;
      window.secondarySeries = null;
      window.applyChartConfig = function(nextConfig) {
        if (!nextConfig || !window.chart) return;
        window.chart.applyOptions(getChartOptions(nextConfig));
        syncPrimarySeries(nextConfig);
        syncSecondarySeries(nextConfig);
        window.chart.timeScale().fitContent();
      };
      window.applyChartConfig(config);
  `.trim();
}

function getEventHandlers(): string {
  return `
      var _isTouch = 'ontouchstart' in window;
      var _lastDataTime = 0;

      chart.subscribeCrosshairMove((param) => {
        let message;
        var primarySeries = window.series;
        var extraSeries = window.secondarySeries;
        function getSeriesValue(seriesData) {
          if (seriesData && typeof seriesData.value === 'number') return seriesData.value;
          if (seriesData && seriesData.value !== undefined) return Number(seriesData.value);
          return undefined;
        }
        if (param.time && param.seriesData?.size > 0 && param.point && primarySeries) {
          _lastDataTime = Date.now();
          const primaryPrice = getSeriesValue(param.seriesData.get(primarySeries));
          const rawSecondary = extraSeries ? getSeriesValue(param.seriesData.get(extraSeries)) : undefined;
          message = {
            type: 'hover',
            time: String(param.time),
            price: primaryPrice !== undefined ? String(primaryPrice) : undefined,
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
  ${getLightweightChartsRuntimeScriptTag()}
  <style>${getStyles()}</style>
</head>
<body>
  <div id="chart"></div>
  <script>${getChartScript(config)}</script>
</body>
</html>`;
}
