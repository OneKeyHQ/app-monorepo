import React, { useEffect, useRef } from 'react';

import { IChartApi, createChart } from 'lightweight-charts';

import { createChartDom, updateChartDom } from './sharedChartUtils';

type ChartViewAdapterProps = {
  data: any[];
  onHover(price?: number): void;
  lineColor: string;
  topColor: string;
  bottomColor: string;
};

const ChartViewAdapter: React.FC<ChartViewAdapterProps> = ({
  data,
  onHover,
  lineColor,
  topColor,
  bottomColor,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi>();

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }
    const { chart, handleResize } = createChartDom(
      createChart,
      chartContainerRef.current,
      onHover,
    );

    chartRef.current = chart;
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      updateChartDom({
        chart: chartRef.current,
        bottomColor,
        topColor,
        lineColor,
        data,
      });
    }
  }, [bottomColor, topColor, data, lineColor]);

  return <div ref={chartContainerRef} />;
};
ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
