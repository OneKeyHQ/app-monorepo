import React, { useEffect, useRef } from 'react';

import { IChartApi, createChart } from 'lightweight-charts';

import { useThemeValue } from '@onekeyhq/components';

type TradingViewProps = {
  data?: any[];
  onHover(price?: number): void;
};

const TradingView: React.FC<TradingViewProps> = ({ data = [], onHover }) => {
  const lineColor = useThemeValue('interactive-default');
  const areaTopColor = useThemeValue('action-primary-focus');
  const areaBottomColor = '#00FF1900';
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi>();

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }
    chartRef.current = createChart(chartContainerRef.current, {
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
    const chart = chartRef.current;
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    chart.timeScale().fitContent();

    // const onHover = throttle(({ seriesPrices }) => {
    //   console.log(seriesPrices);
    // }, 100);
    chart.subscribeCrosshairMove(({ seriesPrices }) => {
      onHover(seriesPrices.values().next().value);
    });

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      const newSeries = chartRef.current.addAreaSeries({
        lineColor,
        topColor: areaTopColor,
        bottomColor: areaBottomColor,
      });
      newSeries.setData(data);
    }
  }, [areaTopColor, data, lineColor]);

  return <div ref={chartContainerRef} />;
};
TradingView.displayName = 'TradingView';
export default TradingView;
