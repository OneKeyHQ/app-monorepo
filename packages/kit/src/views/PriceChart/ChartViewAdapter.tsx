import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { ChartPathProvider } from '@onekeyfe/react-native-animated-charts';

import { Box } from '@onekeyhq/components';

import ChartWrapper from './value-chart/Chart';
import useChartThrottledPoints from './value-chart/useChartThrottledPoints';

import type { ChartViewAdapterProps } from './chartService';

const ChartViewAdapter: FC<ChartViewAdapterProps> = ({
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

  const [width, setWidth] = useState(0);

  const onLayout = useCallback(
    ({
      nativeEvent: {
        layout: { width: newWidth },
      },
    }) => {
      setWidth(newWidth);
    },
    [setWidth],
  );

  return (
    <Box onLayout={onLayout} width="100%">
      {/* @ts-ignore */}
      <ChartPathProvider data={throttledData} width={width}>
        <ChartWrapper
          width={width}
          lineColor={lineColor}
          isFetching={isFetching}
          height={height}
          onHover={onHover}
        />
      </ChartPathProvider>
    </Box>
  );
};

ChartViewAdapter.displayName = 'ChartViewAdapter';
export default ChartViewAdapter;
