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
        return function(price) {
          return pctPriceFormatter(price, nextConfig);
        };
      }
      function getNormalizedLineWidth(lineWidth, fallback) {
        return Math.min(4, Math.max(1, Math.round(lineWidth ?? fallback ?? 3)));
      }
      function getPriceScalePosition(nextConfig) {
        return nextConfig.priceScalePosition === 'left' ? 'left' : 'right';
      }
      function getPriceScaleOptions(nextConfig, position) {
        if (getPriceScalePosition(nextConfig) !== position) {
          return { visible: false };
        }
        return Object.assign(
          {
            visible: Boolean(nextConfig.showPriceScale),
            borderVisible: false,
            entireTextOnly: Boolean(nextConfig.priceScaleEntireTextOnly),
          },
          nextConfig.priceScaleMargins
            ? { scaleMargins: nextConfig.priceScaleMargins }
            : {}
        );
      }
      var timeScaleFormatterCache = new Map();
      function getTimeScaleFormatOptions(tickMarkType) {
        if (tickMarkType === 0) return { year: 'numeric' };
        if (tickMarkType === 1) return { month: 'short' };
        if (tickMarkType === 2) return { day: 'numeric' };
        if (tickMarkType === 3) {
          return { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
        }
        if (tickMarkType === 4) {
          return {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
          };
        }
        return { month: 'short', day: 'numeric' };
      }
      function formatTimeScaleTickMark(time, tickMarkType, nextConfig) {
        var date = new Date(time * 1000);
        var formatterKey = [
          nextConfig.locale || '',
          nextConfig.timeZone,
          tickMarkType,
        ].join('|');
        var formatter = timeScaleFormatterCache.get(formatterKey);
        if (!formatter) {
          formatter = new Intl.DateTimeFormat(
            nextConfig.locale || undefined,
            Object.assign(
              { timeZone: nextConfig.timeZone },
              getTimeScaleFormatOptions(tickMarkType)
            )
          );
          timeScaleFormatterCache.set(formatterKey, formatter);
        }
        return formatter.format(date);
      }
      function getTimeScaleOptions(nextConfig) {
        var options = {
          visible: nextConfig.showTimeScale !== false,
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
          lockVisibleTimeRangeOnResize: true,
        };
        if (nextConfig.timeZone) {
          options.tickMarkFormatter = function(time, tickMarkType) {
            return formatTimeScaleTickMark(time, tickMarkType, nextConfig);
          };
        }
        return options;
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
          timeScale: getTimeScaleOptions(nextConfig),
          rightPriceScale: getPriceScaleOptions(nextConfig, 'right'),
          leftPriceScale: getPriceScaleOptions(nextConfig, 'left'),
        };
      }
      function getPrimarySeriesType(nextConfig) {
        if (nextConfig.seriesType === 'baseline') return 'baseline';
        if (nextConfig.seriesType === 'dotted-area') return 'dotted-area';
        if (nextConfig.seriesType === 'histogram') return 'histogram';
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
        var patternColor = nextConfig.patternColor || nextConfig.theme.lineColor;
        return {
          color: nextConfig.theme.lineColor,
          lineColor: nextConfig.theme.lineColor,
          lineWidth: getNormalizedLineWidth(nextConfig.lineWidth, 3),
          patternColor: patternColor,
          patternOpacity: 0.28,
          patternRadius: 0.9,
          patternSpacing: 10,
          showLastPointMarker: nextConfig.showLastPointMarker !== false,
          lastPointMarkerColor: patternColor,
          lastPointMarkerRadius: 5.5,
          priceScaleId: getPriceScalePosition(nextConfig),
          lastValueVisible: showLast,
          priceLineVisible: showLast,
          priceFormat: { type: 'custom', formatter: priceFormatter },
        };
      }
      function createHistogramSeriesPaneView() {
        var defaultOptions = Object.assign(
          {},
          LightweightCharts.customSeriesDefaultOptions || {},
          {
            color: '#22AB15',
            base: 0,
            barWidthRatio: 0.52,
            maxBarWidth: 24,
            baseLineVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
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
            var options = this.options || defaultOptions;
            var baseY = priceConverter(options.base);
            if (baseY === null || baseY === undefined) return;
            var barSpacing = this.data.barSpacing * Math.max(1, this.data.conflationFactor || 1);
            var barWidthRatio = Math.min(1, Math.max(0.1, options.barWidthRatio));
            var maxBarWidth = Math.max(1, options.maxBarWidth);
            var bars = this.data.bars;
            target.useBitmapCoordinateSpace(function(scope) {
              var ctx = scope.context;
              var horizontalRatio = scope.horizontalPixelRatio;
              var verticalRatio = scope.verticalPixelRatio;
              var barWidth = Math.max(
                1,
                Math.round(Math.min(maxBarWidth, barSpacing * barWidthRatio) * horizontalRatio)
              );
              var baseYInPixels = baseY * verticalRatio;
              bars.forEach(function(bar) {
                var value = bar.originalData.value;
                if (!Number.isFinite(value) || value === options.base) return;
                var valueY = priceConverter(value);
                if (valueY === null || valueY === undefined) return;
                var valueYInPixels = valueY * verticalRatio;
                var top = Math.min(valueYInPixels, baseYInPixels);
                var bottom = Math.max(valueYInPixels, baseYInPixels);
                var centerX = bar.x * horizontalRatio;
                var left = Math.round(centerX - barWidth / 2);
                var topPixel = Math.round(top);
                var bottomPixel = Math.round(bottom);
                ctx.fillStyle = bar.barColor || options.color;
                ctx.fillRect(
                  left,
                  topPixel,
                  barWidth,
                  Math.max(1, bottomPixel - topPixel)
                );
              });
            });
          },
        };
        return {
          renderer: function() { return renderer; },
          update: function(data, seriesOptions) { renderer.update(data, seriesOptions); },
          priceValueBuilder: function(plotRow) {
            return [renderer.options.base, plotRow.value, plotRow.value];
          },
          isWhitespace: function(data) {
            return !data || typeof data.value !== 'number' || !Number.isFinite(data.value);
          },
          defaultOptions: function() { return defaultOptions; },
        };
      }
      function getLineType(nextConfig) {
        return nextConfig.lineType === 'steps'
          ? LightweightCharts.LineType.WithSteps
          : LightweightCharts.LineType.Simple;
      }
      function getReferenceLineStyle(lineStyle) {
        if (lineStyle === 'dotted') return LightweightCharts.LineStyle.Dotted;
        if (lineStyle === 'dashed') return LightweightCharts.LineStyle.Dashed;
        if (lineStyle === 'large-dashed') return LightweightCharts.LineStyle.LargeDashed;
        if (lineStyle === 'sparse-dotted') return LightweightCharts.LineStyle.SparseDotted;
        return LightweightCharts.LineStyle.Solid;
      }
      function getHistogramSeriesOptions(nextConfig) {
        var priceFormatter = getPriceFormatter(nextConfig);
        var showLast = Boolean(nextConfig.showLastValue);
        var histogramOptions = nextConfig.histogramOptions || {};
        return {
          priceScaleId: getPriceScalePosition(nextConfig),
          base: Number.isFinite(histogramOptions.base) ? histogramOptions.base : 0,
          color: histogramOptions.positiveColor || nextConfig.theme.lineColor,
          barWidthRatio: Number.isFinite(histogramOptions.barWidthRatio)
            ? histogramOptions.barWidthRatio
            : 0.52,
          maxBarWidth: Number.isFinite(histogramOptions.maxBarWidth)
            ? histogramOptions.maxBarWidth
            : 24,
          baseLineVisible: false,
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
            priceScaleId: getPriceScalePosition(nextConfig),
            lineType: getLineType(nextConfig),
            lineWidth: normalizedLineWidth,
            lastValueVisible: showLast,
            priceLineVisible: showLast,
            crosshairMarkerRadius: 5,
            priceFormat: { type: 'custom', formatter: priceFormatter },
          }));
        }
        if (getPrimarySeriesType(nextConfig) === 'histogram') {
          return chart.addCustomSeries(
            createHistogramSeriesPaneView(),
            getHistogramSeriesOptions(nextConfig)
          );
        }
        return chart.addSeries(LightweightCharts.AreaSeries, {
          priceScaleId: getPriceScalePosition(nextConfig),
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
            priceScaleId: getPriceScalePosition(nextConfig),
            lineType: getLineType(nextConfig),
            lineWidth: normalizedLineWidth,
            lastValueVisible: showLast,
            priceLineVisible: showLast,
            crosshairMarkerRadius: 5,
            priceFormat: { type: 'custom', formatter: priceFormatter },
          }));
          return;
        }
        if (window.seriesType === 'histogram') {
          window.series.applyOptions(getHistogramSeriesOptions(nextConfig));
          return;
        }
        window.series.applyOptions({
          priceScaleId: getPriceScalePosition(nextConfig),
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
          window.referencePriceLine = null;
          window.series = createPrimarySeries(nextConfig);
          window.seriesType = nextSeriesType;
        } else {
          applyPrimarySeriesOptions(nextConfig);
        }
        window.series.setData(Array.isArray(nextConfig.data) ? nextConfig.data : []);
      }
      function syncReferenceLine(nextConfig) {
        if (!window.series) return;
        if (window.referencePriceLine) {
          window.series.removePriceLine(window.referencePriceLine);
          window.referencePriceLine = null;
        }
        if (!nextConfig.referenceLine) return;
        window.referencePriceLine = window.series.createPriceLine({
          price: nextConfig.referenceLine.price,
          color: nextConfig.referenceLine.color,
          lineWidth: getNormalizedLineWidth(nextConfig.referenceLine.lineWidth, 1),
          lineStyle: getReferenceLineStyle(nextConfig.referenceLine.lineStyle),
          lineVisible: true,
          axisLabelVisible: Boolean(nextConfig.referenceLine.axisLabelVisible),
          title: '',
        });
      }
      function getSecondarySeriesOptions(nextConfig) {
        return {
          priceScaleId: getPriceScalePosition(nextConfig),
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
      function pctPriceFormatter(price, nextConfig) {
        var precision = Number(nextConfig && nextConfig.priceFormatterPrecision);
        if (!Number.isInteger(precision) || precision < 0 || precision > 10) {
          precision = 2;
        }
        return price.toFixed(precision) + '%';
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
            color: config.crosshairVertLineColor || 'rgba(150, 150, 150, 0.4)',
            width: 1,
            style: config.crosshairVertLineStyle ?? 3,
            labelVisible: false,
          },
          horzLine: {
            visible: false,
            labelVisible: !config.hideCrosshairPriceLabel,
          },
        },
        timeScale: getTimeScaleOptions(config),
        rightPriceScale: getPriceScaleOptions(config, 'right'),
        leftPriceScale: getPriceScaleOptions(config, 'left'),
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
      window.referencePriceLine = null;
      window.secondarySeries = null;
      window.applyChartConfig = function(nextConfig) {
        if (!nextConfig || !window.chart) return;
        window.chart.applyOptions(getChartOptions(nextConfig));
        syncPrimarySeries(nextConfig);
        syncReferenceLine(nextConfig);
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
