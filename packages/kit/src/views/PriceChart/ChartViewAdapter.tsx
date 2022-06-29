import React from 'react';

import { ChartPathProvider } from '@onekeyfe/react-native-animated-charts';

import { Box, useUserDevice } from '@onekeyhq/components';

import { ChartViewAdapterProps } from './chartService';
import ChartWrapper from './value-chart/Chart';

const ChartViewAdapter: React.FC<ChartViewAdapterProps> = ({
  data,
  onHover,
  lineColor,
  height,
  // isLoading,
}) => {
  const { size } = useUserDevice();
  // should be the same with responsivePadding in HistoricalRecords.tsx
  const responsivePadding = ['NORMAL', 'LARGE'].includes(size) ? 32 : 16;

  return (
    <ChartPathProvider
      data={{ points: data.map((d) => ({ x: d.time, y: d.value })) }}
    >
      <Box style={{ marginLeft: -responsivePadding }}>
        <ChartWrapper
          lineColor={lineColor}
          // isLoading={isLoading}
          height={height}
          onHover={onHover}
        />
      </Box>
    </ChartPathProvider>
  );
};

ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
