import type { FC } from 'react';
import { useEffect, useRef } from 'react';

import { useTheme } from '@onekeyhq/components';
import { createLazySdkLoader } from '@onekeyhq/shared/src/utils/lazySdkLoader';

import { createChartDom, updateChartDom } from './chartUtils';

import type { IChartViewAdapterProps, IOnekeyChartApi } from './chartUtils';

const getChartLib = createLazySdkLoader(() => import('lightweight-charts'));

const ChartViewAdapter: FC<IChartViewAdapterProps> = ({
  data,
  onHover,
  lineColor,
  topColor,
  bottomColor,
  height,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // Per-instance chart handle. The chart is created asynchronously (lazy lib
  // load), so the data-update effect below can fire before it exists — guard on
  // this ref instead of reading a global singleton.
  const chartRef = useRef<IOnekeyChartApi | null>(null);
  // Keep the latest data/colors so the async create path can render the current
  // frame as soon as the chart is ready.
  const latestPropsRef = useRef({ data, lineColor, topColor, bottomColor });
  latestPropsRef.current = { data, lineColor, topColor, bottomColor };
  const theme = useTheme();
  const textSubduedColor = theme.textSubdued.val;

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void getChartLib().then(({ AreaSeries, createChart }) => {
      if (cancelled || !chartContainerRef.current) return;
      const { chart, handleResize } = createChartDom(
        createChart,
        AreaSeries,
        chartContainerRef.current,
        onHover,
        height,
        textSubduedColor,
      );
      chartRef.current = chart as IOnekeyChartApi;
      // Render the current frame now that the chart exists, since the update
      // effect may have already run (and no-op'd) before this resolved.
      updateChartDom({ chart: chartRef.current, ...latestPropsRef.current });
      cleanup = () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSubduedColor]);

  useEffect(() => {
    const chart = chartRef.current;
    // Chart not created yet; the create effect will render the latest frame.
    if (!chart) {
      return;
    }
    updateChartDom({
      chart,
      bottomColor,
      topColor,
      lineColor,
      data,
    });
  }, [bottomColor, topColor, data, lineColor]);

  return <div style={{ width: '100%', height }} ref={chartContainerRef} />;
};
ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
