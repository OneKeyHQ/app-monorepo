import type { FC } from 'react';
import { memo } from 'react';

import type { IChartViewProps } from '@onekeyhq/kit/src/views/Market/components/Chart/chartUtils';

import EarnChartViewAdapter from './EarnChartViewAdapter.native';

const EarnChartView: FC<IChartViewProps> = ({
  data,
  onHover,
  height,
  isFetching,
}) => {
  const lineColor = '#33C641';
  const topColor = '#00B81233';
  const bottomColor = '#00FF1900';

  return (
    <EarnChartViewAdapter
      data={data}
      onHover={onHover}
      height={height}
      isFetching={isFetching}
      lineColor={lineColor}
      topColor={topColor}
      bottomColor={bottomColor}
    />
  );
};

EarnChartView.displayName = 'EarnChartView';

export default memo(EarnChartView);
