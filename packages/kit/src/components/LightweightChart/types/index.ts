import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import type {
  BaselineSeriesPartialOptions,
  LineData,
  SingleValueData,
  UTCTimestamp,
} from 'lightweight-charts';

export type ILightweightChartPriceFormatterType = 'usd' | 'percent' | 'number';

export interface ILightweightChartTheme {
  bgColor: string;
  textSubduedColor: string;
  lineColor: string;
  topColor: string;
  bottomColor: string;
}

export type ILightweightChartData = SingleValueData;
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
  priceScaleMargins?: { top: number; bottom: number };
  priceScaleEntireTextOnly?: boolean;
  horzLineColor?: string;
  horzLineStyle?: number;
  priceFormatter?: (price: number) => string;
  priceFormatterType?: ILightweightChartPriceFormatterType;
  priceFormatterTickStep?: number;
  fontSize?: number;
  seriesType?: 'area' | 'baseline' | 'dotted-area';
  baselineOptions?: BaselineSeriesPartialOptions;
  showLastValue?: boolean;
  showLastPointMarker?: boolean;
  showTimeScale?: boolean;
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
  priceScaleMargins?: { top: number; bottom: number };
  priceScaleEntireTextOnly?: boolean;
  priceFormatter?: (price: number) => string;
  priceFormatterTickStep?: number;
  fontSize?: number;
  seriesType?: 'area' | 'baseline' | 'dotted-area';
  baselineOptions?: BaselineSeriesPartialOptions;
  showLastValue?: boolean;
  showLastPointMarker?: boolean;
  showTimeScale?: boolean;
  // When true, overlays an animated "breathing" dot on the last data point to
  // signal the chart is live. Web/desktop only; toggling it does not recreate
  // the chart.
  pulseLastPoint?: boolean;
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
