import { useMemo } from 'react';

import { useTheme } from '@tamagui/core';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { DEFAULT_CHART_COLORS } from '../utils/constants';

import type { ILightweightChartConfig, ILightweightChartTime } from '../types';

interface IUseChartConfigProps {
  data: IMarketTokenChart;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  secondaryLineData?: IMarketTokenChart;
  secondaryLineColor?: string;
  secondaryLineWidth?: number;
  lineWidth?: number;
  showPriceScale?: boolean;
  showHorzGridLines?: boolean;
}

export function useChartConfig({
  data,
  lineColor = DEFAULT_CHART_COLORS.lineColor,
  topColor = DEFAULT_CHART_COLORS.topColor,
  bottomColor = DEFAULT_CHART_COLORS.bottomColor,
  secondaryLineData,
  secondaryLineColor,
  secondaryLineWidth,
  lineWidth = 3,
  showPriceScale = false,
  showHorzGridLines = false,
}: IUseChartConfigProps): ILightweightChartConfig {
  const theme = useTheme();

  return useMemo(
    () => ({
      theme: {
        bgColor: 'transparent',
        textColor: theme.text?.val || '#000000',
        textSubduedColor: theme.textSubdued?.val || '#666666',
        lineColor,
        topColor,
        bottomColor,
      },
      lineWidth,
      showPriceScale,
      showHorzGridLines,
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
      secondaryLineColor,
      secondaryLineWidth,
      lineWidth,
      showPriceScale,
      showHorzGridLines,
    ],
  );
}
