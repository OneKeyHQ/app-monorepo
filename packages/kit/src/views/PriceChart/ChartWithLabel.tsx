import React, { useCallback, useState } from 'react';

import { SingleValueData, UTCTimestamp } from 'lightweight-charts';

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
  const { formatDate } = useFormatDate();
  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState(formatDate(new Date()));
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

  const onHover = useCallback<OnHoverFunction>(
    (hoverData) => {
      setPrice(hoverData.price);
      setTime(
        formatDate(
          hoverData.time
            ? new Date(hoverData.time as UTCTimestamp)
            : new Date(),
        ),
      );
    },
    [formatDate],
  );
  const priceLabel = (
    <PriceLabel price={currentPrice} time={time} basePrice={basePrice} />
  );
  return isVerticalLayout ? (
    <>
      {priceLabel}
      <Box h="182px">
        <ChartView height={152} data={data} onHover={onHover} />
      </Box>
      {children}
    </>
  ) : (
    <>
      <Box flexDirection="row" justifyContent="space-between">
        {priceLabel}
        <Box w="280px">{children}</Box>
      </Box>
      <Box h="190px">
        <ChartView height={190} data={data} onHover={onHover} />
      </Box>
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
