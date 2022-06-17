import React, { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import PriceLabel from './PriceLabel';
import TradingView from './TradingView';

type PriceChartProps = {
  data: any[];
};

const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  const intl = useIntl();
  return (
    <>
      <PriceLabel />
      <TradingView data={data} />
    </>
  );
};
PriceChart.displayName = 'PriceChart';
export default PriceChart;
