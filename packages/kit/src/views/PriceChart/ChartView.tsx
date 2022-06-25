import React from 'react';

import { StyleProp, ViewStyle } from 'react-native';

import { useThemeValue } from '@onekeyhq/components';

import ChartViewAdapter from './ChartViewAdapter';

type ChartViewProps = {
  data: any[];
  onHover(price?: string): void;
  style?: StyleProp<ViewStyle>;
};

const ChartView: React.FC<ChartViewProps> = ({ data, onHover, style }) => {
  const lineColor = useThemeValue('interactive-default');
  const topColor = useThemeValue('action-primary-focus');
  const bottomColor = '#00FF1900';

  return (
    <ChartViewAdapter
      containerStyle={style}
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
