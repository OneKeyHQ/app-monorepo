import React from 'react';

import { useThemeValue } from '@onekeyhq/components';

import ChartViewAdapter from './ChartViewAdapter';

type ChartViewProps = {
  data: any[];
  onHover(price?: string): void;
};

const ChartView: React.FC<ChartViewProps> = ({ data, onHover }) => {
  const lineColor = useThemeValue('interactive-default');
  const topColor = useThemeValue('action-primary-focus');
  const bottomColor = '#00FF1900';

  return (
    <ChartViewAdapter
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
