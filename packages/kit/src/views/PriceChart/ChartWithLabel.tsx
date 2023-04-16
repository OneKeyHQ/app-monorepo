import type { FC, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { Box, Spinner, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useFormatDate from '../../hooks/useFormatDate';

import ChartView from './ChartView';
import SvgNoPriceData from './NoPriceData';
import PriceLabel from './PriceLabel';

import type { MarketApiData, OnHoverFunction } from './chartService';

type ChartWithLabelProps = {
  data: MarketApiData[] | null;
  timeDefaultLabel: string;
  children: ReactNode;
  isFetching: boolean;
  onPriceSubscribe?: (price: number) => void;
};

const ChartWithLabel: FC<ChartWithLabelProps> = ({
  data,
  isFetching,
  timeDefaultLabel,
  children,
  onPriceSubscribe,
}) => {
  const { formatDate } = useFormatDate();
  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState('');
  const isVerticalLayout = useIsVerticalLayout();
  const basePrice = data?.length ? data[0][1] : 0;
  const latestPrice = data?.length ? data[data.length - 1][1] : 0;
  let currentPrice;
  if (!data) {
    currentPrice = null;
  } else if (price === 'undefined' || price === undefined) {
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
        displayTime = '';
      }
      setTime(displayTime);
      setPrice(hoverData.price);
    },
    [formatDate],
  );
  const priceLabel = (
    <PriceLabel
      onPriceSubscribe={onPriceSubscribe}
      price={currentPrice}
      time={time || timeDefaultLabel}
      basePrice={basePrice}
    />
  );
  const chartView = data ? (
    <ChartView
      isFetching={isFetching}
      height={isVerticalLayout ? 190 : 240}
      data={data}
      onHover={onHover}
    />
  ) : (
    <SvgNoPriceData width="100%" height="100%" preserveAspectRatio="none" />
  );
  const chartViewWithSpinner =
    data && data.length === 0 ? <Spinner /> : chartView;
  return isVerticalLayout ? (
    <>
      {priceLabel}
      <Box h="190px" mt="24px" justifyContent="center" alignItems="center">
        {platformEnv.isNative ? chartView : chartViewWithSpinner}
      </Box>
      <Box mt="8px">{children}</Box>
    </>
  ) : (
    <>
      <Box flexDirection="row" justifyContent="space-between">
        {priceLabel}
        <Box w="280px">{children}</Box>
      </Box>
      <Box h="240px" mt="32px" justifyContent="center" alignItems="center">
        {chartViewWithSpinner}
      </Box>
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
