import React from 'react';

import { useThemeValue } from '@onekeyhq/components';

import { ChartViewProps } from './chartService';
import ChartViewAdapter from './ChartViewAdapter';

const ChartView: React.FC<ChartViewProps> = ({ data, onHover, height }) => {
  const lineColor = useThemeValue('interactive-default');
  const topColor = useThemeValue('action-primary-focus');
  const bottomColor = '#00FF1900';

  return (
    <ChartViewAdapter
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
export default React.memo(ChartView);
