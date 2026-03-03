import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import type {
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
  horzLineColor?: string;
  horzLineStyle?: number;
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
