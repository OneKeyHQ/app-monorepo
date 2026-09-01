import type {
  ILightweightChartHistogramOptions,
  ILightweightChartTheme,
} from '../types';
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

const HISTOGRAM_BASE_OPTIONS: CustomSeriesOptions = {
  title: '',
  color: '#22AB15',
  visible: true,
  hitTestTolerance: 4,
  lastValueVisible: false,
  priceLineVisible: false,
  priceLineSource: 0,
  priceLineWidth: 1,
  priceLineColor: '',
  priceLineStyle: 2,
  baseLineVisible: false,
  baseLineWidth: 1,
  baseLineColor: '#B2B5BE',
  baseLineStyle: 0,
  priceFormat: {
    type: 'price',
    precision: 2,
    minMove: 0.01,
  },
};

export interface IHistogramData extends CustomData {
  value: number;
}

export interface IHistogramSeriesOptions extends CustomSeriesOptions {
  base: number;
  barWidthRatio: number;
  maxBarWidth: number;
}

function getDefaultHistogramSeriesOptions(): IHistogramSeriesOptions {
  return {
    ...HISTOGRAM_BASE_OPTIONS,
    base: 0,
    barWidthRatio: 0.52,
    maxBarWidth: 24,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

class HistogramPaneRenderer implements ICustomSeriesPaneRenderer {
  private data: PaneRendererCustomData<Time, IHistogramData> | null = null;

  private options = getDefaultHistogramSeriesOptions();

  update(
    data: PaneRendererCustomData<Time, IHistogramData>,
    options: IHistogramSeriesOptions,
  ) {
    this.data = data;
    this.options = options;
  }

  draw: ICustomSeriesPaneRenderer['draw'] = (target, priceConverter) => {
    if (!this.data?.bars.length) return;

    const baseY = priceConverter(this.options.base);
    if (baseY === null) return;

    const barSpacing =
      this.data.barSpacing * Math.max(1, this.data.conflationFactor);
    const barWidthRatio = clamp(this.options.barWidthRatio, 0.1, 1);
    const maxBarWidth = Math.max(1, this.options.maxBarWidth);

    target.useBitmapCoordinateSpace((scope) => {
      const { context: ctx } = scope;
      const horizontalRatio = scope.horizontalPixelRatio;
      const verticalRatio = scope.verticalPixelRatio;
      // Keep sparse periods readable without letting a column fill its entire
      // time slot, which is the built-in histogram renderer's default.
      const barWidth = Math.max(
        1,
        Math.round(
          Math.min(maxBarWidth, barSpacing * barWidthRatio) * horizontalRatio,
        ),
      );
      const baseYInPixels = baseY * verticalRatio;

      this.data?.bars.forEach((bar) => {
        const value = bar.originalData.value;
        // Exact-zero buckets preserve time spacing but should not leave a row
        // of colored one-pixel marks along the reference line.
        if (!Number.isFinite(value) || value === this.options.base) return;

        const valueY = priceConverter(value);
        if (valueY === null) return;

        const valueYInPixels = valueY * verticalRatio;
        const top = Math.min(valueYInPixels, baseYInPixels);
        const bottom = Math.max(valueYInPixels, baseYInPixels);

        const centerX = bar.x * horizontalRatio;
        const left = Math.round(centerX - barWidth / 2);
        const topPixel = Math.round(top);
        const bottomPixel = Math.round(bottom);

        ctx.fillStyle = bar.barColor ?? this.options.color;
        ctx.fillRect(
          left,
          topPixel,
          barWidth,
          Math.max(1, bottomPixel - topPixel),
        );
      });
    });
  };
}

export function createHistogramSeriesPaneView(): ICustomSeriesPaneView<
  Time,
  IHistogramData,
  IHistogramSeriesOptions
> {
  const rendererInstance = new HistogramPaneRenderer();
  let currentBase = 0;
  return {
    renderer: () => rendererInstance,
    update: (
      data: PaneRendererCustomData<Time, IHistogramData>,
      seriesOptions: IHistogramSeriesOptions,
    ) => {
      currentBase = seriesOptions.base;
      rendererInstance.update(data, seriesOptions);
    },
    priceValueBuilder: (plotRow: IHistogramData) => [
      currentBase,
      plotRow.value,
      plotRow.value,
    ],
    isWhitespace: (
      data: IHistogramData | CustomSeriesWhitespaceData<Time>,
    ): data is CustomSeriesWhitespaceData<Time> =>
      !('value' in data) || !Number.isFinite(data.value),
    defaultOptions: () => getDefaultHistogramSeriesOptions(),
  };
}

export function createHistogramSeriesOptions({
  theme,
  histogramOptions,
  showLastValue,
  priceFormatter,
}: {
  theme: ILightweightChartTheme;
  histogramOptions?: ILightweightChartHistogramOptions;
  showLastValue?: boolean;
  priceFormatter?: (price: number) => string;
}): SeriesPartialOptions<IHistogramSeriesOptions> {
  return {
    color: histogramOptions?.positiveColor ?? theme.lineColor,
    base: histogramOptions?.base ?? 0,
    barWidthRatio: histogramOptions?.barWidthRatio ?? 0.52,
    maxBarWidth: histogramOptions?.maxBarWidth ?? 24,
    lastValueVisible: !!showLastValue,
    priceLineVisible: !!showLastValue,
    priceFormat: {
      type: 'custom',
      formatter: priceFormatter ?? ((price: number) => `$${price.toFixed(2)}`),
    },
  };
}
