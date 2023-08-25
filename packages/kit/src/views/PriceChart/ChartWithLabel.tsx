import { useCallback, useMemo, useState } from 'react';
import type { FC, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Box, Empty, Spinner, useIsVerticalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useFormatDate from '../../hooks/useFormatDate';

import ChartView from './ChartView';
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
  const intl = useIntl();

  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState('');
  const isVerticalLayout = useIsVerticalLayout();
  const basePrice = data?.length ? data[0][1] : 0;
  const latestPrice = data?.length ? data[data.length - 1][1] : 0;
  const currentPrice = useMemo(() => {
    if (!data) {
      return null;
    }
    if (price === 'undefined' || price === undefined) {
      return latestPrice;
    }
    if (typeof price === 'string') {
      return +price;
    }
    return price;
  }, [data, latestPrice, price]);

  const onHover = useCallback<OnHoverFunction>(
    (hoverData) => {
      // The first data of each hover is an empty string, which needs to be filtered
      if (hoverData.price === '' && hoverData.time === '') {
        return;
      }
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

  const emptyView = useMemo(() => {
    if (isFetching) {
      return <Spinner />;
    }
    return (
      <Empty
        emoji="📊"
        title={intl.formatMessage({
          id: 'empty__no_data',
        })}
        subTitle={intl.formatMessage({
          id: 'content__data_for_this_token_is_not_included_yet',
        })}
      />
    );
  }, [intl, isFetching]);

  const chartView =
    data && data.length > 0 ? (
      <ChartView
        isFetching={isFetching}
        height={isVerticalLayout ? 190 : 240}
        data={data}
        onHover={onHover}
      />
    ) : (
      emptyView
    );

  const chartViewWithSpinner = isFetching ? <Spinner /> : chartView;
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
        <Box w="280px">{data ? children : null}</Box>
      </Box>
      <Box h="240px" mt="32px" justifyContent="center" alignItems="center">
        {chartViewWithSpinner}
      </Box>
    </>
  );
};
ChartWithLabel.displayName = 'ChartWithLabel';
export default ChartWithLabel;
