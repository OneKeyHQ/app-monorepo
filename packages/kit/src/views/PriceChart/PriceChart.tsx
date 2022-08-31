import React, { useCallback, useEffect, useRef, useState } from 'react';

import { StyleProp, ViewStyle } from 'react-native';

import { Box } from '@onekeyhq/components';

import { useManageTokens } from '../../hooks';

import { MarketApiData, PriceApiProps, fetchChartData } from './chartService';
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
  const [isFetching, setIsFetching] = useState(false);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const { charts: reduxCachedCharts, prices } = useManageTokens();
  const tokenId = contract || 'main';
  const isNoPriceData = prices[tokenId] === null;
  const dayData = reduxCachedCharts[tokenId];
  const dataMap = useRef<MarketApiData[][]>([]);

  const refreshDataOnTimeChange = useCallback(
    async (newTimeValue: string) => {
      const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
      let latestPriceData: MarketApiData;
      const cacheData = dataMap.current[newTimeIndex];
      if (!cacheData) {
        if (!platform) {
          return;
        }
        setIsFetching(true);
        let newData = await fetchChartData({
          contract,
          platform,
          days: TIMEOPTIONS_VALUE[newTimeIndex],
        });
        if (dayData.length && newData?.length) {
          latestPriceData = dayData[dayData.length - 1];
          newData = newData.filter((d) => d[0] < latestPriceData[0]);
          newData.push(latestPriceData);
          dataMap.current[newTimeIndex] = newData;
        }
      }
      setSelectedTimeIndex(newTimeIndex);
      setIsFetching(false);
    },
    [platform, contract, dayData],
  );

  useEffect(() => {
    refreshDataOnTimeChange(TIMEOPTIONS[0]);
  }, [refreshDataOnTimeChange]);

  return (
    <Box style={style}>
      <ChartWithLabel
        isFetching={isFetching}
        data={isNoPriceData ? null : dataMap.current?.[selectedTimeIndex] || []}
      >
        <TimeControl
          enabled={!isFetching && !isNoPriceData}
          selectedIndex={selectedTimeIndex}
          onTimeChange={refreshDataOnTimeChange}
        />
      </ChartWithLabel>
    </Box>
  );
};
PriceChart.displayName = 'PriceChart';
export default PriceChart;
