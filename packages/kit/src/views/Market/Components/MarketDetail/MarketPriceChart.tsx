import React, { useCallback, useEffect, useRef, useState } from 'react';

import { StyleProp, ViewStyle } from 'react-native';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  MarketApiData,
  PriceApiProps,
  fetchChartData,
} from '../../../PriceChart/chartService';
import ChartWithLabel from '../../../PriceChart/ChartWithLabel';
import TimeControl, {
  TIMEOPTIONS,
  TIMEOPTIONS_VALUE,
} from '../../../PriceChart/TimeControl';
import { useMarketDetail } from '../../hooks/useMarketDetail';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

type MarketPriceChartProps = {
  coingeckoId: string;
  style?: StyleProp<ViewStyle>;
};

const MarketPriceChart: React.FC<MarketPriceChartProps> = ({
  coingeckoId,
  style,
}) => {
  const [isFetching, setIsFetching] = useState(true);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const { marketChart } = useMarketDetail({ coingeckoId });
  const dataMap = useRef<MarketApiData[][]>([]);
  let points: string | undefined;
  const isVertical = useIsVerticalLayout();
  if (isVertical) {
    points = '100';
  } else if (platformEnv.isNativeIOSPad) {
    points = '300';
  }

  const refreshDataOnTimeChange = useCallback(
    async (newTimeValue: string) => {
      const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
      let latestPriceData: MarketApiData;
      const cacheData = dataMap.current[newTimeIndex];
      if (!cacheData) {
        setIsFetching(true);
        let newData =
          await backgroundApiProxy.serviceMarket.fetchMarketTokenChart({
            coingeckoId,
            days: TIMEOPTIONS_VALUE[newTimeIndex],
            points,
          });
        if (marketChart?.length && newData?.length) {
          latestPriceData = marketChart[marketChart.length - 1];
          newData = newData.filter((d) => d[0] < latestPriceData[0]);
          newData.push(latestPriceData);
          dataMap.current[newTimeIndex] = newData;
        }
      }
      setSelectedTimeIndex(newTimeIndex);
      setIsFetching(false);
    },
    [marketChart, coingeckoId],
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
          enabled={!isFetching}
          selectedIndex={selectedTimeIndex}
          onTimeChange={refreshDataOnTimeChange}
        />
      </ChartWithLabel>
    </Box>
  );
};
MarketPriceChart.displayName = 'MarketPriceChart';
export default MarketPriceChart;
