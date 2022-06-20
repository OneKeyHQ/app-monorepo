import React, { useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import ChartWithLabel from './ChartWithLabel';
import TimeControl from './TimeControl';

type PriceChartProps = {
  data: any[];
};

const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  const intl = useIntl();
  return (
    <>
      <ChartWithLabel data={data} />
      <TimeControl />
    </>
  );
};
PriceChart.displayName = 'PriceChart';
export default PriceChart;
