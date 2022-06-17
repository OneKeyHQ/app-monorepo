import React, { useEffect, useRef } from 'react';

import { ColorType, createChart } from 'lightweight-charts';

import { useThemeValue } from '@onekeyhq/components';

type PriceChartProps = {
  data?: any[];
  // backgroundColor?: string;
  // lineColor?: string;
  // textColor?: string;
  // areaTopColor?: string;
  // areaBottomColor?: string;
};

const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  const lineColor = useThemeValue('interactive-default');
  const areaTopColor = useThemeValue('action-primary-focus');
  const areaBottomColor = '#00FF1900';
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      timeScale: {
        visible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true,
      },
      rightPriceScale: {
        visible: false,
      },
      handleScale: {
        pinch: false,
        mouseWheel: false,
      },
    });
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    chart.timeScale().fitContent();

    const newSeries = chart.addAreaSeries({
      lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
    });
    newSeries.setData(data);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);

      chart.remove();
    };
  }, [areaTopColor, data, lineColor]);

  return <div ref={chartContainerRef} />;
};
PriceChart.displayName = 'PriceChart';
export default PriceChart;
