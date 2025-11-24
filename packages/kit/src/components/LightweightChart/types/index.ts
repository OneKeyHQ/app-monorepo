import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

export interface ILightweightChartTheme {
  bgColor: string;
  textColor: string;
  textSubduedColor: string;
  lineColor: string;
  topColor: string;
  bottomColor: string;
}

export interface ILightweightChartData {
  time: number;
  value: number;
}

export interface ILightweightChartConfig {
  theme: ILightweightChartTheme;
  data: ILightweightChartData[];
}

export interface ILightweightChartProps {
  data: IMarketTokenChart;
  height: number;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  onHover?: (data: {
    time?: number;
    price?: number;
    x?: number;
    y?: number;
  }) => void;
}

export interface IChartMessage {
  type: 'ready' | 'hover';
  time?: string;
  price?: string;
  x?: number;
  y?: number;
}
