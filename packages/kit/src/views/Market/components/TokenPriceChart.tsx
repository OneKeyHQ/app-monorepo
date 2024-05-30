import { memo, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl, Stack, YStack, useMedia } from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import type { ILocaleIds } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { PriceChart } from './Chart';

const options = [
  {
    id: 'content__past_24_hours',
    label: '1D',
    value: '1',
  },
  {
    id: 'content__past_7_days',
    label: '1W',
    value: '7',
  },
  {
    id: 'content__past_month',
    label: '1M',
    value: '30',
  },
  {
    id: 'content__past_year',
    label: '1Y',
    value: '365',
  },
  {
    id: 'content__since_str',
    label: 'ALL',
    value: 'max',
  },
];

function BasicTokenPriceChart({ coinGeckoId }: { coinGeckoId: string }) {
  const [points, setPoints] = useState<IMarketTokenChart>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState<string>(options[0].value);
  const intl = useIntl();
  const intlId = options.find((v) => v.value === days)?.id as ILocaleIds;

  useEffect(() => {
    setIsLoading(true);
    void backgroundApiProxy.serviceMarket
      .fetchTokenChart(coinGeckoId, days, 100)
      .then((response) => {
        setPoints(response);
        setIsLoading(false);
      });
  }, [coinGeckoId, days]);
  const { gtMd } = useMedia();
  return (
    <YStack px="$5">
      <YStack h={platformEnv.isNative ? 240 : 326} $gtMd={{ pl: '$5', h: 346 }}>
        <PriceChart
          isFetching={isLoading}
          data={points}
          timeDefaultLabel={
            intlId
              ? intl.formatMessage(
                  {
                    id: intlId,
                  },
                  {
                    0: points?.[0]?.[0]
                      ? formatDate(new Date(points[0][0])).split(',')?.[0]
                      : '',
                  },
                )
              : ''
          }
        >
          {gtMd ? (
            <SegmentControl
              value={days}
              onChange={setDays as ISegmentControlProps['onChange']}
              options={options}
            />
          ) : null}
        </PriceChart>
      </YStack>
      {gtMd ? null : (
        <Stack mt={platformEnv.isNative ? -28 : '$5'}>
          <SegmentControl
            fullWidth
            value={days}
            onChange={setDays as ISegmentControlProps['onChange']}
            options={options}
          />
        </Stack>
      )}
    </YStack>
  );
}

export const TokenPriceChart = memo(BasicTokenPriceChart);
