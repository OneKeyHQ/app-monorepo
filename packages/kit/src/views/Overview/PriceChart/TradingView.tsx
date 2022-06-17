import React, { useEffect, useRef } from 'react';

import { createChart } from 'lightweight-charts';

import { useThemeValue } from '@onekeyhq/components';

type TradingViewProps = {
  data?: any[];
};

const TradingView: React.FC<TradingViewProps> = ({ data = [] }) => {
  const lineColor = useThemeValue('interactive-default');
  const areaTopColor = useThemeValue('action-primary-focus');
  const areaBottomColor = '#00FF1900';
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }
    const chart = createChart(chartContainerRef.current, {
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
TradingView.displayName = 'TradingView';
export default TradingView;
