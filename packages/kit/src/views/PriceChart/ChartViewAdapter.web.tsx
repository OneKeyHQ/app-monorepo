import React, { useEffect, useRef } from 'react';

import { createChart } from 'lightweight-charts';
import { StyleProp, ViewStyle } from 'react-native';

import { Box } from '@onekeyhq/components';

import { createChartDom, updateChartDom } from './chartService';

type ChartViewAdapterProps = {
  data: any[];
  onHover(price?: number): void;
  lineColor: string;
  topColor: string;
  bottomColor: string;
  containerStyle?: StyleProp<ViewStyle>;
};

const ChartViewAdapter: React.FC<ChartViewAdapterProps> = ({
  data,
  onHover,
  lineColor,
  topColor,
  bottomColor,
  containerStyle,
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

  return <Box style={containerStyle} ref={chartContainerRef} />;
};
ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
