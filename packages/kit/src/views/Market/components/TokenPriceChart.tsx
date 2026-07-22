import { memo, useEffect, useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  Spinner,
  Stack,
  useIsOverlayPage,
  useMedia,
  useSafeAreaInsets,
  useTabBarHeight,
} from '@onekeyhq/components';
import type { IDeferredPromise } from '@onekeyhq/components';
import {
  TradingViewNative,
  getTradingViewNativeSource,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketTestIDs } from '../testIDs';

import { useMarketTradeNetwork, useMarketTradeNetworkId } from './tradeHook';

interface ITokenPriceChartProps {
  coinGeckoId: string;
  defer: IDeferredPromise<unknown>;
  token?: IMarketTokenDetail;
}

function useChartLayout() {
  const isModalPage = useIsOverlayPage();
  const { height: windowHeight } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const { gtMd: gtMdMedia } = useMedia();
  const gtMd = isModalPage ? false : gtMdMedia;
  const tabHeight = useTabBarHeight();

  const height = useMemo(() => {
    const availableHeight = isModalPage && gtMdMedia ? 640 : windowHeight;
    let fixedHeight = 300;
    if (platformEnv.isNativeIOS) {
      fixedHeight = 268 + (isModalPage ? 68 : 0);
    } else if (platformEnv.isNativeAndroid) {
      fixedHeight = 278;
    }

    return gtMd ? 450 : availableHeight - top - tabHeight - fixedHeight;
  }, [gtMd, gtMdMedia, isModalPage, tabHeight, top, windowHeight]);

  return {
    fillAvailableHeight: platformEnv.isWeb && isModalPage,
    height,
    layoutMode: gtMd ? ('desktop' as const) : ('mobile' as const),
  };
}

function BasicTokenPriceChart({
  coinGeckoId,
  defer,
  token,
}: ITokenPriceChartProps) {
  const { fillAvailableHeight, height, layoutMode } = useChartLayout();
  const marketNetwork = useMarketTradeNetwork(token ?? null);
  const networkId = useMarketTradeNetworkId(marketNetwork, token?.symbol ?? '');
  const source = useMemo(
    () =>
      getTradingViewNativeSource({
        fallbackCoinGeckoId: coinGeckoId,
        hyperliquidCoin: '',
        marketDataSource: undefined,
        networkId: networkId ?? '',
        symbol: token?.symbol ?? '',
        tokenAddress: marketNetwork?.tokenAddress ?? '',
      }),
    [coinGeckoId, marketNetwork?.tokenAddress, networkId, token?.symbol],
  );

  useEffect(() => {
    defer.resolve(null);
  }, [defer]);

  return (
    <Stack
      flex={fillAvailableHeight ? 1 : undefined}
      h={fillAvailableHeight ? '100%' : height}
      minHeight={0}
      w="100%"
      overflow="hidden"
      bg="$bgApp"
    >
      {token ? (
        <TradingViewNative
          testID={MarketTestIDs.detailChart}
          source={source}
          enableNativeChartSettings={layoutMode === 'desktop'}
          nativeControlsLayoutMode={layoutMode}
        />
      ) : (
        <Stack flex={1} ai="center" jc="center">
          <Spinner size="large" />
        </Stack>
      )}
    </Stack>
  );
}

export const TokenPriceChart = memo(BasicTokenPriceChart);
