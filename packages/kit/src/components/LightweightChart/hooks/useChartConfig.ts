import { useMemo } from 'react';

import { useTheme } from '@tamagui/core';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { DEFAULT_CHART_COLORS } from '../utils/constants';

import type {
  ILightweightChartConfig,
  ILightweightChartPatternFill,
  ILightweightChartPriceFormatterType,
  ILightweightChartTime,
} from '../types';
import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

interface IUseChartConfigProps {
  data: IMarketTokenChart;
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
}

export function useChartConfig({
  data,
  lineColor = DEFAULT_CHART_COLORS.lineColor,
  topColor = DEFAULT_CHART_COLORS.topColor,
  bottomColor = DEFAULT_CHART_COLORS.bottomColor,
  textColor,
  textSubduedColor,
  secondaryLineData,
  secondaryLineColor,
  secondaryLineWidth,
  lineWidth = 3,
  showPriceScale = false,
  showHorzGridLines = false,
  priceScaleMargins,
  priceFormatter,
  priceFormatterType,
  priceFormatterTickStep,
  fontSize,
  seriesType,
  baselineOptions,
  showLastValue,
  showTimeScale = true,
  patternFill,
  showLastPointMarker,
  lastPointMarkerColor,
  lastPointMarkerRadius,
}: IUseChartConfigProps): ILightweightChartConfig {
  const theme = useTheme();

  return useMemo(
    () => ({
      theme: {
        bgColor: 'transparent',
        textColor: textColor ?? theme.text?.val ?? '#000000',
        textSubduedColor:
          textSubduedColor ?? theme.textSubdued?.val ?? '#666666',
        lineColor,
        topColor,
        bottomColor,
      },
      lineWidth,
      showPriceScale,
      showHorzGridLines,
      priceScaleMargins,
      horzLineColor: theme.borderSubdued?.val || '#E5E5EA',
      horzLineStyle: 2,
      data: data.map(([time, value]: [number, number]) => ({
        time: time as ILightweightChartTime,
        value,
      })),
      secondaryLineData: secondaryLineData?.map(
        ([time, value]: [number, number]) => ({
          time: time as ILightweightChartTime,
          value,
        }),
      ),
      secondaryLineColor,
      secondaryLineWidth,
      priceFormatter,
      priceFormatterType:
        priceFormatterType ?? (priceFormatter ? 'usd' : 'percent'),
      priceFormatterTickStep,
      fontSize,
      seriesType,
      baselineOptions,
      showLastValue,
      showTimeScale,
      patternFill,
      showLastPointMarker,
      lastPointMarkerColor,
      lastPointMarkerRadius,
    }),
    [
      data,
      secondaryLineData,
      theme.text?.val,
      theme.textSubdued?.val,
      theme.borderSubdued?.val,
      lineColor,
      topColor,
      bottomColor,
      textColor,
      textSubduedColor,
      secondaryLineColor,
      secondaryLineWidth,
      lineWidth,
      showPriceScale,
      showHorzGridLines,
      priceScaleMargins,
      priceFormatter,
      priceFormatterType,
      priceFormatterTickStep,
      fontSize,
      seriesType,
      baselineOptions,
      showLastValue,
      showTimeScale,
      patternFill,
      showLastPointMarker,
      lastPointMarkerColor,
      lastPointMarkerRadius,
    ],
  );
}
