import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SegmentControl,
  Select,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketDetailTicker,
  IMarketTokenChart,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TradingView } from '../../../components/TradingView';

import { PriceChart } from './Chart';

import type { ITradingViewProps } from '../../../components/TradingView';
import type { IDeferredPromise } from '../../../hooks/useDeferredPromise';

interface IChartProps {
  coinGeckoId: string;
  symbol?: string;
  defer: IDeferredPromise<unknown>;
  tickers?: IMarketDetailTicker[];
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

function TradingViewChart({
  targetToken,
  identifier,
  baseToken,
  defer,
}: Omit<ITradingViewProps, 'mode'> & {
  defer: IDeferredPromise<unknown>;
}) {
  useEffect(() => {
    defer.resolve(null);
  }, [defer]);
  return (
    <TradingView
      mode="overview"
      $gtMd={{ h: 450 }}
      $md={{ px: '$4', pt: '$6' }}
      targetToken={targetToken}
      baseToken={baseToken}
      identifier={identifier}
      h={353}
    />
  );
}

const identifiers = [
  'binance',
  'bybit',
  'mexc',
  'bitgit',
  'coinbase',
  'bitfinex',
  'kraken',
  'okx',
  'gate',
];

enum EChartType {
  tradingView = 'TradingView',
  liteChart = 'Lite Chart',
}

const targets = ['USD', 'USDT', 'USDC'];
const resolveIdentifierName = (name: string) => {
  if (name === 'gate') {
    return 'GATEIO';
  }
  return name;
};
function BasicTokenPriceChart({ coinGeckoId, defer, tickers }: IChartProps) {
  const [chartViewType, setChartViewType] = useState(EChartType.tradingView);
  const ticker = useMemo(() => {
    if (!tickers?.length) {
      return null;
    }
    for (let i = 0; i < tickers.length; i += 1) {
      const t = tickers[i];
      if (targets.includes(t.target)) {
        if (identifiers.includes(t.market.identifier)) {
          return {
            identifier: resolveIdentifierName(t.market.identifier),
            baseToken: t.base,
            targetToken: t.target,
          };
        }

        if (identifiers.includes(t.market.name.toLowerCase())) {
          return {
            identifier: t.market.name.toLowerCase(),
            baseToken: t.base,
            targetToken: t.target,
          };
        }
      }
    }
  }, [tickers]);

  if (!ticker) {
    return <NativeTokenPriceChart coinGeckoId={coinGeckoId} defer={defer} />;
  }
  return (
    <YStack>
      <Select
        items={[
          {
            value: EChartType.tradingView,
            label: EChartType.tradingView,
          },
          {
            value: EChartType.liteChart,
            label: EChartType.liteChart,
          },
        ]}
        value={chartViewType}
        onChange={setChartViewType}
        title="Chart"
        renderTrigger={({ label }) => (
          <XStack gap="$1" ai="center" $md={{ mx: '$4' }} $gtMd={{ pb: '$4' }}>
            <SizableText color="$textSubdued" size="$bodyMdMedium">
              {label}
            </SizableText>
            <Icon
              size="$5"
              name="ChevronDownSmallOutline"
              color="$iconSubdued"
            />
          </XStack>
        )}
      />
      {chartViewType === 'TradingView' ? (
        <TradingViewChart
          defer={defer}
          identifier={ticker?.identifier}
          baseToken={ticker?.baseToken}
          targetToken={ticker?.targetToken}
        />
      ) : (
        <NativeTokenPriceChart coinGeckoId={coinGeckoId} defer={defer} />
      )}
    </YStack>
  );
}

export const TokenPriceChart = memo(BasicTokenPriceChart);
