import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  SegmentControl,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
  useTabBarHeight,
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
  isFetching: boolean;
  height: number;
}

function NativeTokenPriceChart({ coinGeckoId, height, defer }: IChartProps) {
  const intl = useIntl();
  const [points, setPoints] = useState<IMarketTokenChart>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { md } = useMedia();
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
    if (md) {
      setTimeout(() => {
        defer.resolve(null);
      }, 100);
    } else {
      await defer.promise;
    }
    setPoints(response);
    setIsLoading(false);
  }, [coinGeckoId, days, defer, md]);

  useEffect(() => {
    void init();
  }, [init]);
  const { gtLg } = useMedia();
  return (
    <>
      <YStack px="$5" $gtMd={{ pr: platformEnv.isNative ? '$5' : 0 }}>
        <YStack>
          <PriceChart height={height} isFetching={isLoading} data={points}>
            {gtLg && !isLoading ? (
              <SegmentControl
                value={days}
                onChange={setDays as ISegmentControlProps['onChange']}
                options={options}
              />
            ) : null}
          </PriceChart>
        </YStack>
      </YStack>
      {gtLg ? null : (
        <XStack
          gap="$3"
          ai="center"
          px="$5"
          $platform-web={{ zIndex: 30 }}
          position="absolute"
          top={height - 48}
          width="100%"
        >
          <SegmentControl
            fullWidth
            value={days}
            jc="space-between"
            flex={1}
            onChange={setDays as ISegmentControlProps['onChange']}
            options={options}
          />
        </XStack>
      )}
    </>
  );
}

const useHeight = () => {
  const { height } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const { gtMd } = useMedia();

  const tabHeight = useTabBarHeight();
  const fixedHeight = useMemo(() => {
    if (platformEnv.isNativeIOS) {
      return 268;
    }

    if (platformEnv.isNativeAndroid) {
      return 258;
    }

    return 300;
  }, []);
  return useMemo(
    () => (gtMd ? 450 : height - top - tabHeight - fixedHeight),
    [fixedHeight, gtMd, height, tabHeight, top],
  );
};
function TradingViewChart({
  targetToken,
  identifier,
  baseToken,
  defer,
  height,
}: Omit<ITradingViewProps, 'mode'> & {
  defer: IDeferredPromise<unknown>;
}) {
  useEffect(() => {
    defer.resolve(null);
  }, [defer]);

  return (
    <TradingView
      mode="overview"
      h={height}
      $gtMd={{ pl: '$5' }}
      $md={{ pt: '$3' }}
      targetToken={targetToken}
      baseToken={baseToken}
      identifier={identifier}
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
  'kucoin',
];

const targets = ['USD', 'USDT', 'USDC'];
const resolveIdentifierName = (name: string) => {
  if (name === 'gate') {
    return 'GATEIO';
  }
  return name;
};

const TICKER_MAP = {
  'tether': {
    identifier: 'COINBASE',
    baseToken: 'USDT',
    targetToken: 'USD',
  },
  'usd-coin': {
    identifier: 'KRAKEN',
    baseToken: 'USDC',
    targetToken: 'USD',
  },
};

function BasicTokenPriceChart({
  coinGeckoId,
  defer,
  tickers,
  isFetching,
}: Omit<IChartProps, 'height'>) {
  const ticker = useMemo(() => {
    if (!tickers?.length) {
      return null;
    }

    const item = TICKER_MAP[coinGeckoId as keyof typeof TICKER_MAP];
    if (item) {
      return item;
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
  }, [coinGeckoId, tickers]);

  const viewHeight = useHeight();

  if (isFetching) {
    return (
      <Stack
        h={viewHeight}
        w="100%"
        alignContent="center"
        justifyContent="center"
      >
        <Spinner size="large" />
      </Stack>
    );
  }

  return ticker ? (
    <TradingViewChart
      defer={defer}
      height={viewHeight}
      identifier={ticker?.identifier}
      baseToken={ticker?.baseToken}
      targetToken={ticker?.targetToken}
    />
  ) : (
    <NativeTokenPriceChart
      height={viewHeight}
      isFetching={isFetching}
      coinGeckoId={coinGeckoId}
      defer={defer}
    />
  );
}

export const TokenPriceChart = memo(BasicTokenPriceChart);
