import React, { useCallback, useEffect, useState } from 'react';

import { SingleValueData, UTCTimestamp } from 'lightweight-charts';
import { StyleProp, ViewStyle } from 'react-native';

import { Box } from '@onekeyhq/components';

import { useSettings } from '../../hooks/redux';

import { PriceApiProps, fetchHistoricalPrices } from './chartService';
import ChartWithLabel from './ChartWithLabel';
import TimeControl, { TIMEOPTIONS, TIMEOPTIONS_VALUE } from './TimeControl';

type PriceChartProps = Omit<PriceApiProps, 'days'> & {
  style?: StyleProp<ViewStyle>;
};

const PriceChart: React.FC<PriceChartProps> = ({
  contract,
  platform,
  style,
}) => {
  const [data, setData] = useState<SingleValueData[]>([]);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const { selectedFiatMoneySymbol = 'usd' } = useSettings();

  const refreshDataOnTimeChange = useCallback(
    async (newTimeValue: string) => {
      const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
      setSelectedTimeIndex(newTimeIndex);
      const days = TIMEOPTIONS_VALUE[newTimeIndex];
      const newData = await fetchHistoricalPrices({
        contract,
        platform,
        days,
        vs_currency: selectedFiatMoneySymbol,
      });
      setData(
        newData.map((d) => ({ time: d[0] as UTCTimestamp, value: d[1] })),
      );
    },
    [contract, selectedFiatMoneySymbol, platform],
  );

  useEffect(() => {
    refreshDataOnTimeChange(TIMEOPTIONS[0]);
  }, [refreshDataOnTimeChange]);

  return (
    <Box style={style}>
      <ChartWithLabel data={data}>
        <TimeControl
          selectedIndex={selectedTimeIndex}
          onTimeChange={refreshDataOnTimeChange}
        />
      </ChartWithLabel>
    </Box>
  );
};
PriceChart.displayName = 'PriceChart';
export default PriceChart;
