import { useMemo } from 'react';

import { useTheme } from '@tamagui/core';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { DEFAULT_CHART_COLORS } from '../utils/constants';
import {
  resolveSerializablePriceFormatterTickStep,
  resolveSerializablePriceFormatterType,
} from '../utils/priceFormatterType';

import type {
  ILightweightChartConfig,
  ILightweightChartLineType,
  ILightweightChartPriceScalePosition,
  ILightweightChartTime,
} from '../types';
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
  priceScalePosition?: ILightweightChartPriceScalePosition;
  priceScaleMargins?: { top: number; bottom: number };
  priceScaleEntireTextOnly?: boolean;
  crosshairVertLineColor?: string;
  crosshairVertLineStyle?: number;
  patternColor?: string;
  pulseLastPointColor?: string;
  priceFormatter?: (price: number) => string;
  priceFormatterPrecision?: number;
  priceFormatterTickStep?: number;
  fontSize?: number;
  seriesType?: 'area' | 'baseline' | 'dotted-area';
  lineType?: ILightweightChartLineType;
  baselineOptions?: BaselineSeriesPartialOptions;
  showLastValue?: boolean;
  showLastPointMarker?: boolean;
  showTimeScale?: boolean;
  useTimeScaleTickMarkWithoutUnit?: boolean;
  timeZone?: string;
  locale?: string;
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
  priceScalePosition = 'right',
  priceScaleMargins,
  priceScaleEntireTextOnly,
  crosshairVertLineColor,
  crosshairVertLineStyle,
  patternColor,
  pulseLastPointColor,
  priceFormatter,
  priceFormatterPrecision,
  priceFormatterTickStep: priceFormatterTickStepProp,
  fontSize,
  seriesType,
  lineType,
  baselineOptions,
  showLastValue,
  showLastPointMarker,
  showTimeScale = true,
  useTimeScaleTickMarkWithoutUnit,
  timeZone,
  locale,
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

  // Mapped once per source array so that replacing only one of them (charts
  // that re-cut their overlay on every crosshair step) leaves the other one
  // referentially stable, and the consumer can tell the two updates apart.
  const chartData = useMemo(
    () =>
      data.map(([time, value]: [number, number]) => ({
        time: time as ILightweightChartTime,
        value,
      })),
    [data],
  );
  const chartSecondaryLineData = useMemo(
    () =>
      secondaryLineData?.map(([time, value]: [number, number]) => ({
        time: time as ILightweightChartTime,
        value,
      })),
    [secondaryLineData],
  );

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
      priceScalePosition,
      priceScaleMargins,
      priceScaleEntireTextOnly,
      horzLineColor: theme.borderSubdued?.val || '#E5E5EA',
      horzLineStyle: 2,
      crosshairVertLineColor,
      crosshairVertLineStyle,
      patternColor,
      pulseLastPointColor,
      data: chartData,
      secondaryLineData: chartSecondaryLineData,
      secondaryLineColor,
      secondaryLineWidth,
      priceFormatter,
      priceFormatterType,
      priceFormatterPrecision,
      priceFormatterTickStep,
      fontSize,
      seriesType: resolvedSeriesType,
      lineType,
      baselineOptions,
      showLastValue,
      showLastPointMarker,
      showTimeScale,
      useTimeScaleTickMarkWithoutUnit,
      timeZone,
      locale,
    }),
    [
      chartData,
      chartSecondaryLineData,
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
      priceScalePosition,
      priceScaleMargins,
      priceScaleEntireTextOnly,
      crosshairVertLineColor,
      crosshairVertLineStyle,
      patternColor,
      pulseLastPointColor,
      priceFormatter,
      priceFormatterType,
      priceFormatterPrecision,
      priceFormatterTickStep,
      fontSize,
      resolvedSeriesType,
      lineType,
      baselineOptions,
      showLastValue,
      showLastPointMarker,
      showTimeScale,
      useTimeScaleTickMarkWithoutUnit,
      timeZone,
      locale,
    ],
  );
}
