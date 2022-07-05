import React, { useCallback, useEffect, useRef, useState } from 'react';

import { StyleProp, ViewStyle } from 'react-native';

import { Box } from '@onekeyhq/components';

import { useSettings } from '../../hooks/redux';

import {
  MarketApiData,
  PriceApiProps,
  fetchHistoricalPrices,
} from './chartService';
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
  const dataMap = useRef<MarketApiData[][]>();
  const [isFetching, setIsFetching] = useState(false);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const { selectedFiatMoneySymbol = 'usd' } = useSettings();

  const refreshDataOnTimeChange = useCallback(
    async (newTimeValue: string) => {
      const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
      let latestPriceData;
      if (!dataMap.current) {
        setIsFetching(true);
        dataMap.current = await Promise.all(
          TIMEOPTIONS_VALUE.map((days) =>
            fetchHistoricalPrices({
              contract,
              platform,
              days,
              vs_currency: selectedFiatMoneySymbol,
            }),
          ),
        );
        const dayData = dataMap.current[0];
        latestPriceData = dayData[dayData.length - 1];
        for (let i = 1; i < dataMap.current.length; i += 1) {
          dataMap.current[i].push(latestPriceData);
        }
      }
      const cacheData = dataMap.current[newTimeIndex];
      if (!cacheData) {
        setIsFetching(true);
        const newData = await fetchHistoricalPrices({
          contract,
          platform,
          days: TIMEOPTIONS_VALUE[newTimeIndex],
          vs_currency: selectedFiatMoneySymbol,
        });
        const dayData = dataMap.current[0];
        latestPriceData = dayData[dayData.length - 1];
        newData.push(latestPriceData);
        dataMap.current[newTimeIndex] = newData;
      }
      setSelectedTimeIndex(newTimeIndex);
      setIsFetching(false);
    },
    [contract, platform, selectedFiatMoneySymbol, dataMap],
  );

  useEffect(() => {
    refreshDataOnTimeChange(TIMEOPTIONS[0]);
  }, [refreshDataOnTimeChange]);

  return (
    <Box style={style}>
      <ChartWithLabel
        isFetching={isFetching}
        data={dataMap.current?.[selectedTimeIndex] || []}
      >
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
