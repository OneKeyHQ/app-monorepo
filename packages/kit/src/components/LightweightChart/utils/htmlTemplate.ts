// cspell:ignore tickmarks
import formatChartPriceSource from './formatChartPriceSource';
import { getLightweightChartsRuntimeScriptTag } from './lightweightChartsRuntime';

import type { ILightweightChartConfig } from '../types';

function getStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { position: relative; }
    #chart { position: absolute; inset: 0; width: 100%; height: 100%; }
    .tv-lightweight-charts table tr:last-child { pointer-events: none !important; }
    /* Mirrors LightweightChartPulseDot on web/desktop. */
    #pulse { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; pointer-events: none; display: none; z-index: 5; }
    #pulse > div { position: absolute; inset: 0; border-radius: 50%; }
    #scrub-tooltip { position: absolute; display: none; pointer-events: none; z-index: 5; width: 120px; padding: 6px 8px; border: 1px solid; border-radius: 8px; font-family: sans-serif; }
    #scrub-time { font-size: 12px; line-height: 16px; white-space: nowrap; }
    #scrub-price { font-size: 14px; line-height: 20px; font-weight: 500; white-space: nowrap; }
    #pulse .ring { animation: okChartPulseRing 1.4s ease-out infinite; }
    #pulse .dot { animation: okChartPulseDot 1.4s ease-in-out infinite; }
    @keyframes okChartPulseRing { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.4); opacity: 0; } }
    @keyframes okChartPulseDot { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
  `.trim();
}

function getChartInitScript(): string {
  return `
      window.__onekeyFormatChartPrice = ${formatChartPriceSource};
      function getPriceFormatter(nextConfig) {
        if (nextConfig.priceScaleFormat === 'full') {
          return function(price) {
            var formatChartPrice = window.__onekeyFormatChartPrice;
            return formatChartPrice(
              price,
              nextConfig.compactPriceMaxCharacters || 10,
              false,
              'cents',
            );
          };
        }
        if (nextConfig.priceScaleFormat === 'stock') {
          return function(price) {
            var formatChartPrice = window.__onekeyFormatChartPrice;
            return formatChartPrice(
              price,
              nextConfig.compactPriceMaxCharacters || 10,
              true,
            );
          };
        }
        if (nextConfig.compactPriceMaxCharacters) {
          return function(price) {
            var formatChartPrice = window.__onekeyFormatChartPrice;
            return formatChartPrice(price, nextConfig.compactPriceMaxCharacters);
          };
        }
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
      // Mirrors formatChartPriceFullTicks: whole-dollar steps drop the decimals
      // on every tick, any fractional step keeps two on every tick.
      function getTickPriceFormatter(nextConfig) {
        if (nextConfig.priceScaleFormat !== 'full') return undefined;
        return function(prices) {
          var formatChartPrice = window.__onekeyFormatChartPrice;
          var maxCharacters = nextConfig.compactPriceMaxCharacters || 10;
          var values = prices.map(function(price) {
            return Number.isFinite(price) ? Number(price.toPrecision(15)) : price;
          });
          var wholeDollarTicks =
            values.some(function(value) { return Math.abs(value) >= 1; }) &&
            values.every(function(value) {
              return Number.isInteger(value) && Math.abs(value) < 1e6;
            });
          return values.map(function(value) {
            return formatChartPrice(
              value,
              maxCharacters,
              false,
              wholeDollarTicks ? 'whole' : 'cents',
            );
          });
        };
      }
      // Without a base the axis never steps below 0.01, which leaves a
      // sub-cent token with a single $0 tick.
      function getCustomPriceFormat(nextConfig, priceFormatter) {
        var priceFormat = { type: 'custom', formatter: priceFormatter };
        var tickmarksFormatter = getTickPriceFormatter(nextConfig);
        if (tickmarksFormatter) {
          priceFormat.tickmarksFormatter = tickmarksFormatter;
        }
        if (Number.isFinite(nextConfig.priceFormatBase) && nextConfig.priceFormatBase > 0) {
          priceFormat.base = nextConfig.priceFormatBase;
        }
        return priceFormat;
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
            minimumWidth: nextConfig.priceScaleMinimumWidth ?? 0,
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
        // fixRightEdge clamps any right offset back to zero. Scrolling and
        // scaling are off, so the lock can go when a tail gap is asked for.
        var rightGap = Number(nextConfig.timeScaleRightOffsetPixels) || 0;
        var options = {
          visible: nextConfig.showTimeScale !== false,
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: true,
          fixRightEdge: rightGap <= 0,
          lockVisibleTimeRangeOnResize: true,
        };
        if (rightGap > 0) {
          options.rightOffsetPixels = rightGap;
        }
        if (nextConfig.timeZone) {
          options.tickMarkFormatter = function(time, tickMarkType) {
            return formatTimeScaleTickMark(time, tickMarkType, nextConfig);
          };
        }
        return options;
      }
      function getChartOptions(nextConfig) {
        var options = {
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
        // Desktop installs formatChartPrice on the series, and the price scale
        // uses that for both ticks and the last-value badge. A function cannot
        // cross into the WebView, so the same formatter is installed on the
        // scale itself. Otherwise the badge keeps the series' raw precision
        // ("$0.184056...") while ticks stay compact ("$0.19").
        if (nextConfig.compactPriceMaxCharacters) {
          options.localization = {
            priceFormatter: getPriceFormatter(nextConfig),
            tickmarksPriceFormatter: getTickPriceFormatter(nextConfig),
          };
        }
        return options;
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
          priceFormat: getCustomPriceFormat(nextConfig, priceFormatter),
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
      function getLastValueSeriesOptions(nextConfig) {
        var showLast = Boolean(nextConfig.showLastValue);
        return {
          lastValueVisible: showLast,
          priceLineVisible: showLast && nextConfig.showLastValuePriceLine !== false,
          priceLineColor: nextConfig.lastValueLabelColor || '',
        };
      }
      function getReferenceLineAutoscaleInfoProvider(nextConfig) {
        var referenceLine = nextConfig.referenceLine;
        var price =
          referenceLine && referenceLine.includeInAutoscale
            ? referenceLine.price
            : undefined;
        return function(baseImplementation) {
          var autoscaleInfo = baseImplementation();
          if (!Number.isFinite(price) || !autoscaleInfo || !autoscaleInfo.priceRange) {
            return autoscaleInfo;
          }
          return Object.assign({}, autoscaleInfo, {
            priceRange: {
              minValue: Math.min(autoscaleInfo.priceRange.minValue, price),
              maxValue: Math.max(autoscaleInfo.priceRange.maxValue, price),
            },
          });
        };
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
          priceFormat: getCustomPriceFormat(nextConfig, priceFormatter),
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
            priceFormat: getCustomPriceFormat(nextConfig, priceFormatter),
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
          priceFormat: getCustomPriceFormat(nextConfig, priceFormatter),
        });
      }
      function syncReferenceLine(nextConfig) {
        if (!window.series) return;
        window.series.applyOptions({
          autoscaleInfoProvider: getReferenceLineAutoscaleInfoProvider(nextConfig),
        });
        if (window.referencePriceLine) {
          window.series.removePriceLine(window.referencePriceLine);
          window.referencePriceLine = null;
        }
        if (!nextConfig.referenceLine) return;
        var referenceLineOptions = {
          price: nextConfig.referenceLine.price,
          color: nextConfig.referenceLine.color,
          lineWidth: getNormalizedLineWidth(nextConfig.referenceLine.lineWidth, 1),
          lineStyle: getReferenceLineStyle(nextConfig.referenceLine.lineStyle),
          lineVisible: true,
          axisLabelVisible: Boolean(nextConfig.referenceLine.axisLabelVisible),
          title: nextConfig.referenceLine.title || '',
        };
        if (nextConfig.referenceLine.axisLabelColor) {
          referenceLineOptions.axisLabelColor = nextConfig.referenceLine.axisLabelColor;
        }
        if (nextConfig.referenceLine.axisLabelTextColor) {
          referenceLineOptions.axisLabelTextColor = nextConfig.referenceLine.axisLabelTextColor;
        }
        window.referencePriceLine = window.series.createPriceLine(referenceLineOptions);
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
      // Overlay points with gaps on both sides draw no segment; this dot-only
      // series in the same color keeps them visible.
      function getSecondaryPointSeriesOptions(nextConfig) {
        return {
          priceScaleId: getPriceScalePosition(nextConfig),
          color: nextConfig.secondaryLineColor || '#0177E5',
          lineVisible: false,
          pointMarkersVisible: true,
          pointMarkersRadius: getNormalizedLineWidth(nextConfig.secondaryLineWidth, 2) + 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        };
      }
      function createNativeScrubLine(nextConfig) {
        var renderer = {
          draw: function(target) {
            target.useMediaCoordinateSpace(function(scope) {
              var ctx = scope.context;
              var points = nextConfig.secondaryLineData || [];
              var time = window.nativeScrubTime;
              var started = false;
              ctx.save();
              ctx.strokeStyle = nextConfig.secondaryLineColor;
              ctx.lineWidth = getNormalizedLineWidth(nextConfig.secondaryLineWidth, 2);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              for (var i = 0; i < points.length; i += 1) {
                var point = points[i];
                if (time !== undefined && point.time > Number(time)) break;
                var x = window.chart.timeScale().timeToCoordinate(point.time);
                var y = window.series.priceToCoordinate(point.value);
                if (x === null || y === null) continue;
                if (started) ctx.lineTo(x, y);
                else ctx.moveTo(x, y);
                started = true;
              }
              ctx.stroke();
              ctx.fillStyle = nextConfig.secondaryLineColor;
              var isolatedPoints = nextConfig.secondaryPointData || [];
              for (var j = 0; j < isolatedPoints.length; j += 1) {
                var isolated = isolatedPoints[j];
                if (time !== undefined && isolated.time > Number(time)) break;
                var pointX = window.chart.timeScale().timeToCoordinate(isolated.time);
                var pointY = window.series.priceToCoordinate(isolated.value);
                if (pointX === null || pointY === null) continue;
                ctx.beginPath();
                ctx.arc(pointX, pointY, getNormalizedLineWidth(nextConfig.secondaryLineWidth, 2) + 1, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            });
          },
        };
        var views = [{
          zOrder: function() { return 'top'; },
          renderer: function() { return renderer; },
        }];
        return { paneViews: function() { return views; } };
      }
      // Rebuilds both series from scratch on every apply.
      //
      // lightweight-charts 5.2 keeps a stale copy of its time points after a
      // single-series setData whose times did not change: the fast path swaps
      // the point objects, but _replaceTimeScalePoints returns early and keeps
      // the old list. Once a second series exists, the next setData on the
      // first one deletes its rows through that stale list, the cleanup pass
      // then treats those points as empty and drops the shared keys from the
      // map, the time scale ends up with no points and the chart goes blank,
      // axes included. Both lines get identical timestamps from the 1D / 1W
      // buckets, which is exactly the trigger (OK-62390, OK-63666). Removing
      // every series resets that state, and rebuilding is cheap at these
      // sizes. The primary goes first so the overlay keeps drawing on top of
      // it; everything runs before the next frame, so nothing flickers.
      function rebuildSeries(nextConfig) {
        if (window.secondaryPointSeries) {
          window.chart.removeSeries(window.secondaryPointSeries);
          window.secondaryPointSeries = null;
        }
        if (window.secondarySeries) {
          window.chart.removeSeries(window.secondarySeries);
          window.secondarySeries = null;
        }
        if (window.series) {
          window.chart.removeSeries(window.series);
          window.series = null;
          window.referencePriceLine = null;
        }
        window.series = createPrimarySeries(nextConfig);
        window.seriesType = getPrimarySeriesType(nextConfig);
        window.series.applyOptions(getLastValueSeriesOptions(nextConfig));
        window.series.setData(Array.isArray(nextConfig.data) ? nextConfig.data : []);
        syncReferenceLine(nextConfig);
        // Cursor-layer primitives repaint with the crosshair, without making
        // setData invalidate and redraw the expensive static dotted area.
        if (nextConfig.nativeScrubOptions) {
          window.series.attachPrimitive(createNativeScrubLine(nextConfig));
        } else if (
          Array.isArray(nextConfig.secondaryLineData) &&
          nextConfig.secondaryLineData.length > 0
        ) {
          window.secondarySeries = window.chart.addSeries(
            LightweightCharts.LineSeries,
            getSecondarySeriesOptions(nextConfig)
          );
          window.secondarySeries.setData(nextConfig.secondaryLineData);
          if (
            Array.isArray(nextConfig.secondaryPointData) &&
            nextConfig.secondaryPointData.length > 0
          ) {
            window.secondaryPointSeries = window.chart.addSeries(
              LightweightCharts.LineSeries,
              getSecondaryPointSeriesOptions(nextConfig)
            );
            window.secondaryPointSeries.setData(nextConfig.secondaryPointData);
          }
        }
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
      var pulseElement = document.getElementById('pulse');
      var pulseFrameId = 0;
      // Placed on the next frame: autoscale and axis width settle after
      // setData, so reading coordinates right away lands on the old layout.
      window.updatePulseDot = function() {
        if (pulseFrameId) cancelAnimationFrame(pulseFrameId);
        pulseFrameId = requestAnimationFrame(function() {
          pulseFrameId = 0;
          var nextConfig = window.latestChartConfig;
          var data = nextConfig && Array.isArray(nextConfig.data) ? nextConfig.data : [];
          var lastPoint = data[data.length - 1];
          var x = lastPoint && window.chart
            ? window.chart.timeScale().timeToCoordinate(lastPoint.time)
            : null;
          var y = lastPoint && window.series
            ? window.series.priceToCoordinate(lastPoint.value)
            : null;
          if (!nextConfig || !nextConfig.pulseLastPoint || x === null || y === null) {
            pulseElement.style.display = 'none';
            return;
          }
          var color = nextConfig.pulseLastPointColor || nextConfig.theme.lineColor;
          for (var i = 0; i < pulseElement.children.length; i += 1) {
            pulseElement.children[i].style.backgroundColor = color;
          }
          pulseElement.style.left = x + 'px';
          pulseElement.style.top = y + 'px';
          pulseElement.style.display = 'block';
        });
      };
      chart.timeScale().subscribeVisibleTimeRangeChange(function() {
        window.updatePulseDot();
      });
      window.secondaryPointSeries = null;
      window.applyChartConfig = function(nextConfig) {
        if (!nextConfig || !window.chart) return;
        if (!nextConfig.nativeScrubOptions || !nextConfig.nativeScrubOptions.labels[window.nativeScrubTime]) {
          window.nativeScrubTime = undefined;
          var tooltip = document.getElementById('scrub-tooltip');
          if (tooltip) tooltip.style.display = 'none';
        }
        window.applyingChartConfig = true;
        window.latestChartConfig = nextConfig;
        window.chart.applyOptions(getChartOptions(nextConfig));
        rebuildSeries(nextConfig);
        window.chart.timeScale().fitContent();
        window.updatePulseDot();
        window.applyingChartConfig = false;
      };
      window.applyChartConfig(config);
  `.trim();
}

function getEventHandlers(): string {
  return `
      var _isTouch = 'ontouchstart' in window;
      var _lastDataTime = 0;

      function updateNativeScrub(message) {
        var nextConfig = window.latestChartConfig;
        var options = nextConfig.nativeScrubOptions;
        if (!options) return;
        var time = message.time;
        window.nativeScrubTime = time;
        var tooltip = document.getElementById('scrub-tooltip');
        var label = options.labels[time];
        if (!label || message.x === undefined || message.y === undefined) {
          tooltip.style.display = 'none';
          return;
        }
        document.getElementById('scrub-time').textContent = label.time;
        var price = document.getElementById('scrub-price');
        price.textContent = label.price || '';
        price.style.display = label.price === undefined ? 'none' : 'block';
        price.style.fontSize = options.largePrice ? '16px' : '14px';
        price.style.marginTop = options.largePrice ? '2px' : '0';
        price.style.color = options.textColor;
        document.getElementById('scrub-time').style.color = options.timeColor;
        tooltip.style.backgroundColor = options.backgroundColor;
        tooltip.style.borderColor = options.borderColor;
        var left = message.x < container.clientWidth / 2 ? message.x + 10 : message.x - 130;
        tooltip.style.left = Math.min(Math.max(left, 8), container.clientWidth - 128) + 'px';
        tooltip.style.top = Math.max(8, message.y - 56) + 'px';
        tooltip.style.display = 'block';
      }

      chart.subscribeCrosshairMove((param) => {
        // Series updates recalculate the crosshair without a touch. Sending
        // those back to React creates a second round trip for every step.
        var nativeScrub = window.latestChartConfig.nativeScrubOptions;
        var syntheticHover = nativeScrub && param.time !== undefined && !param.sourceEvent;
        if (syntheticHover && window.nativeScrubTime === undefined) return;
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
        } else {
          // Removing series during a refresh is not an exit from tracking.
          if (nativeScrub && window.applyingChartConfig) return;
          if (_isTouch && !nativeScrub && (Date.now() - _lastDataTime < 300)) { return; }
          message = { type: 'hover', time: undefined, price: undefined, secondaryPrice: undefined, x: undefined, y: undefined };
        }
        updateNativeScrub(message);
        if (!syntheticHover && window.latestChartConfig.notifyOnHover !== false) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      });

      window.repaintChart = function() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
          // A translated native header can return with the same DOM dimensions.
          // Force a repaint even when ResizeObserver has nothing new to report.
          chart.resize(width, height, true);
        }
        if (typeof window.updatePulseDot === 'function') window.updatePulseDot();
      };
      new ResizeObserver(() => window.repaintChart()).observe(container);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) window.repaintChart();
      });
      window.addEventListener('pageshow', () => window.repaintChart());

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
  <div id="pulse"><div class="ring"></div><div class="dot"></div></div>
  <div id="scrub-tooltip"><div id="scrub-time"></div><div id="scrub-price"></div></div>
  <script>${getChartScript(config)}</script>
</body>
</html>`;
}
