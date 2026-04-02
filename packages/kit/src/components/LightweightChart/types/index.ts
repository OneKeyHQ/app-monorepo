import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import type {
  BaselineSeriesPartialOptions,
  LineData,
  SingleValueData,
  UTCTimestamp,
} from 'lightweight-charts';

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
  /** Serializable formatter type for WebView (native) — 'usd' or 'percent' */
  priceFormatterType?: 'usd' | 'percent';
  fontSize?: number;
  seriesType?: 'area' | 'baseline';
  baselineOptions?: BaselineSeriesPartialOptions;
  showLastValue?: boolean;
}

export interface ILightweightChartProps {
  data: IMarketTokenChart;
  height: number;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  secondaryLineData?: IMarketTokenChart;
  secondaryLineColor?: string;
  secondaryLineWidth?: number;
  lineWidth?: number;
  showPriceScale?: boolean;
  showHorzGridLines?: boolean;
  priceScaleMargins?: { top: number; bottom: number };
  priceFormatter?: (price: number) => string;
  fontSize?: number;
  seriesType?: 'area' | 'baseline';
  baselineOptions?: BaselineSeriesPartialOptions;
  showLastValue?: boolean;
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
