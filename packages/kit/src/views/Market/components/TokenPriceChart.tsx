import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { TouchableWithoutFeedback } from 'react-native';

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
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
    <>
      <YStack px="$5" $gtMd={{ pr: platformEnv.isNative ? '$5' : 0 }}>
        <YStack>
          <PriceChart isFetching={isLoading} data={points}>
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
          px="$1"
          pr="$5"
          $platform-web={{ zIndex: 30 }}
        >
          <SegmentControl
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

function TradingViewChart({
  targetToken,
  identifier,
  baseToken,
  defer,
}: Omit<ITradingViewProps, 'mode'> & {
  defer: IDeferredPromise<unknown>;
}) {
  const { gtMd } = useMedia();
  useEffect(() => {
    if (platformEnv.isNativeAndroid) {
      setTimeout(() => {
        defer.resolve(null);
      }, 450);
    } else {
      defer.resolve(null);
    }
  }, [defer]);
  const timerId = useRef<ReturnType<typeof setTimeout>>();
  const handlePressIn = useCallback(() => {
    if (!platformEnv.isNative) {
      return;
    }
    timerId.current = setTimeout(() => {
      appEventBus.emit(
        EAppEventBusNames.ChangeTokenDetailTabVerticalScrollEnabled,
        { enabled: false },
      );
    }, 50);
  }, []);

  const handlePressOut = useCallback(() => {
    if (!platformEnv.isNative) {
      return;
    }
    clearTimeout(timerId.current);
    setTimeout(() => {
      appEventBus.emit(
        EAppEventBusNames.ChangeTokenDetailTabVerticalScrollEnabled,
        { enabled: true },
      );
    }, 50);
  }, []);

  return (
    <TradingView
      mode="overview"
      h={450}
      $gtMd={{ pl: '$5' }}
      $md={{ pt: '$6' }}
      targetToken={targetToken}
      baseToken={baseToken}
      identifier={identifier}
      onTouchStart={handlePressIn}
      onTouchEnd={handlePressOut}
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

const targets = ['USD', 'USDT', 'USDC'];
const resolveIdentifierName = (name: string) => {
  if (name === 'gate') {
    return 'GATEIO';
  }
  return name;
};
function BasicTokenPriceChart({ coinGeckoId, defer, tickers }: IChartProps) {
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

  return ticker ? (
    <TradingViewChart
      defer={defer}
      identifier={ticker?.identifier}
      baseToken={ticker?.baseToken}
      targetToken={ticker?.targetToken}
    />
  ) : (
    <NativeTokenPriceChart coinGeckoId={coinGeckoId} defer={defer} />
  );
}

export const TokenPriceChart = memo(BasicTokenPriceChart);
