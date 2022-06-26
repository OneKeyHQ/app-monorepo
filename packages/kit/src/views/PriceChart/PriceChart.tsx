import React, { useCallback, useEffect, useState } from 'react';

import { SingleValueData, UTCTimestamp } from 'lightweight-charts';

import { PriceApiProps, fetchHistoricalPrices } from './chartService';
import ChartWithLabel from './ChartWithLabel';
import TimeControl, { TIMEOPTIONS, TIMEOPTIONS_VALUE } from './TimeControl';

type PriceChartProps = Omit<PriceApiProps, 'days'>;

const PriceChart: React.FC<PriceChartProps> = ({ contract, platform }) => {
  console.log({ platform, contract });
  const [data, setData] = useState<SingleValueData[]>([]);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);

  const refreshDataOnTimeChange = useCallback(
    async (newTimeValue: string) => {
      const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
      const days = TIMEOPTIONS_VALUE[newTimeIndex];
      const newData = await fetchHistoricalPrices({
        contract,
        platform: platform?.toLowerCase(),
        days,
      });
      setData(
        newData.map((d) => ({ time: d[0] as UTCTimestamp, value: d[1] })),
      );
      setSelectedTimeIndex(newTimeIndex);
    },
    [contract, platform],
  );

  useEffect(() => {
    refreshDataOnTimeChange(TIMEOPTIONS[0]);
  }, [refreshDataOnTimeChange]);

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
