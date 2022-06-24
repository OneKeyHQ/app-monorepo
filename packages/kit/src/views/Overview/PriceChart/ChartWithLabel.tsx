import React, { useState } from 'react';

import { Box, useIsVerticalLayout } from '@onekeyhq/components';

import ChartView from './ChartView';
import PriceLabel from './PriceLabel';

type ChartWithLabelProps = {
  data: Array<{ time: string | number; value: number }>;
  children: React.ReactNode;
};

const ChartWithLabel: React.FC<ChartWithLabelProps> = ({ data, children }) => {
  const [price, setPrice] = useState<string | number | undefined>();
  const isVerticalLayout = useIsVerticalLayout();
  const currentPrice = data[data.length - 1].value;
  let priceStringResult;
  if (price === 'undefined' || price === undefined) {
    priceStringResult = String(currentPrice);
  } else if (typeof price === 'string') {
    priceStringResult = price;
  } else {
    priceStringResult = String(price);
  }
  return isVerticalLayout ? (
    <>
      <PriceLabel price={priceStringResult} />
      <Box h="300px">
        <ChartView data={data} onHover={setPrice} />
      </Box>
      {children}
    </>
  ) : (
    <>
      <Box flexDirection="row" justifyContent="space-between">
        <PriceLabel price={priceStringResult} />
        <Box w="280px">{children}</Box>
      </Box>
      <Box h="300px">
        <ChartView data={data} onHover={setPrice} />
      </Box>
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
