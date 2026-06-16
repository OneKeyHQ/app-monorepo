import { LIGHTWEIGHT_CHARTS_CDN } from './constants';

import type { ILightweightChartConfig } from '../types';

function getStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #chart { width: 100%; height: 100%; position: relative; }
    .ok-lightweight-dotted-area-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
    }
    .tv-lightweight-charts table tr:last-child { pointer-events: none !important; }
  `.trim();
}

function getChartInitScript(): string {
  return `
      function getPriceFormatter(nextConfig) {
        return nextConfig.priceFormatterType === 'usd'
          ? usdPriceFormatter
          : pctPriceFormatter;
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
          rightPriceScale: Object.assign(
            { visible: Boolean(nextConfig.showPriceScale), borderVisible: false },
            nextConfig.priceScaleMargins
              ? { scaleMargins: nextConfig.priceScaleMargins }
              : {}
          ),
        };
      }
      function getPrimarySeriesType(nextConfig) {
        return nextConfig.seriesType === 'baseline' ? 'baseline' : 'area';
      }
      function createPrimarySeries(nextConfig) {
        var priceFormatter = getPriceFormatter(nextConfig);
        var showLast = Boolean(nextConfig.showLastValue);
        var normalizedLineWidth = getNormalizedLineWidth(nextConfig.lineWidth, 3);
        if (getPrimarySeriesType(nextConfig) === 'baseline') {
          return chart.addBaselineSeries(Object.assign({}, nextConfig.baselineOptions, {
            lineWidth: normalizedLineWidth,
            lastValueVisible: showLast,
            priceLineVisible: showLast,
            crosshairMarkerRadius: 5,
            priceFormat: { type: 'custom', formatter: priceFormatter },
          }));
        }
        return chart.addAreaSeries({
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
          window.secondarySeries = chart.addLineSeries(
            getSecondarySeriesOptions(nextConfig)
          );
        } else {
          window.secondarySeries.applyOptions(getSecondarySeriesOptions(nextConfig));
        }
        window.secondarySeries.setData(nextConfig.secondaryLineData);
      }
      function removeDottedAreaOverlay() {
        var overlays = container.querySelectorAll('.ok-lightweight-dotted-area-overlay');
        overlays.forEach(function(node) { node.remove(); });
      }
      function syncDottedArea(nextConfig) {
        removeDottedAreaOverlay();
        if (!nextConfig.showDottedArea || !window.series) return;
        var data = Array.isArray(nextConfig.data) ? nextConfig.data : [];
        if (data.length < 2) return;
        var rect = container.getBoundingClientRect();
        var width = rect.width;
        var height = rect.height;
        if (width <= 0 || height <= 0) return;
        var points = data.map(function(point) {
          var x = chart.timeScale().timeToCoordinate(point.time);
          var y = window.series.priceToCoordinate(point.value);
          if (typeof x !== 'number' || typeof y !== 'number') return null;
          return { x: x, y: y };
        }).filter(Boolean);
        if (points.length < 2) return;
        var areaBottom = Math.max.apply(
          null,
          points.map(function(point) { return point.y; }).concat([height - 28])
        );
        var safeAreaBottom = Math.min(height, areaBottom);
        var firstPoint = points[0];
        var lastPoint = points[points.length - 1];
        var pathData = [
          'M ' + firstPoint.x.toFixed(2) + ' ' + safeAreaBottom.toFixed(2)
        ].concat(
          points.map(function(point) {
            return 'L ' + point.x.toFixed(2) + ' ' + point.y.toFixed(2);
          })
        ).concat([
          'L ' + lastPoint.x.toFixed(2) + ' ' + safeAreaBottom.toFixed(2),
          'Z'
        ]).join(' ');
        var svgNS = 'http://www.w3.org/2000/svg';
        var patternId = 'ok-dotted-area-' + Math.random().toString(36).slice(2);
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'ok-lightweight-dotted-area-overlay');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        Array.prototype.forEach.call(container.children, function(child) {
          if (!child.classList.contains('ok-lightweight-dotted-area-overlay')) {
            child.style.position = 'relative';
            child.style.zIndex = '2';
          }
        });
        var defs = document.createElementNS(svgNS, 'defs');
        var pattern = document.createElementNS(svgNS, 'pattern');
        pattern.setAttribute('id', patternId);
        pattern.setAttribute('width', '8');
        pattern.setAttribute('height', '8');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        var circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', '1');
        circle.setAttribute('cy', '1');
        circle.setAttribute('r', '1');
        circle.setAttribute(
          'fill',
          nextConfig.dottedAreaColor || nextConfig.theme.lineColor
        );
        circle.setAttribute('opacity', String(nextConfig.dottedAreaOpacity ?? 0.42));
        pattern.appendChild(circle);
        defs.appendChild(pattern);
        svg.appendChild(defs);
        var path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'url(#' + patternId + ')');
        path.setAttribute('stroke', 'none');
        svg.appendChild(path);
        container.appendChild(svg);
      }

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
        requestAnimationFrame(function() {
          syncDottedArea(nextConfig);
        });
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
        if (param.time && param.seriesPrices?.size > 0 && param.point && primarySeries) {
          _lastDataTime = Date.now();
          const rawSecondary = extraSeries ? param.seriesPrices.get(extraSeries) : undefined;
          message = {
            type: 'hover',
            time: String(param.time),
            price: String(param.seriesPrices.get(primarySeries)),
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
