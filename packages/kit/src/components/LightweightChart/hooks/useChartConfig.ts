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
  ILightweightChartHistogramOptions,
  ILightweightChartLineType,
  ILightweightChartPriceScalePosition,
  ILightweightChartReferenceLine,
  ILightweightChartSeriesType,
  ILightweightChartTime,
  ILightweightSecondaryLineChart,
  ILightweightSecondaryLineData,
} from '../types';
import type {
  BaselineSeriesPartialOptions,
  LineData,
} from 'lightweight-charts';

// Stroke color of a segment that only bridges a gap.
const GAP_SEGMENT_COLOR = 'transparent';

/**
 * The overlay line's series data and the points it cannot draw, for a line
 * that stops and resumes (a campaign that ran in August and again in October
 * is two runs, not one line across September).
 *
 * lightweight-charts joins the valued points on either side of a whitespace
 * point, and strokes each segment in the color of the point it starts from.
 * So a null value becomes a whitespace point (no value, no hover readout),
 * and the last point before a gap gets a transparent color: the segment
 * bridging the gap is invisible while each run keeps the series color. A
 * point with no valued neighbour, such as the first hour of a new run, then
 * has no visible segment at all and is returned separately to be drawn as a
 * dot.
 */
export function buildSecondaryLineSeries(
  points: ILightweightSecondaryLineChart | undefined,
): {
  line: ILightweightSecondaryLineData[] | undefined;
  isolatedPoints: LineData[] | undefined;
} {
  if (!points) {
    return { line: undefined, isolatedPoints: undefined };
  }
  const hasValue = (index: number) =>
    index >= 0 && index < points.length && points[index][1] !== null;
  const line: ILightweightSecondaryLineData[] = points.map(
    ([time, value], index) => {
      if (value === null) {
        return { time: time as ILightweightChartTime };
      }
      const endsBeforeGap = index + 1 < points.length && !hasValue(index + 1);
      return endsBeforeGap
        ? {
            time: time as ILightweightChartTime,
            value,
            color: GAP_SEGMENT_COLOR,
          }
        : { time: time as ILightweightChartTime, value };
    },
  );
  const isolatedPoints: LineData[] = [];
  points.forEach(([time, value], index) => {
    if (value !== null && !hasValue(index - 1) && !hasValue(index + 1)) {
      isolatedPoints.push({ time: time as ILightweightChartTime, value });
    }
  });
  return { line, isolatedPoints };
}

interface IUseChartConfigProps {
  data: IMarketTokenChart;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  textSubduedColor?: string;
  secondaryLineData?: ILightweightSecondaryLineChart;
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
  crosshairVertLineColor?: string;
  crosshairVertLineStyle?: number;
  patternColor?: string;
  pulseLastPointColor?: string;
  priceScaleMinimumWidth?: number;
  priceFormatter?: (price: number) => string;
  priceTickFormatter?: (prices: number[]) => string[];
  priceFormatBase?: number;
  compactPriceMaxCharacters?: number;
  priceScaleFormat?: 'stock';
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
  horzLineColor,
  horzLineStyle,
  priceScalePosition = 'right',
  priceScaleMargins,
  priceScaleEntireTextOnly,
  crosshairVertLineColor,
  crosshairVertLineStyle,
  patternColor,
  pulseLastPointColor,
  priceScaleMinimumWidth,
  priceFormatter,
  priceTickFormatter,
  priceFormatBase,
  compactPriceMaxCharacters,
  priceScaleFormat,
  priceFormatterPrecision,
  priceFormatterTickStep: priceFormatterTickStepProp,
  fontSize,
  seriesType,
  lineType,
  baselineOptions,
  histogramOptions,
  referenceLine,
  showLastValue,
  showLastValuePriceLine,
  lastValueLabelColor,
  showLastPointMarker,
  showTimeScale = true,
  useTimeScaleTickMarkWithoutUnit,
  timeScaleRightOffsetPixels,
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
        ...(resolvedSeriesType === 'histogram'
          ? {
              color:
                value >= (histogramOptions?.base ?? 0)
                  ? (histogramOptions?.positiveColor ?? lineColor)
                  : (histogramOptions?.negativeColor ?? lineColor),
            }
          : {}),
      })),
    [data, histogramOptions, lineColor, resolvedSeriesType],
  );
  const {
    line: chartSecondaryLineData,
    isolatedPoints: chartSecondaryPointData,
  } = useMemo(
    () => buildSecondaryLineSeries(secondaryLineData),
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
      horzLineColor: horzLineColor ?? theme.borderSubdued?.val ?? '#E5E5EA',
      horzLineStyle: horzLineStyle ?? 2,
      crosshairVertLineColor,
      crosshairVertLineStyle,
      patternColor,
      pulseLastPointColor,
      data: chartData,
      secondaryLineData: chartSecondaryLineData,
      secondaryPointData: chartSecondaryPointData,
      secondaryLineColor,
      secondaryLineWidth,
      priceScaleMinimumWidth,
      priceFormatter,
      priceTickFormatter,
      priceFormatBase,
      priceFormatterType,
      compactPriceMaxCharacters,
      priceScaleFormat,
      priceFormatterPrecision,
      priceFormatterTickStep,
      fontSize,
      seriesType: resolvedSeriesType,
      lineType,
      baselineOptions,
      histogramOptions,
      referenceLine,
      showLastValue,
      showLastValuePriceLine,
      lastValueLabelColor,
      showLastPointMarker,
      showTimeScale,
      useTimeScaleTickMarkWithoutUnit,
      timeScaleRightOffsetPixels,
      timeZone,
      locale,
    }),
    [
      chartData,
      chartSecondaryLineData,
      chartSecondaryPointData,
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
      horzLineColor,
      horzLineStyle,
      priceScalePosition,
      priceScaleMargins,
      priceScaleEntireTextOnly,
      crosshairVertLineColor,
      crosshairVertLineStyle,
      patternColor,
      pulseLastPointColor,
      priceScaleMinimumWidth,
      priceFormatter,
      priceTickFormatter,
      priceFormatBase,
      priceFormatterType,
      compactPriceMaxCharacters,
      priceScaleFormat,
      priceFormatterPrecision,
      priceFormatterTickStep,
      fontSize,
      resolvedSeriesType,
      lineType,
      baselineOptions,
      histogramOptions,
      referenceLine,
      showLastValue,
      showLastValuePriceLine,
      lastValueLabelColor,
      showLastPointMarker,
      showTimeScale,
      useTimeScaleTickMarkWithoutUnit,
      timeScaleRightOffsetPixels,
      timeZone,
      locale,
    ],
  );
}
