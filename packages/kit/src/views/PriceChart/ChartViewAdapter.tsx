import React from 'react';

import { ChartPathProvider } from '@onekeyfe/react-native-animated-charts';

import { Box, useUserDevice } from '@onekeyhq/components';

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
  const { size } = useUserDevice();
  // should be the same with responsivePadding in HistoricalRecords.tsx
  const responsivePadding = ['NORMAL', 'LARGE'].includes(size) ? 32 : 16;

  const { throttledData } = useChartThrottledPoints({
    originData: data,
    fetchingCharts: isFetching,
  });

  return (
    // @ts-ignore
    <ChartPathProvider data={throttledData}>
      <Box style={{ marginLeft: -responsivePadding }}>
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
