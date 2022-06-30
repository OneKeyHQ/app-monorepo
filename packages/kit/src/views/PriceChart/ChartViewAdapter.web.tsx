import React, { useEffect, useRef } from 'react';

import { createChart } from 'lightweight-charts';

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
  const chartContainerRef = useRef<HTMLDivElement>(null);

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

  return <div style={{ width: '100%', height }} ref={chartContainerRef} />;
};
ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
