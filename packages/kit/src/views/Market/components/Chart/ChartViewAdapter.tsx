import type { FC } from 'react';
import { useEffect, useRef } from 'react';

import { useTheme } from '@onekeyhq/components';
import { createLazySdkLoader } from '@onekeyhq/shared/src/utils/lazySdkLoader';

import { createChartDom, updateChartDom } from './chartUtils';

import type { IChartViewAdapterProps } from './chartUtils';

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
  const theme = useTheme();
  const textSubduedColor = theme.textSubdued.val;

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void getChartLib().then(({ createChart }) => {
      if (cancelled || !chartContainerRef.current) return;
      const { chart, handleResize } = createChartDom(
        createChart,
        chartContainerRef.current,
        onHover,
        height,
        textSubduedColor,
      );
      cleanup = () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSubduedColor]);

  useEffect(() => {
    updateChartDom({
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
