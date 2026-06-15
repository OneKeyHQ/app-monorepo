import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import type {
  BaselineSeriesPartialOptions,
  LineData,
  SingleValueData,
  UTCTimestamp,
} from 'lightweight-charts';

export type ILightweightChartPriceFormatterType = 'usd' | 'percent' | 'number';

export interface ILightweightChartPatternFill {
  type: 'dots';
  color?: string;
  opacity?: number;
  radius?: number;
  spacing?: number;
}

export interface ILightweightChartTheme {
  bgColor: string;
  textColor: string;
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
  horzLineColor?: string;
  horzLineStyle?: number;
  priceFormatter?: (price: number) => string;
  /** Serializable formatter type for WebView (native). */
  priceFormatterType?: ILightweightChartPriceFormatterType;
  /** Optional serializable tick filter for native WebView formatter. */
  priceFormatterTickStep?: number;
  fontSize?: number;
  seriesType?: 'area' | 'baseline' | 'dotted-area';
  baselineOptions?: BaselineSeriesPartialOptions;
  showLastValue?: boolean;
  showTimeScale?: boolean;
  patternFill?: ILightweightChartPatternFill;
  showLastPointMarker?: boolean;
  lastPointMarkerColor?: string;
  lastPointMarkerRadius?: number;
}

export interface ILightweightChartProps {
  data: IMarketTokenChart;
  height: number;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  textColor?: string;
  textSubduedColor?: string;
  secondaryLineData?: IMarketTokenChart;
  secondaryLineColor?: string;
  secondaryLineWidth?: number;
  lineWidth?: number;
  showPriceScale?: boolean;
  showHorzGridLines?: boolean;
  priceScaleMargins?: { top: number; bottom: number };
  priceFormatter?: (price: number) => string;
  priceFormatterType?: ILightweightChartPriceFormatterType;
  priceFormatterTickStep?: number;
  fontSize?: number;
  seriesType?: 'area' | 'baseline' | 'dotted-area';
  baselineOptions?: BaselineSeriesPartialOptions;
  showLastValue?: boolean;
  showTimeScale?: boolean;
  patternFill?: ILightweightChartPatternFill;
  showLastPointMarker?: boolean;
  lastPointMarkerColor?: string;
  lastPointMarkerRadius?: number;
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
