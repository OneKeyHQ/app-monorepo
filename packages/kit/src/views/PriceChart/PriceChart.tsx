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
  const [data, setData] = useState<MarketApiData[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const { selectedFiatMoneySymbol = 'usd' } = useSettings();

  const refreshDataOnTimeChange = useCallback(
    async (newTimeValue: string) => {
      const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
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
      }
      // no need to refresh data, the smallest time span is 1 day
      // const cacheData = dataMap.current[newTimeIndex];
      // if (
      //   !cacheData ||
      //   // @ts-ignore
      //   cacheData.__time < Date.now() - 1000 * 60
      // ) {
      //   setIsFetching(true);
      //   const newData = await fetchHistoricalPrices({
      //     contract,
      //     platform,
      //     days: TIMEOPTIONS_VALUE[newTimeIndex],
      //     vs_currency: selectedFiatMoneySymbol,
      //   });
      //   // @ts-ignore
      //   newData.__time = Date.now();
      //   dataMap.current[newTimeIndex] = newData;
      // }
      setSelectedTimeIndex(newTimeIndex);
      setData(dataMap.current[newTimeIndex]);
      setIsFetching(false);
    },
    [contract, platform, selectedFiatMoneySymbol, dataMap],
  );

  useEffect(() => {
    refreshDataOnTimeChange(TIMEOPTIONS[0]);
  }, [refreshDataOnTimeChange]);

  return (
    <Box style={style}>
      <ChartWithLabel isFetching={isFetching} data={data}>
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
