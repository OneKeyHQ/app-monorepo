import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SegmentControl, Stack, YStack, useMedia } from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TradingView } from '../../../components/TradingView';

import { PriceChart } from './Chart';

import type { IDeferredPromise } from '../../../hooks/useDeferredPromise';

interface IChartProps {
  coinGeckoId: string;
  symbol?: string;
  defer: IDeferredPromise<unknown>;
}

function NativeTokenPriceChart({ coinGeckoId, defer }: IChartProps) {
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

  const init = useCallback(async () => {
    setIsLoading(true);
    const response = await backgroundApiProxy.serviceMarket.fetchTokenChart(
      coinGeckoId,
      days,
    );
    if (platformEnv.isNativeAndroid) {
      setTimeout(() => {
        defer.resolve(null);
      }, 100);
    } else {
      await defer.promise;
    }
    setPoints(response);
    setIsLoading(false);
  }, [coinGeckoId, days, defer]);

  useEffect(() => {
    void init();
  }, [init]);
  const { gtLg } = useMedia();
  return (
    <YStack px="$5" $gtMd={{ pr: platformEnv.isNative ? '$5' : 0 }}>
      <YStack h={platformEnv.isNative ? 240 : 326} $gtMd={{ h: 294 }}>
        <PriceChart isFetching={isLoading} data={points}>
          {gtLg ? (
            <SegmentControl
              value={days}
              onChange={setDays as ISegmentControlProps['onChange']}
              options={options}
            />
          ) : null}
        </PriceChart>
      </YStack>
      {gtLg ? null : (
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

function TradingViewChart({ symbol, defer }: IChartProps) {
  useEffect(() => {
    defer.resolve(null);
  }, [defer]);
  if (!symbol) {
    return null;
  }
  return (
    <TradingView
      mode="overview"
      symbol={symbol}
      $gtMd={{ h: 450 }}
      $md={{ px: '$4', pt: '$6' }}
      h={353}
    />
  );
}

function BasicTokenPriceChart({ coinGeckoId, defer, symbol }: IChartProps) {
  const [devSettings] = useDevSettingsPersistAtom();
  return devSettings.enabled && devSettings.settings?.showTradingView ? (
    <TradingViewChart coinGeckoId={coinGeckoId} defer={defer} symbol={symbol} />
  ) : (
    <NativeTokenPriceChart coinGeckoId={coinGeckoId} defer={defer} />
  );
}

export const TokenPriceChart = memo(BasicTokenPriceChart);
