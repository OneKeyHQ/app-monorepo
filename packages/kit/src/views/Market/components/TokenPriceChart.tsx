import { memo, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl, Stack, YStack, useMedia } from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { PriceChart } from './Chart';

// TODO: Use a simple cache to prevent re-rendering.
const cacheMap = new Map<string, [IMarketTokenChart, number]>();

function BasicTokenPriceChart({ coinGeckoId }: { coinGeckoId: string }) {
  const intl = useIntl();
  const [points, setPoints] = useState<IMarketTokenChart>([]);
  const [isLoading, setIsLoading] = useState(false);
  const options = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.market_1d }),
        value: '1',
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1w }),
        value: '7',
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1m }),
        value: '30',
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1y }),
        value: '365',
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_all }),
        value: 'max',
      },
    ],
    [intl],
  );
  const [days, setDays] = useState<string>(options[0].value);

  useEffect(() => {
    const key = [coinGeckoId, days, 100].join('-');
    const item = cacheMap.get(key);
    if (item) {
      const [cachedResponse] = item;
      setPoints(cachedResponse);
    }
    setIsLoading(!item);
    void backgroundApiProxy.serviceMarket
      .fetchTokenChart(coinGeckoId, days, 100)
      .then((response) => {
        setPoints(response);
        cacheMap.set(key, [response, Date.now()]);
        for (const pair of cacheMap) {
          const [cacheKey, value] = pair;
          const now = Date.now();
          const minute = timerUtils.getTimeDurationMs({ minute: 1 });
          const [, timestamp] = value;
          if (now - timestamp > minute) {
            cacheMap.delete(cacheKey);
          }
        }
        setIsLoading(false);
      });
  }, [coinGeckoId, days]);
  const { gtMd } = useMedia();
  return (
    <YStack px="$5">
      <YStack h={platformEnv.isNative ? 240 : 326} $gtMd={{ h: 298 }}>
        <PriceChart isFetching={isLoading} data={points}>
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
