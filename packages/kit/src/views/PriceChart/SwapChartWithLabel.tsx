import type { FC, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { Box, Spinner, Typography } from '@onekeyhq/components';

import useFormatDate from '../../hooks/useFormatDate';
import { formatDecimalZero } from '../Market/utils';

import ChartView from './ChartView';
import SvgNoPriceData from './NoPriceData';
import SwapPriceDisplayInfo from './SwapPriceDisplayInfo';

import type { MarketApiData, OnHoverFunction } from './chartService';

type ChartWithLabelProps = {
  data: MarketApiData[] | null;
  children: ReactNode;
  isFetching: boolean;
};

const ChartWithLabel: FC<ChartWithLabelProps> = ({
  data,
  isFetching,
  children,
}) => {
  const { formatDate } = useFormatDate();
  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState(formatDate(new Date()));
  const basePrice = data?.length ? data[0][1] : 0;
  const latestPrice = data?.length ? data[data.length - 1][1] : 0;
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
  const chartView = data ? (
    <ChartView
      isFetching={isFetching}
      height={350}
      data={data}
      onHover={onHover}
    />
  ) : (
    <SvgNoPriceData width="100%" height="100%" preserveAspectRatio="none" />
  );
  const chartViewWithSpinner =
    data && data.length === 0 ? <Spinner /> : chartView;
  return (
    <>
      <Box flexDirection="row" justifyContent="space-between">
        <Typography.DisplayXLarge my="1">
          {currentPrice ? formatDecimalZero(currentPrice) : ''}
        </Typography.DisplayXLarge>
        <Box w="280px">{children}</Box>
      </Box>
      <Box>
        <SwapPriceDisplayInfo
          price={currentPrice}
          time={time}
          basePrice={basePrice}
        />
      </Box>
      <Box h="350px" mt="30px" justifyContent="center" alignItems="center">
        {chartViewWithSpinner}
      </Box>
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
