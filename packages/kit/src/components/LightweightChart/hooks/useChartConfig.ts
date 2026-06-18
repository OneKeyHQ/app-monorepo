import { useMemo } from 'react';

import { useTheme } from '@tamagui/core';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { DEFAULT_CHART_COLORS } from '../utils/constants';
import {
  resolveSerializablePriceFormatterTickStep,
  resolveSerializablePriceFormatterType,
} from '../utils/priceFormatterType';

import type { ILightweightChartConfig, ILightweightChartTime } from '../types';
import type { BaselineSeriesPartialOptions } from 'lightweight-charts';

interface IUseChartConfigProps {
  data: IMarketTokenChart;
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
  priceFormatter?: (price: number) => string;
  priceFormatterTickStep?: number;
  fontSize?: number;
  seriesType?: 'area' | 'baseline' | 'dotted-area';
  baselineOptions?: BaselineSeriesPartialOptions;
  showLastValue?: boolean;
  showLastPointMarker?: boolean;
  showTimeScale?: boolean;
}

export function useChartConfig({
  data,
  lineColor = DEFAULT_CHART_COLORS.lineColor,
  topColor = DEFAULT_CHART_COLORS.topColor,
  bottomColor = DEFAULT_CHART_COLORS.bottomColor,
  textSubduedColor,
  secondaryLineData,
  secondaryLineColor,
  secondaryLineWidth,
  lineWidth = 3,
  showPriceScale = false,
  showHorzGridLines = false,
  priceScaleMargins,
  priceFormatter,
  priceFormatterTickStep: priceFormatterTickStepProp,
  fontSize,
  seriesType,
  baselineOptions,
  showLastValue,
  showLastPointMarker,
  showTimeScale = true,
}: IUseChartConfigProps): ILightweightChartConfig {
  const theme = useTheme();
  const resolvedSeriesType = seriesType ?? 'area';
  const priceFormatterType = resolveSerializablePriceFormatterType({
    seriesType: resolvedSeriesType,
    priceFormatter,
  });
  const priceFormatterTickStep = resolveSerializablePriceFormatterTickStep({
    seriesType: resolvedSeriesType,
    priceFormatterTickStep: priceFormatterTickStepProp,
  });

  return useMemo(
    () => ({
      theme: {
        bgColor: 'transparent',
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
      priceFormatterType,
      priceFormatterTickStep,
      fontSize,
      seriesType: resolvedSeriesType,
      baselineOptions,
      showLastValue,
      showLastPointMarker,
      showTimeScale,
    }),
    [
      data,
      secondaryLineData,
      theme.textSubdued?.val,
      theme.borderSubdued?.val,
      lineColor,
      topColor,
      bottomColor,
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
      resolvedSeriesType,
      baselineOptions,
      showLastValue,
      showLastPointMarker,
      showTimeScale,
    ],
  );
}
