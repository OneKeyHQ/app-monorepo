import React, { useState } from 'react';

import { useIntl } from 'react-intl';

import ChartView from './ChartView';
import PriceLabel from './PriceLabel';

type ChartWithLabelProps = {
  data: any[];
};

const ChartWithLabel: React.FC<ChartWithLabelProps> = ({ data }) => {
  const intl = useIntl();
  const [price, setPrice] = useState<string | number | undefined>();
  const currentPrice = 0;
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
      <ChartView data={data} onHover={setPrice} />
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
