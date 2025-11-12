import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { ChartPathProvider } from '@onekeyfe/react-native-animated-charts';

import { Stack } from '@onekeyhq/components';
import type { IChartViewAdapterProps } from '@onekeyhq/kit/src/views/Market/components/Chart/chartUtils';
import useChartThrottledPoints from '@onekeyhq/kit/src/views/Market/components/Chart/value-chart/useChartThrottledPoints';

import EarnChartWrapper from './value-chart/EarnChartWrapper';

import type { LayoutChangeEvent } from 'react-native';

const EarnChartViewAdapter: FC<IChartViewAdapterProps> = ({
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
    }: LayoutChangeEvent) => {
      setWidth(newWidth);
    },
    [setWidth],
  );

  return (
    <Stack onLayout={onLayout} width="100%">
      {/* @ts-ignore */}
      <ChartPathProvider data={throttledData} width={width}>
        <EarnChartWrapper
          width={width}
          lineColor={lineColor}
          isFetching={isFetching}
          height={height}
          onHover={onHover}
        />
      </ChartPathProvider>
    </Stack>
  );
};

EarnChartViewAdapter.displayName = 'EarnChartViewAdapter';
export default EarnChartViewAdapter;
