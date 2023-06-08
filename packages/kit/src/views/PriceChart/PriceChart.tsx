import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import { isValidCoingeckoId } from '@onekeyhq/engine/src/managers/token';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSettings } from '../../hooks';
import { useSimpleTokenPriceValue } from '../../hooks/useManegeTokenPrice';
import {
  ManageTokenModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';
import { useMarketTokenItem } from '../Market/hooks/useMarketToken';

import { fetchChartData } from './chartService';
import ChartWithLabel from './ChartWithLabel';
import { useChartTimeLabel } from './hooks';
import TimeControl, { TIMEOPTIONS, TIMEOPTIONS_VALUE } from './TimeControl';

import type { ModalScreenProps } from '../../routes/types';
import type { ManageTokenRoutesParams } from '../ManageTokens/types';
import type { MarketApiData, PriceApiProps } from './chartService';
import type { StyleProp, ViewStyle } from 'react-native';

type NavigationProps = ModalScreenProps<ManageTokenRoutesParams>;

type PriceChartProps = Omit<PriceApiProps, 'days'> & {
  style?: StyleProp<ViewStyle>;
  coingeckoId?: string;
  symbol?: string;
};

const PriceChart: FC<PriceChartProps> = ({
  coingeckoId,
  contract,
  networkId,
  style,
  symbol,
}) => {
  const [isFetching, setIsFetching] = useState(true);
  const navigation = useNavigation<NavigationProps['navigation']>();
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const price = useSimpleTokenPriceValue({
    networkId,
    contractAdress: contract,
  });
  const dataMap = useRef<MarketApiData[][]>([]);
  const timeDefaultLabel = useChartTimeLabel(
    selectedTimeIndex,
    dataMap.current?.[selectedTimeIndex]?.[0]?.[0],
  );
  const { selectedFiatMoneySymbol } = useSettings();
  const isNoPriceData = price === undefined || price === null;
  let points: string | undefined;
  const isVertical = useIsVerticalLayout();
  if (isVertical) {
    points = '100';
  } else if (platformEnv.isNativeIOSPad) {
    points = '300';
  }

  const tokenItem = useMarketTokenItem({ coingeckoId });

  const onPriceSubscribe = useCallback(
    (p: number) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ManageToken,
        params: {
          screen: ManageTokenModalRoutes.PriceAlertList,
          params: {
            price: p,
            token: {
              coingeckoId,
              symbol: symbol ?? tokenItem?.symbol,
              logoURI: tokenItem?.logoURI,
            } as TokenDO,
          },
        },
      });
    },
    [coingeckoId, navigation, tokenItem?.logoURI, tokenItem?.symbol, symbol],
  );

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
        onPriceSubscribe={
          isValidCoingeckoId(coingeckoId) ? onPriceSubscribe : undefined
        }
        isFetching={isFetching}
        timeDefaultLabel={timeDefaultLabel}
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
