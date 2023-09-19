import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import { isValidCoingeckoId } from '@onekeyhq/engine/src/managers/token';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ManageTokenModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import ChartWithLabel from '../../../PriceChart/ChartWithLabel';
import { useChartTimeLabel } from '../../../PriceChart/hooks';
import TimeControl, {
  TIMEOPTIONS,
  TIMEOPTIONS_VALUE,
} from '../../../PriceChart/TimeControl';
import {
  useMarketTokenChart,
  useMarketTokenItem,
} from '../../hooks/useMarketToken';

import type { ModalScreenProps } from '../../../../routes/types';
import type { ManageTokenRoutesParams } from '../../../ManageTokens/types';
import type { StyleProp, ViewStyle } from 'react-native';

type NavigationProps = ModalScreenProps<ManageTokenRoutesParams>;

type MarketPriceChartProps = {
  coingeckoId: string;
  style?: StyleProp<ViewStyle>;
};

const MarketPriceChart: FC<MarketPriceChartProps> = ({
  coingeckoId,
  style,
}) => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  let points: string | undefined;
  const isVertical = useIsVerticalLayout();
  if (isVertical) {
    points = '100';
  } else if (platformEnv.isNativeIOSPad) {
    points = '300';
  }

  const { chart } = useMarketTokenChart({
    coingeckoId,
    days: TIMEOPTIONS_VALUE[selectedTimeIndex],
    points,
  });

  const timeDefaultLabel = useChartTimeLabel(
    selectedTimeIndex,
    chart?.[0]?.[0],
  );
  const tokenItem = useMarketTokenItem({ coingeckoId });
  const onPriceSubscribe = useCallback(
    (price: number) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ManageToken,
        params: {
          screen: ManageTokenModalRoutes.PriceAlertList,
          params: {
            price,
            token: {
              coingeckoId,
              symbol: tokenItem?.symbol,
              logoURI: tokenItem?.logoURI,
            } as TokenDO,
          },
        },
      });
    },
    [coingeckoId, navigation, tokenItem?.logoURI, tokenItem?.symbol],
  );
  const refreshDataOnTimeChange = useCallback((newTimeValue: string) => {
    const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
    setSelectedTimeIndex(newTimeIndex);
  }, []);
  const isFetching = useMemo(() => !(chart && chart.length > 0), [chart]);
  return (
    <Box style={style}>
      <ChartWithLabel
        onPriceSubscribe={
          isValidCoingeckoId(coingeckoId) ? onPriceSubscribe : undefined
        }
        timeDefaultLabel={timeDefaultLabel}
        isFetching={isFetching}
        data={chart || []}
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
