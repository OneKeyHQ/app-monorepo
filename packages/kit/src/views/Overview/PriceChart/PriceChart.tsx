import React, { useCallback, useEffect, useRef, useState } from 'react';

import ChartWithLabel from './ChartWithLabel';
import TimeControl, { TimeOptions } from './TimeControl';

const _data = [
  { time: '2018-12-22', value: 32.51 },
  { time: '2018-12-23', value: 31.11 },
  { time: '2018-12-24', value: 27.02 },
  { time: '2018-12-25', value: 27.32 },
  { time: '2018-12-26', value: 25.17 },
  { time: '2018-12-27', value: 28.89 },
  { time: '2018-12-28', value: 25.46 },
  { time: '2018-12-29', value: 23.92 },
  { time: '2018-12-30', value: 22.68 },
  { time: '2018-12-31', value: 22.67 },
];
type PriceChartProps = {
  coin?: string;
};

const PriceChart: React.FC<PriceChartProps> = ({ coin = 'BTC' }) => {
  const [data, setData] = useState(_data);
  const [time, setTime] = useState<TimeOptions>('1D');

  const refreshDataOnTimeChange = useCallback((newTime: TimeOptions) => {
    const newData = _data.map((d) => ({
      ...d,
      value: d.value + Math.random() * 10,
    }));
    setData(newData);
    setTime(newTime);
  }, []);
  return (
    <>
      <ChartWithLabel data={data} />
      <TimeControl time={time} onTimeChange={refreshDataOnTimeChange} />
    </>
  );
};
PriceChart.displayName = 'PriceChart';
export default PriceChart;
