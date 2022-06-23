import React, { useCallback, useState } from 'react';

import ChartWithLabel from './ChartWithLabel';
import TimeControl, { TimeOptions } from './TimeControl';

const mockdata = [
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

const PriceChart: React.FC<PriceChartProps> = () => {
  const [data, setData] = useState(mockdata);
  const [time, setTime] = useState<TimeOptions>('1D');

  const refreshDataOnTimeChange = useCallback((newTime: TimeOptions) => {
    const newData = mockdata.map((d) => ({
      ...d,
      value: +(d.value + Math.random() * 10).toFixed(2),
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
