import { customSeriesDefaultOptions } from 'lightweight-charts';

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
  showLastPointMarker: boolean;
  lastPointMarkerColor: string;
  lastPointMarkerRadius: number;
}

function getDefaultDottedAreaSeriesOptions(): IDottedAreaSeriesOptions {
  return {
    ...customSeriesDefaultOptions,
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
  };
}

function getNormalizedLineWidth(lineWidth = 3) {
  return Math.min(4, Math.max(1, Math.round(lineWidth)));
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
    if (!this.data?.bars.length) {
      return;
    }

    const options = this.options;
    const bars = this.data.bars;

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
        .map((bar) => {
          const y = priceConverter(bar.originalData.value);
          if (y === null) {
            return undefined;
          }
          return {
            x: bar.x * horizontalRatio,
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
      const minX = Math.min(...points.map((point) => point.x));
      const maxX = Math.max(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y));

      if (points.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(firstPoint.x, bottom);
        points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
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
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
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
  showLastPointMarker,
  priceFormatter,
}: {
  theme: ILightweightChartTheme;
  lineWidth?: number;
  showLastValue?: boolean;
  showLastPointMarker?: boolean;
  priceFormatter?: (price: number) => string;
}): SeriesPartialOptions<IDottedAreaSeriesOptions> {
  return {
    color: theme.lineColor,
    lineColor: theme.lineColor,
    lineWidth: getNormalizedLineWidth(lineWidth),
    patternColor: theme.lineColor,
    patternOpacity: 0.28,
    patternRadius: 0.9,
    patternSpacing: 10,
    showLastPointMarker: showLastPointMarker ?? true,
    lastPointMarkerColor: theme.lineColor,
    lastPointMarkerRadius: 5.5,
    lastValueVisible: !!showLastValue,
    priceLineVisible: !!showLastValue,
    priceFormat: {
      type: 'custom',
      formatter: priceFormatter ?? ((price: number) => `${price.toFixed(2)}%`),
    },
  };
}
