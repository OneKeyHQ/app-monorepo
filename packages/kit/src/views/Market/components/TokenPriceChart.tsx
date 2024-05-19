import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl, YStack } from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import type { ILocaleIds } from '@onekeyhq/shared/src/locale';
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

export function TokenPriceChart({ coinGeckoId }: { coinGeckoId: string }) {
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
  return (
    <YStack $gtMd={{ pl: '$5', flexGrow: 1 }}>
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
        <SegmentControl
          value={days}
          onChange={setDays as ISegmentControlProps['onChange']}
          options={options}
        />
      </PriceChart>
    </YStack>
  );
}
