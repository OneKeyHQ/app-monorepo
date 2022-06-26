import React, { useCallback, useState } from 'react';

import { SingleValueData } from 'lightweight-charts';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import useFormatDate from '../../hooks/useFormatDate';

import { OnHoverFunction } from './chartService';
import ChartView from './ChartView';
import PriceLabel from './PriceLabel';

type ChartWithLabelProps = {
  data: SingleValueData[];
  children: React.ReactNode;
};

const ChartWithLabel: React.FC<ChartWithLabelProps> = ({ data, children }) => {
  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState('');
  const isVerticalLayout = useIsVerticalLayout();
  const basePrice = data.length ? data[0].value : 0;
  const latestPrice = data.length ? data[data.length - 1].value : 0;
  let currentPrice;
  if (price === 'undefined' || price === undefined) {
    currentPrice = latestPrice;
  } else if (typeof price === 'string') {
    currentPrice = +price;
  } else {
    currentPrice = price;
  }

  const { formatDate } = useFormatDate();
  const onHover = useCallback<OnHoverFunction>(
    (hoverData) => {
      setPrice(hoverData.price);
      setTime(
        formatDate(hoverData.time ? new Date(hoverData.time) : new Date()),
      );
    },
    [formatDate],
  );
  const priceLabel = (
    <PriceLabel price={currentPrice} time={time} basePrice={basePrice} />
  );
  const chartView = <ChartView data={data} onHover={onHover} />;
  return isVerticalLayout ? (
    <>
      {priceLabel}
      <Box h="300px">{chartView}</Box>
      {children}
    </>
  ) : (
    <>
      <Box flexDirection="row" justifyContent="space-between">
        {priceLabel}
        <Box w="280px">{children}</Box>
      </Box>
      <Box h="300px">{chartView}</Box>
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
