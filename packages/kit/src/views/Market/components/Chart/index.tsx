import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import ChartView from './ChartView';
import { PriceLabel } from './PriceLabel';

import type { BusinessDay, UTCTimestamp } from 'lightweight-charts';

type IPriceChartProps = {
  data?: IMarketTokenChart;
  timeDefaultLabel: string;
  children: ReactNode;
  isFetching: boolean;
};

type IOnHoverFunction = ({
  time,
  price,
}: {
  time?: UTCTimestamp | BusinessDay | Date | string;
  price?: number | string;
}) => void;

export function PriceChart({
  data,
  isFetching,
  timeDefaultLabel,
  children,
}: IPriceChartProps) {
  const { formatDate } = useFormatDate();
  const intl = useIntl();

  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState('');
  const { gtMd } = useMedia();
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

  const onHover = useCallback<IOnHoverFunction>(
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
      opacity={time ? 1 : 0}
      price={currentPrice}
      time={time || timeDefaultLabel}
      basePrice={basePrice}
    />
  );

  const emptyView = useMemo(() => {
    if (isFetching) {
      return <Spinner $platform-native={{ mt: -190 }} />;
    }
    return (
      <Empty
        title={intl.formatMessage({
          id: 'empty__no_data',
        })}
      />
    );
  }, [intl, isFetching]);

  const chartView =
    data && data.length > 0 ? (
      <ChartView
        isFetching={isFetching}
        height={gtMd ? 298 : 326}
        data={data}
        onHover={onHover}
      />
    ) : (
      emptyView
    );

  const chartViewWithSpinner = isFetching ? <Spinner /> : chartView;
  return gtMd ? (
    <>
      <XStack justifyContent="space-between">
        {isFetching ? (
          <YStack space="$2">
            <Skeleton w="$10" h="$3" />
            <Skeleton w="$24" h="$3" />
          </YStack>
        ) : (
          priceLabel
        )}
        {children}
      </XStack>
      <Stack
        h={240}
        mt={32}
        $gtMd={{ mt: '$1' }}
        justifyContent="center"
        alignItems="center"
      >
        {chartViewWithSpinner}
      </Stack>
    </>
  ) : (
    <>
      {priceLabel}
      <Stack
        h={190}
        mt={platformEnv.isNative ? 68 : 24}
        justifyContent="center"
        alignItems="center"
      >
        {platformEnv.isNative ? chartView : chartViewWithSpinner}
      </Stack>
      <Stack mt={8}>{children}</Stack>
    </>
  );
}
