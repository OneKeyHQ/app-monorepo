import React, { useState } from 'react';

import { Box } from '@onekeyhq/components';

import ChartView from './ChartView';
import PriceLabel from './PriceLabel';

type ChartWithLabelProps = {
  data: Array<{ time: string; value: number }>;
};

const ChartWithLabel: React.FC<ChartWithLabelProps> = ({ data }) => {
  const [price, setPrice] = useState<string | number | undefined>();

  const currentPrice = data[data.length - 1].value;
  let priceStringResult;
  if (price === 'undefined' || price === undefined) {
    priceStringResult = String(currentPrice);
  } else if (typeof price === 'string') {
    priceStringResult = price;
  } else {
    priceStringResult = String(price);
  }
  return (
    <>
      <PriceLabel price={priceStringResult} />
      <Box h="300px">
        <ChartView data={data} onHover={setPrice} />
      </Box>
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
