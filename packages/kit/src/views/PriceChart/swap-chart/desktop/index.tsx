import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { Box, Typography } from '@onekeyhq/components';

import useFormatDate from '../../../../hooks/useFormatDate';
import { formatDecimalZero } from '../../../Market/utils';
import TimeControl from '../../TimeControl';
import ChartLayout from '../ChartLayout';
import { useChartState } from '../hooks/useChartState';
import PriceDisplayInfo from '../PriceDisplayInfo';
import { type SwapChartProps } from '../types';

import type { OnHoverFunction } from '../../chartService';

type SwapChartHeaderProps = {
  currentPrice: number | null;
  time: string;
  basePrice: number;
  enabled: boolean;
  selectedIndex: number;
  onTimeChange: (time: string) => void;
};

const SwapChartHeader: FC<SwapChartHeaderProps> = ({
  currentPrice,
  basePrice,
  time,
  enabled,
  selectedIndex,
  onTimeChange,
}) => (
  <Box>
    <Box flexDirection="row" justifyContent="space-between">
      <Typography.DisplayXLarge my="1">
        {currentPrice ? formatDecimalZero(currentPrice) : ''}
      </Typography.DisplayXLarge>
      <Box w="280px">
        <TimeControl
          enabled={enabled}
          selectedIndex={selectedIndex}
          onTimeChange={onTimeChange}
        />
      </Box>
    </Box>
    <Box>
      <PriceDisplayInfo
        price={currentPrice}
        time={time}
        basePrice={basePrice}
      />
    </Box>
  </Box>
);

const SwapChart: FC<SwapChartProps> = ({ fromToken, toToken }) => {
  const { data, refreshDataOnTimeChange, isFetching, selectedTimeIndex } =
    useChartState({
      fromToken,
      toToken,
    });
  const { formatDate } = useFormatDate();
  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState(formatDate(new Date()));
  const { finalData } = data;
  const basePrice = finalData?.length ? finalData[0][1] : 0;
  const latestPrice = finalData?.length
    ? finalData[finalData.length - 1][1]
    : 0;
  let currentPrice;
  if (!data) {
    currentPrice = null;
  } else if (price === 'undefined' || price === undefined) {
    currentPrice = latestPrice;
  } else if (typeof price === 'string') {
    currentPrice = +price;
  } else {
    currentPrice = price;
  }

  const onHover = useCallback<OnHoverFunction>(
    (hoverData) => {
      let displayTime;
      if (hoverData.time instanceof Date) {
        displayTime = formatDate(hoverData.time);
      } else if (typeof hoverData.time === 'number') {
        displayTime = formatDate(new Date(hoverData.time));
      } else if (typeof hoverData.time === 'string') {
        displayTime = formatDate(new Date(+hoverData.time));
      } else {
        displayTime = formatDate(new Date());
      }
      setTime(displayTime);
      setPrice(hoverData.price);
    },
    [formatDate],
  );
  return (
    <ChartLayout
      height={350}
      mt={30}
      header={
        <SwapChartHeader
          currentPrice={currentPrice}
          basePrice={basePrice}
          time={time}
          selectedIndex={selectedTimeIndex}
          onTimeChange={refreshDataOnTimeChange}
          enabled={!isFetching && !!data}
        />
      }
      data={finalData}
      onHover={onHover}
      isFetching={isFetching}
    />
  );
};

SwapChart.displayName = 'SwapChart';

export default SwapChart;
