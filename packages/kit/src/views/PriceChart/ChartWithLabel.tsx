import React, { useCallback, useState } from 'react';

import { Box, Spinner, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useFormatDate from '../../hooks/useFormatDate';

import { MarketApiData, OnHoverFunction } from './chartService';
import ChartView from './ChartView';
import PriceLabel from './PriceLabel';

type ChartWithLabelProps = {
  data: MarketApiData[];
  children: React.ReactNode;
  isFetching: boolean;
};

const ChartWithLabel: React.FC<ChartWithLabelProps> = ({
  data,
  isFetching,
  children,
}) => {
  const { formatDate } = useFormatDate();
  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState(formatDate(new Date()));
  const isVerticalLayout = useIsVerticalLayout();
  const basePrice = data.length ? data[0][1] : 0;
  const latestPrice = data.length ? data[data.length - 1][1] : 0;
  let currentPrice;
  if (price === 'undefined' || price === undefined) {
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
  const priceLabel = (
    <PriceLabel price={currentPrice} time={time} basePrice={basePrice} />
  );
  const chartView = (
    <ChartView
      isFetching={isFetching}
      height={isVerticalLayout ? 190 : 240}
      data={data}
      onHover={onHover}
    />
  );
  const chartViewWithSpinner = data.length ? chartView : <Spinner />;
  return isVerticalLayout ? (
    <>
      {priceLabel}
      <Box h="190px" mt="25px" justifyContent="center" alignItems="center">
        {platformEnv.isNative ? chartView : chartViewWithSpinner}
      </Box>
      {children}
    </>
  ) : (
    <>
      <Box flexDirection="row" justifyContent="space-between">
        {priceLabel}
        <Box w="280px">{children}</Box>
      </Box>
      <Box h="240px" mt="30px" justifyContent="center" alignItems="center">
        {chartViewWithSpinner}
      </Box>
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
