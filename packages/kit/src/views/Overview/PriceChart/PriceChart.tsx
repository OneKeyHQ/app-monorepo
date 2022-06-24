import React, { useCallback, useState } from 'react';

import ChartWithLabel from './ChartWithLabel';
import TimeControl, { TIMEOPTIONS } from './TimeControl';

const now = Date.now();
const mockdata = new Array(100).fill(0).map((_, i) => ({
  time: now + 1000 * i,
  value: +(Math.random() * 100).toFixed(2),
}));
type PriceChartProps = {
  coin?: string;
};

const PriceChart: React.FC<PriceChartProps> = () => {
  const [data, setData] = useState(mockdata);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);

  const refreshDataOnTimeChange = useCallback((newTimeValue: string) => {
    const newData = mockdata.map((d) => ({
      ...d,
      value: +(d.value + Math.random() * 10).toFixed(2),
    }));
    setData(newData);
    setSelectedTimeIndex(TIMEOPTIONS.indexOf(newTimeValue));
  }, []);
  return (
    <ChartWithLabel data={data}>
      <TimeControl
        selectedIndex={selectedTimeIndex}
        onTimeChange={refreshDataOnTimeChange}
      />
    </ChartWithLabel>
  );
};
PriceChart.displayName = 'PriceChart';
export default PriceChart;
