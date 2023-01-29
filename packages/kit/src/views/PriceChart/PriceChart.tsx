import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSettings } from '../../hooks';
import { useSimpleTokenPriceValue } from '../../hooks/useManegeTokenPrice';

import { fetchChartData } from './chartService';
import ChartWithLabel from './ChartWithLabel';
import TimeControl, { TIMEOPTIONS, TIMEOPTIONS_VALUE } from './TimeControl';

import type { MarketApiData, PriceApiProps } from './chartService';
import type { StyleProp, ViewStyle } from 'react-native';

type PriceChartProps = Omit<PriceApiProps, 'days'> & {
  style?: StyleProp<ViewStyle>;
};

const PriceChart: FC<PriceChartProps> = ({ contract, networkId, style }) => {
  const [isFetching, setIsFetching] = useState(true);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const price = useSimpleTokenPriceValue({
    networkId,
    contractAdress: contract,
  });
  const { selectedFiatMoneySymbol } = useSettings();
  // const tokenId = contract || 'main';
  const isNoPriceData = price === undefined || price === null;
  // const dayData = reduxCachedCharts[tokenId];
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
      // let latestPriceData: MarketApiData;
      const cacheData = dataMap.current[newTimeIndex];
      if (!cacheData) {
        setIsFetching(true);
        const newData = await fetchChartData({
          contract,
          networkId,
          days: TIMEOPTIONS_VALUE[newTimeIndex],
          points,
          vs_currency: selectedFiatMoneySymbol,
        });
        if (newData?.length) {
          // latestPriceData = dayData[dayData.length - 1];
          // newData = newData.filter((d) => d[0] < latestPriceData[0]);
          // newData.push(latestPriceData);
          dataMap.current[newTimeIndex] = newData;
        }
      }
      setSelectedTimeIndex(newTimeIndex);
      setIsFetching(false);
    },
    [contract, networkId, points, selectedFiatMoneySymbol],
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
