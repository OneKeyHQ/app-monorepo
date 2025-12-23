import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  AnimatePresence,
  SegmentControl,
  Spinner,
  Stack,
  XStack,
  YStack,
  useIsOverlayPage,
  useMedia,
  useSafeAreaInsets,
  useTabBarHeight,
} from '@onekeyhq/components';
import type {
  IDeferredPromise,
  ISegmentControlProps,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketDetailTicker,
  IMarketTokenChart,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { TradingView } from '../../../components/TradingView';

import { PriceChart } from './Chart';

import type { ITradingViewProps } from '../../../components/TradingView';

interface IChartProps {
  coinGeckoId: string;
  symbol?: string;
  defer: IDeferredPromise<unknown>;
  tickers?: IMarketDetailTicker[];
  isFetching: boolean;
  height: number;
}

function Loading() {
  return (
    <Stack flex={1} alignContent="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}

/**
 * Displays a price chart for a native token using CoinGecko data, with selectable time ranges and adaptive UI for different screen sizes and modal states.
 *
 * Fetches and renders historical price data for the specified token, allowing users to switch between multiple time intervals. The component adapts its layout and controls based on whether it is displayed in a modal or on larger screens. Resolves a deferred promise when loading is complete and invokes a callback upon chart load.
 *
 * @param onLoadEnd - Callback invoked when the chart finishes loading
 */
function NativeTokenPriceChart({
  coinGeckoId,
  height,
  defer,
  onLoadEnd,
}: IChartProps & { onLoadEnd: () => void }) {
  const intl = useIntl();
  const [points, setPoints] = useState<IMarketTokenChart>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { md: mdMedia } = useMedia();
  const isModalPage = useIsOverlayPage();
  const md = isModalPage ? true : mdMedia;

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
    onLoadEnd();
    setIsLoading(false);
  }, [coinGeckoId, days, defer, md, onLoadEnd]);

  useEffect(() => {
    void init();
  }, [init]);
  const { gtMd: gtMdMedia } = useMedia();
  const gtMd = isModalPage ? false : gtMdMedia;

  return (
    <>
      <Stack px="$5" $gtMd={{ pr: '$5' }}>
        <PriceChart height={height} isFetching={isLoading} data={points}>
          {gtMd && !isLoading ? (
            <SegmentControl
              value={days}
              onChange={setDays as ISegmentControlProps['onChange']}
              options={options}
            />
          ) : null}
        </PriceChart>
      </Stack>
      {gtMd ? null : (
        <XStack
          gap="$3"
          ai="center"
          px="$5"
          $platform-web={{ zIndex: 30 }}
          position="absolute"
          top={10}
          left={0}
          right={0}
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
  const isModalPage = useIsOverlayPage();
  const { height: windowHeight } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const { gtMd: gtMdMedia } = useMedia();
  const gtMd = isModalPage ? false : gtMdMedia;

  const height = useMemo(() => {
    if (isModalPage && gtMdMedia) {
      return 640;
    }
    return windowHeight;
  }, [isModalPage, gtMdMedia, windowHeight]);

  const tabHeight = useTabBarHeight();
  const fixedHeight = useMemo(() => {
    if (platformEnv.isNativeIOS) {
      return 268 + (isModalPage ? 68 : 0);
    }

    if (platformEnv.isNativeAndroid) {
      return 278;
    }

    return 300;
  }, [isModalPage]);
  return useMemo(
    () => (gtMd ? 450 : height - top - tabHeight - fixedHeight),
    [fixedHeight, gtMd, height, tabHeight, top],
  );
};
/**
 * Renders a TradingView chart in overview mode for the specified token pair and market identifier.
 *
 * Resolves the provided deferred promise on mount and calls `onLoadEnd` when the chart finishes loading. The chart layout adapts based on whether the page is a modal.
 */
function TradingViewChart({
  targetToken,
  identifier,
  baseToken,
  defer,
  height,
  onLoadEnd,
}: ITradingViewProps & {
  defer: IDeferredPromise<unknown>;
  onLoadEnd: () => void;
}) {
  useEffect(() => {
    defer.resolve(null);
  }, [defer]);

  const isModalPage = useIsOverlayPage();

  return (
    <TradingView
      h={height}
      $gtMd={{ pl: isModalPage ? 0 : '$5' }}
      $md={{ pt: '$3' }}
      targetToken={targetToken}
      baseToken={baseToken}
      identifier={identifier}
      onLoadEnd={onLoadEnd}
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
  fallbackToChart,
  tvPlatform,
}: Omit<IChartProps, 'height'> & {
  fallbackToChart: boolean;
  tvPlatform?: IMarketTokenDetail['tvPlatform'];
}) {
  const [showLoading, changeShowLoading] = useState(true);
  const onLoadEnd = useCallback(() => {
    changeShowLoading(false);
  }, []);
  const ticker = useMemo(() => {
    if (
      tvPlatform &&
      tvPlatform.baseToken &&
      tvPlatform.identifier &&
      tvPlatform.targetToken
    ) {
      return tvPlatform;
    }

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
  }, [coinGeckoId, tickers, tvPlatform]);

  const viewHeight = useHeight();

  const chart = useMemo(() => {
    if (isFetching) {
      return null;
    }
    if (fallbackToChart || !ticker) {
      return (
        <Stack flex={1}>
          <NativeTokenPriceChart
            height={viewHeight}
            isFetching={isFetching}
            coinGeckoId={coinGeckoId}
            defer={defer}
            onLoadEnd={onLoadEnd}
          />
        </Stack>
      );
    }

    if (ticker) {
      return (
        <TradingViewChart
          defer={defer}
          height={viewHeight}
          identifier={ticker?.identifier}
          baseToken={ticker?.baseToken}
          targetToken={ticker?.targetToken}
          onLoadEnd={onLoadEnd}
        />
      );
    }
  }, [
    coinGeckoId,
    defer,
    fallbackToChart,
    isFetching,
    onLoadEnd,
    ticker,
    viewHeight,
  ]);

  return (
    <>
      {chart}
      <AnimatePresence>
        {showLoading ? (
          <Stack
            bg="$bgApp"
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            opacity={1}
            flex={1}
            animation="quick"
            exitStyle={{
              opacity: 0,
            }}
          >
            <Loading />
          </Stack>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export const TokenPriceChart = memo(BasicTokenPriceChart);
