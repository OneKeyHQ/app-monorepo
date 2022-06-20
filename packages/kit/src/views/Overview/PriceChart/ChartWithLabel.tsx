import React, { useState } from 'react';

import { useIntl } from 'react-intl';

import PriceLabel from './PriceLabel';
import ChartView from './ChartView';

type ChartWithLabelProps = {
  data: any[];
};

const ChartWithLabel: React.FC<ChartWithLabelProps> = ({ data }) => {
  const intl = useIntl();
  const [price, setPrice] = useState<number | undefined>(0);
  return (
    <>
      <PriceLabel price={price} />
      <ChartView data={data} onHover={setPrice} />
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
