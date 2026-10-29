import { createLastValueSeriesOptions } from './chartOptions';
import { buildMonotoneCurveSegments } from './monotoneCurve';

import type { ILightweightChartTheme } from '../types';
import type {
  CustomData,
  CustomSeriesOptions,
  CustomSeriesWhitespaceData,
  ICustomSeriesPaneRenderer,
  ICustomSeriesPaneView,
  PaneRendererCustomData,
  SeriesPartialOptions,
  Time,
} from 'lightweight-charts';

const DOTTED_AREA_BASE_OPTIONS: CustomSeriesOptions = {
  title: '',
  color: '#8D8FE8',
  visible: true,
  hitTestTolerance: 3,
  lastValueVisible: true,
  priceLineVisible: true,
  priceLineSource: 0,
  priceLineWidth: 1,
  priceLineColor: '',
  priceLineStyle: 2,
  baseLineVisible: true,
  baseLineWidth: 1,
  baseLineColor: '#B2B5BE',
  baseLineStyle: 0,
  priceFormat: {
    type: 'price',
    precision: 2,
    minMove: 0.01,
  },
};

export interface IDottedAreaData extends CustomData {
  value: number;
}

export interface IDottedAreaSeriesOptions extends CustomSeriesOptions {
  lineColor: string;
  lineWidth: number;
  patternColor: string;
  patternOpacity: number;
  patternRadius: number;
  patternSpacing: number;
  // False draws the line alone, for an overlay laid over another series.
  showPattern: boolean;
  curved: boolean;
  showLastPointMarker: boolean;
  lastPointMarkerColor: string;
  lastPointMarkerRadius: number;
}

function getDefaultDottedAreaSeriesOptions(): IDottedAreaSeriesOptions {
  return {
    ...DOTTED_AREA_BASE_OPTIONS,
    color: '#8D8FE8',
    lineColor: '#8D8FE8',
    lineWidth: 3,
    patternColor: '#8D8FE8',
    patternOpacity: 0.28,
    patternRadius: 0.9,
    patternSpacing: 10,
    showPattern: true,
    curved: false,
    showLastPointMarker: true,
    lastPointMarkerColor: '#8D8FE8',
    lastPointMarkerRadius: 5.5,
  };
}

function getNormalizedLineWidth(lineWidth = 3) {
  return Math.min(4, Math.max(1, Math.round(lineWidth)));
}

// Continues the current path from `points[0]` through the rest of the points.
function tracePoints(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  curved: boolean,
) {
  if (curved) {
    buildMonotoneCurveSegments(points).forEach((segment) => {
      ctx.bezierCurveTo(
        segment.cp1x,
        segment.cp1y,
        segment.cp2x,
        segment.cp2y,
        segment.x,
        segment.y,
      );
    });
    return;
  }
  points.slice(1).forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });
}

class DottedAreaPaneRenderer implements ICustomSeriesPaneRenderer {
  private data: PaneRendererCustomData<Time, IDottedAreaData> | null = null;

  private options = getDefaultDottedAreaSeriesOptions();

  update(
    data: PaneRendererCustomData<Time, IDottedAreaData>,
    options: IDottedAreaSeriesOptions,
  ) {
    this.data = data;
    this.options = options;
  }

  draw: ICustomSeriesPaneRenderer['draw'] = (target, priceConverter) => {
    if (
      !this.data?.bars.length ||
      !this.data.visibleRange ||
      this.data.visibleRange.from >= this.data.visibleRange.to
    ) {
      return;
    }

    const options = this.options;
    const { bars, visibleRange, barSpacing } = this.data;
    const from = Math.max(0, visibleRange.from - 1);
    const to = Math.min(bars.length, visibleRange.to + 1);
    const anchor = bars[visibleRange.from];

    target.useBitmapCoordinateSpace((scope) => {
      const { context: ctx } = scope;
      const horizontalRatio = scope.horizontalPixelRatio;
      const verticalRatio = scope.verticalPixelRatio;
      const radius =
        Math.max(0.1, options.patternRadius) *
        Math.min(horizontalRatio, verticalRatio);
      const xSpacing = Math.max(1, options.patternSpacing) * horizontalRatio;
      const ySpacing = Math.max(1, options.patternSpacing) * verticalRatio;
      const bottom = scope.bitmapSize.height;

      const points = bars
        .slice(from, to)
        .map((bar, index) => {
          const y = priceConverter(bar.originalData.value);
          if (y === null) {
            return undefined;
          }
          // Neighboring bars extend the line to the pane edges, but their x
          // coordinates are stale. Rebuild them from a visible logical index.
          const barIndex = from + index;
          const x =
            barIndex < visibleRange.from || barIndex >= visibleRange.to
              ? anchor.x + (bar.time - anchor.time) * barSpacing
              : bar.x;
          return {
            x: x * horizontalRatio,
            y: y * verticalRatio,
          };
        })
        .filter(
          (point): point is { x: number; y: number } =>
            !!point && Number.isFinite(point.x) && Number.isFinite(point.y),
        );

      if (points.length === 0) {
        return;
      }

      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];
      const minX = Math.max(0, Math.min(...points.map((point) => point.x)));
      const maxX = Math.min(
        scope.bitmapSize.width,
        Math.max(...points.map((point) => point.x)),
      );
      const minY = Math.max(0, Math.min(...points.map((point) => point.y)));

      if (options.showPattern && points.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(firstPoint.x, bottom);
        ctx.lineTo(firstPoint.x, firstPoint.y);
        tracePoints(ctx, points, options.curved);
        ctx.lineTo(lastPoint.x, bottom);
        ctx.closePath();
        ctx.clip();

        ctx.globalAlpha = Math.max(0, Math.min(1, options.patternOpacity));
        ctx.fillStyle = options.patternColor;
        const startX = Math.floor(minX / xSpacing) * xSpacing + xSpacing / 2;
        const startY = Math.floor(minY / ySpacing) * ySpacing + ySpacing / 2;

        for (let x = startX; x <= maxX + xSpacing; x += xSpacing) {
          for (let y = startY; y <= bottom + ySpacing; y += ySpacing) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = options.lineColor;
      ctx.lineWidth = getNormalizedLineWidth(options.lineWidth) * verticalRatio;
      ctx.beginPath();
      ctx.moveTo(firstPoint.x, firstPoint.y);
      tracePoints(ctx, points, options.curved);
      ctx.stroke();
      ctx.restore();

      if (options.showLastPointMarker && visibleRange.to === bars.length) {
        ctx.save();
        ctx.fillStyle = options.lastPointMarkerColor;
        ctx.beginPath();
        ctx.arc(
          lastPoint.x,
          lastPoint.y,
          Math.max(1, options.lastPointMarkerRadius) *
            Math.min(horizontalRatio, verticalRatio),
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
      }
    });
  };
}

export function createDottedAreaSeriesPaneView(): ICustomSeriesPaneView<
  Time,
  IDottedAreaData,
  IDottedAreaSeriesOptions
> {
  const rendererInstance = new DottedAreaPaneRenderer();
  return {
    renderer: () => rendererInstance,
    update: (
      data: PaneRendererCustomData<Time, IDottedAreaData>,
      seriesOptions: IDottedAreaSeriesOptions,
    ) => {
      rendererInstance.update(data, seriesOptions);
    },
    priceValueBuilder: (plotRow: IDottedAreaData) => [plotRow.value],
    isWhitespace: (
      data: IDottedAreaData | CustomSeriesWhitespaceData<Time>,
    ): data is CustomSeriesWhitespaceData<Time> =>
      !('value' in data) || !Number.isFinite(data.value),
    defaultOptions: () => getDefaultDottedAreaSeriesOptions(),
  };
}

export function createDottedAreaSeriesOptions({
  theme,
  lineWidth,
  showLastValue,
  showLastValuePriceLine,
  lastValueLabelColor,
  showLastPointMarker,
  // Keeps the dot pattern (and the last-point marker, which reads as part of
  // the same fill) on their own color when the line is tinted differently.
  // Falls back to the line color, so callers that omit it are unaffected.
  patternColor,
  priceFormatter,
  curved,
}: {
  theme: ILightweightChartTheme;
  lineWidth?: number;
  showLastValue?: boolean;
  showLastValuePriceLine?: boolean;
  lastValueLabelColor?: string;
  showLastPointMarker?: boolean;
  patternColor?: string;
  priceFormatter?: (price: number) => string;
  curved?: boolean;
}): SeriesPartialOptions<IDottedAreaSeriesOptions> {
  const resolvedPatternColor = patternColor ?? theme.lineColor;
  return {
    color: theme.lineColor,
    lineColor: theme.lineColor,
    lineWidth: getNormalizedLineWidth(lineWidth),
    patternColor: resolvedPatternColor,
    patternOpacity: 0.28,
    patternRadius: 0.9,
    patternSpacing: 10,
    curved: curved ?? false,
    showLastPointMarker: showLastPointMarker ?? true,
    lastPointMarkerColor: resolvedPatternColor,
    lastPointMarkerRadius: 5.5,
    ...createLastValueSeriesOptions({
      showLastValue,
      showLastValuePriceLine,
      lastValueLabelColor,
    }),
    priceFormat: {
      type: 'custom',
      formatter: priceFormatter ?? ((price: number) => `${price.toFixed(2)}%`),
    },
  };
}
