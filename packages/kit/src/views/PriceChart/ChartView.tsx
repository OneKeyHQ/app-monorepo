import type { FC } from 'react';
import { memo } from 'react';

import { useThemeValue } from '@onekeyhq/components';

import ChartViewAdapter from './ChartViewAdapter';

import type { ChartViewProps } from './chartService';

const ChartView: FC<ChartViewProps> = ({
  data,
  onHover,
  height,
  isFetching,
}) => {
  const lineColor = useThemeValue('interactive-default');
  const topColor = useThemeValue('action-primary-focus');
  const bottomColor = '#00FF1900';

  return (
    <ChartViewAdapter
      isFetching={isFetching}
      height={height}
      data={data}
      lineColor={lineColor}
      topColor={topColor}
      bottomColor={bottomColor}
      onHover={onHover}
    />
  );
};
ChartView.displayName = 'ChartView';
export default memo(ChartView);
