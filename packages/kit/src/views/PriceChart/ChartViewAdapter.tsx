import React from 'react';

import { ChartPathProvider } from '@onekeyfe/react-native-animated-charts';

import { Box } from '@onekeyhq/components';

import { ChartViewAdapterProps } from './chartService';
import ChartWrapper from './value-chart/Chart';
import useChartThrottledPoints from './value-chart/useChartThrottledPoints';

const ChartViewAdapter: React.FC<ChartViewAdapterProps> = ({
  data,
  onHover,
  lineColor,
  height,
  isFetching,
}) => {
  const { throttledData } = useChartThrottledPoints({
    originData: data,
    fetchingCharts: isFetching,
  });

  return (
    // @ts-ignore
    <ChartPathProvider data={throttledData}>
      <Box>
        <ChartWrapper
          lineColor={lineColor}
          isFetching={isFetching}
          height={height}
          onHover={onHover}
        />
      </Box>
    </ChartPathProvider>
  );
};

ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
