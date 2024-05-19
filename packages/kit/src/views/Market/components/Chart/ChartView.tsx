import type { FC } from 'react';
import { memo } from 'react';

import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import ChartViewAdapter from './ChartViewAdapter.native';

import type { BusinessDay, UTCTimestamp } from 'lightweight-charts';

type IOnHoverFunction = ({
  time,
  price,
}: {
  time?: UTCTimestamp | BusinessDay | Date | string;
  price?: number | string;
}) => void;
interface IChartViewProps {
  data: IMarketTokenChart;
  onHover: IOnHoverFunction;
  height: number;
  isFetching: boolean;
}

const ChartView: FC<IChartViewProps> = ({
  data,
  onHover,
  height,
  isFetching,
}) => {
  const lineColor = '#33C641';
  const topColor = '#00B81233';
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
