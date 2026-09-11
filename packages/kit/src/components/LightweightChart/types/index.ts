import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import type {
  BaselineSeriesPartialOptions,
  LineData,
  SingleValueData,
  UTCTimestamp,
} from 'lightweight-charts';

export type ILightweightChartPriceFormatterType = 'usd' | 'percent' | 'number';
export type ILightweightChartLineType = 'simple' | 'steps';
export type ILightweightChartPriceScalePosition = 'left' | 'right';
export type ILightweightChartSeriesType =
  | 'area'
  | 'baseline'
  | 'dotted-area'
  | 'histogram';
export type ILightweightChartReferenceLineStyle =
  | 'solid'
  | 'dotted'
  | 'dashed'
  | 'large-dashed'
  | 'sparse-dotted';

export interface ILightweightChartReferenceLine {
  price: number;
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
  lineStyle?: ILightweightChartReferenceLineStyle;
  axisLabelVisible?: boolean;
  // Drawn on the plot beside the axis label, on the line's own color. Only
  // shown together with `axisLabelVisible`.
  title?: string;
  // Axis label colors. Default to the line color with a contrasting text.
  axisLabelColor?: string;
  axisLabelTextColor?: string;
  // Extends the price autoscale so the line stays on screen even when the
  // series never reaches it (e.g. a gap open away from the previous close).
  includeInAutoscale?: boolean;
}

export interface ILightweightChartHistogramOptions {
  positiveColor: string;
  negativeColor: string;
  base?: number;
  barWidthRatio?: number;
  maxBarWidth?: number;
}

export interface ILightweightChartTheme {
  bgColor: string;
  textSubduedColor: string;
  lineColor: string;
  topColor: string;
  bottomColor: string;
}

export type ILightweightChartData = SingleValueData & { color?: string };
export type ILightweightSecondaryLineData = LineData;
export type ILightweightChartTime = UTCTimestamp;

export interface ILightweightChartConfig {
  theme: ILightweightChartTheme;
  data: ILightweightChartData[];
  secondaryLineData?: ILightweightSecondaryLineData[];
  secondaryLineColor?: string;
  secondaryLineWidth?: number;
  lineWidth: number;
  showPriceScale?: boolean;
  showHorzGridLines?: boolean;
  priceScalePosition?: ILightweightChartPriceScalePosition;
  priceScaleMargins?: { top: number; bottom: number };
  priceScaleEntireTextOnly?: boolean;
  horzLineColor?: string;
  horzLineStyle?: number;
  crosshairVertLineColor?: string;
  crosshairVertLineStyle?: number;
  patternColor?: string;
  pulseLastPointColor?: string;
  priceFormatter?: (price: number) => string;
  priceFormatterType?: ILightweightChartPriceFormatterType;
  priceFormatterPrecision?: number;
  priceFormatterTickStep?: number;
  fontSize?: number;
  seriesType?: ILightweightChartSeriesType;
  lineType?: ILightweightChartLineType;
  baselineOptions?: BaselineSeriesPartialOptions;
  histogramOptions?: ILightweightChartHistogramOptions;
  referenceLine?: ILightweightChartReferenceLine;
  showLastValue?: boolean;
  showLastValuePriceLine?: boolean;
  lastValueLabelColor?: string;
  showLastPointMarker?: boolean;
  showTimeScale?: boolean;
  useTimeScaleTickMarkWithoutUnit?: boolean;
  timeScaleRightOffsetPixels?: number;
  timeZone?: string;
  locale?: string;
  hideCrosshairPriceLabel?: boolean;
}

export interface ILightweightChartProps {
  data: IMarketTokenChart;
  height: number;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  textSubduedColor?: string;
  secondaryLineData?: IMarketTokenChart;
  secondaryLineColor?: string;
  secondaryLineWidth?: number;
  lineWidth?: number;
  showPriceScale?: boolean;
  showHorzGridLines?: boolean;
  horzLineColor?: string;
  horzLineStyle?: number;
  priceScalePosition?: ILightweightChartPriceScalePosition;
  priceScaleMargins?: { top: number; bottom: number };
  priceScaleEntireTextOnly?: boolean;
  // Web/desktop only. Reserve the axis before labels are measured so the plot
  // width does not shift during the first chart paint.
  priceScaleMinimumWidth?: number;
  // Crosshair vertical line overrides. Left unset the chart keeps its default
  // faint large-dashed line, so charts that do not opt in are unaffected.
  crosshairVertLineColor?: string;
  // lightweight-charts `LineStyle`: 0 Solid, 1 Dotted, 2 Dashed,
  // 3 LargeDashed (default), 4 SparseDotted.
  crosshairVertLineStyle?: number;
  // `dotted-area` series only. Keeps the dot pattern on its own color when the
  // line itself is tinted differently (e.g. a dimmed tail). Defaults to
  // `lineColor`.
  patternColor?: string;
  // Color of the `pulseLastPoint` overlay. Defaults to `lineColor`; set it when
  // the line is dimmed but the live marker should stay at full strength.
  pulseLastPointColor?: string;
  priceFormatter?: (price: number) => string;
  // Native WebView only. Custom formatter functions cannot cross the WebView
  // boundary, so callers can opt into a serializable percent precision.
  priceFormatterPrecision?: number;
  priceFormatterTickStep?: number;
  fontSize?: number;
  seriesType?: ILightweightChartSeriesType;
  lineType?: ILightweightChartLineType;
  baselineOptions?: BaselineSeriesPartialOptions;
  histogramOptions?: ILightweightChartHistogramOptions;
  referenceLine?: ILightweightChartReferenceLine;
  showLastValue?: boolean;
  // Defaults to `showLastValue`. Pass false to keep the last-value axis label
  // while dropping the dashed price line it normally comes with.
  showLastValuePriceLine?: boolean;
  // Background of the last-value axis label (and of the price line when it is
  // shown). Defaults to the series color, so a dimmed line can still carry a
  // full-strength label.
  lastValueLabelColor?: string;
  showLastPointMarker?: boolean;
  showTimeScale?: boolean;
  useTimeScaleTickMarkWithoutUnit?: boolean;
  // Blank space between the last point and the price scale, in pixels.
  timeScaleRightOffsetPixels?: number;
  timeZone?: string;
  locale?: string;
  // Native WebView only. Keeps the default axis hover label unless a chart
  // with its own tooltip explicitly opts out.
  hideCrosshairPriceLabel?: boolean;
  // When true, overlays an animated "breathing" dot on the last data point to
  // signal the chart is live. Web/desktop only; toggling it does not recreate
  // the chart.
  pulseLastPoint?: boolean;
  // Web/desktop only. Keep the chart instance alive when only data changes,
  // then update series data in place to avoid axis/marker flicker.
  preserveChartInstanceOnDataChange?: boolean;
  onHover?: (data: {
    time?: number;
    price?: number;
    secondaryPrice?: number;
    x?: number;
    y?: number;
  }) => void;
}

export interface IChartMessage {
  type: 'ready' | 'hover';
  time?: string;
  price?: string;
  secondaryPrice?: string;
  x?: number;
  y?: number;
}
