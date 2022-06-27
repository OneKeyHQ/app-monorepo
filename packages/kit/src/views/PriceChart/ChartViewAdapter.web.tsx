import React, { useEffect, useRef } from 'react';

import { createChart } from 'lightweight-charts';

import { Box } from '@onekeyhq/components';

import {
  ChartViewAdapterProps,
  createChartDom,
  updateChartDom,
} from './chartService';

const ChartViewAdapter: React.FC<ChartViewAdapterProps> = ({
  data,
  onHover,
  lineColor,
  topColor,
  bottomColor,
  height,
}) => {
  const chartContainerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }
    const { chart, handleResize } = createChartDom(
      createChart,
      chartContainerRef.current,
      onHover,
      height,
    );

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateChartDom({
      bottomColor,
      topColor,
      lineColor,
      data,
    });
  }, [bottomColor, topColor, data, lineColor]);

  return <Box ref={chartContainerRef} />;
};
ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
