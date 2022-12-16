import { FC, useCallback, useMemo, useState } from 'react';

import { StyleProp, ViewStyle } from 'react-native';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ChartWithLabel from '../../../PriceChart/ChartWithLabel';
import TimeControl, {
  TIMEOPTIONS,
  TIMEOPTIONS_VALUE,
} from '../../../PriceChart/TimeControl';
import { useMarketTokenChart } from '../../hooks/useMarketToken';

type MarketPriceChartProps = {
  coingeckoId: string;
  style?: StyleProp<ViewStyle>;
};

const MarketPriceChart: FC<MarketPriceChartProps> = ({
  coingeckoId,
  style,
}) => {
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

  const refreshDataOnTimeChange = useCallback((newTimeValue: string) => {
    const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
    setSelectedTimeIndex(newTimeIndex);
  }, []);
  const isFetching = useMemo(() => !(chart && chart.length > 0), [chart]);
  return (
    <Box style={style}>
      <ChartWithLabel isFetching={isFetching} data={chart || []}>
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
