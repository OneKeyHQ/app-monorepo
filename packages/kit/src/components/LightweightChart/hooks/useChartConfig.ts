import { useMemo } from 'react';

import { useTheme } from '@tamagui/core';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { DEFAULT_CHART_COLORS } from '../utils/constants';

import type { ILightweightChartConfig } from '../types';

interface IUseChartConfigProps {
  data: IMarketTokenChart;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
}

export function useChartConfig({
  data,
  lineColor = DEFAULT_CHART_COLORS.lineColor,
  topColor = DEFAULT_CHART_COLORS.topColor,
  bottomColor = DEFAULT_CHART_COLORS.bottomColor,
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
      data: data.map(([time, value]: [number, number]) => ({ time, value })),
    }),
    [
      data,
      theme.text?.val,
      theme.textSubdued?.val,
      lineColor,
      topColor,
      bottomColor,
    ],
  );
}
