import React, { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import ChartControl from './ChartControl';
import ChartWithLabel from './ChartWithLabel';

type PriceChartProps = {
  data: any[];
};

const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  const intl = useIntl();
  return (
    <>
      <ChartWithLabel data={data} />
      <ChartControl />
    </>
  );
};
PriceChart.displayName = 'PriceChart';
export default PriceChart;
