import { useCallback, useEffect, useMemo, useState } from 'react';

import { CommonActions, StackActions } from '@react-navigation/native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  NavBackButton,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  View,
  XStack,
  YStack,
  useDeferredPromise,
  useIsOverlayPage,
  useMedia,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabMarketParamList } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { MarketDetailOverview } from '../components/MarketDetailOverview';
import { MarketTokenIcon } from '../components/MarketTokenIcon';
import { MarketTokenPrice } from '../components/MarketTokenPrice';
import { MarketTradeButton } from '../components/MarketTradeButton';
import { PriceChangePercentage } from '../components/PriceChangePercentage';
import { TokenDetailTabs } from '../components/TokenDetailTabs';
import { TokenPriceChart } from '../components/TokenPriceChart';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

/**
 * Displays the header section for a market token detail view, including token name, price, price change, watchlist star, and trade button.
 *
 * Fetches and updates token details at regular intervals, and conditionally renders a market overview for larger screens.
 *
 * @param coinGeckoId - The CoinGecko identifier for the token.
 * @param token - The initial token detail data to display before fetching updates.
 * @returns The rendered header UI for the token detail screen.
 */
function TokenDetailHeader({
  coinGeckoId,
  token: responseToken,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
}) {
  const { gtMd: gtMdMedia } = useMedia();

  const isModalPage = useIsOverlayPage();

  const {
    activeAccount: { account },
  } = useActiveAccount({
    num: 0,
  });

  const gtMd = isModalPage ? false : gtMdMedia;

  const { result: token } = usePromiseResult(
    () => backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(coinGeckoId),
    [coinGeckoId],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 45 }),
      initResult: responseToken,
    },
  );
  const {
    name,
    symbol,
    stats: { performance, currentPrice, lastUpdated },
  } = token;
  return (
    <YStack
      px="$5"
      $md={{ minHeight: 150 }}
      {...(isModalPage ? { minHeight: 150 } : null)}
    >
      <YStack flex={1}>
        <SizableText size="$headingMd" color="$textSubdued">
          {name}
        </SizableText>
        <XStack ai="center" jc="space-between" pt="$2">
          <MarketTokenPrice
            size="$heading3xl"
            price={currentPrice}
            tokenName={name}
            tokenSymbol={symbol}
            lastUpdated={lastUpdated}
          />
        </XStack>
        <PriceChangePercentage pt="$0.5" width="100%">
          {performance.priceChangePercentage24h}
        </PriceChangePercentage>
      </YStack>
      <MarketTradeButton
        coinGeckoId={coinGeckoId}
        token={token}
        accountId={account?.id ?? ''}
      />
      {gtMd ? <MarketDetailOverview token={token} /> : null}
    </YStack>
  );
}

function SkeletonHeader() {
  return (
    <YStack>
      <Skeleton w="$24" h="$4" />
      <View pt="$5" pb="$3.5">
        <Skeleton w="$40" h="$7" />
      </View>
      <Skeleton w="$24" h="$3" />
    </YStack>
  );
}

function SkeletonHeaderOverItemItem() {
  return (
    <YStack gap="$2" flexGrow={1} flexBasis={0}>
      <Skeleton w="$10" h="$3" />
      <Skeleton w="$24" h="$3" />
    </YStack>
  );
}

/**
 * Displays the detailed market information screen for a specific token.
 *
 * Fetches and presents token details, price chart, and related tabs. Adapts layout for modal and responsive contexts, supports pull-to-refresh, and provides sharing and navigation actions.
 */
function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  const { token: coinGeckoId } = route.params;
  const { gtMd: gtMdMedia } = useMedia();

  const isModalPage = useIsOverlayPage();

  const gtMd = isModalPage ? false : gtMdMedia;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [tokenDetail, setTokenDetail] = useState<
    IMarketTokenDetail | undefined
  >(undefined);

  const fetchMarketTokenDetail = useCallback(async () => {
    const response =
      await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
        coinGeckoId,
      );
    setTokenDetail(response);
  }, [coinGeckoId]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMarketTokenDetail();
    setIsRefreshing(false);
  }, [fetchMarketTokenDetail]);

  useEffect(() => {
    void fetchMarketTokenDetail();
  }, [fetchMarketTokenDetail]);

  const renderHeaderTitle = useCallback(
    () => (
      <XStack gap="$2">
        <MarketTokenIcon uri={tokenDetail?.image || ''} size="sm" />
        <SizableText>{tokenDetail?.symbol?.toUpperCase()}</SizableText>
      </XStack>
    ),
    [tokenDetail?.image, tokenDetail?.symbol],
  );

  const navigation = useAppNavigation();

  const popPage = useCallback(() => {
    navigation.dispatch((state) => {
      if (state.routes.length > 1) {
        return StackActions.pop(state.routes.length);
      }
      return CommonActions.reset({
        index: 0,
        routes: [
          {
            name: ETabMarketRoutes.TabMarket,
          },
        ],
      });
    });
  }, [navigation]);

  const renderHeaderLeft = useCallback(
    () => <NavBackButton onPress={popPage} />,
    [popPage],
  );

  const tokenDetailHeader = useMemo(() => {
    if (tokenDetail) {
      return (
        <TokenDetailHeader coinGeckoId={coinGeckoId} token={tokenDetail} />
      );
    }
    return (
      <YStack px="$5">
        {gtMd ? (
          <YStack gap="$12" width={392}>
            <SkeletonHeader />
            <YStack gap="$3">
              <Skeleton w={252} h="$3" />
            </YStack>
            <YStack gap="$6">
              <XStack>
                <SkeletonHeaderOverItemItem />
                <SkeletonHeaderOverItemItem />
              </XStack>
              <XStack>
                <SkeletonHeaderOverItemItem />
                <SkeletonHeaderOverItemItem />
              </XStack>
              <XStack>
                <SkeletonHeaderOverItemItem />
                <SkeletonHeaderOverItemItem />
              </XStack>
            </YStack>
            <YStack gap="$6">
              <Skeleton w="$10" h="$3" />
              <Skeleton w={252} h="$3" />
              <Skeleton w={252} h="$3" />
              <Skeleton w={252} h="$3" />
            </YStack>
          </YStack>
        ) : (
          <YStack gap="$6" pt="$1">
            <SkeletonHeader />
            <XStack>
              <SkeletonHeaderOverItemItem />
              <SkeletonHeaderOverItemItem />
              <SkeletonHeaderOverItemItem />
            </XStack>
          </YStack>
        )}
      </YStack>
    );
  }, [coinGeckoId, gtMd, tokenDetail]);

  const defer = useDeferredPromise();

  const tokenPriceChart = useMemo(
    () => (
      <TokenPriceChart
        isFetching={!tokenDetail}
        tickers={tokenDetail?.tickers}
        fallbackToChart={!!tokenDetail?.fallbackToChart}
        tvPlatform={tokenDetail?.tvPlatform}
        coinGeckoId={coinGeckoId}
        defer={defer}
        symbol={tokenDetail?.symbol}
      />
    ),
    [coinGeckoId, defer, tokenDetail],
  );

  return (
    <Page>
      <Page.Header
        headerTitle={renderHeaderTitle}
        headerLeft={renderHeaderLeft}
      />
      <Page.Body>
        {gtMd ? (
          <YStack flex={1}>
            <XStack flex={1} pt="$5">
              <ScrollView minWidth={392} maxWidth={392}>
                {tokenDetailHeader}
              </ScrollView>
              <YStack flex={1}>
                <TokenDetailTabs
                  defer={defer}
                  token={tokenDetail}
                  coinGeckoId={coinGeckoId}
                  listHeaderComponent={tokenPriceChart}
                />
              </YStack>
            </XStack>
          </YStack>
        ) : (
          <TokenDetailTabs
            defer={defer}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh}
            token={tokenDetail}
            coinGeckoId={coinGeckoId}
            listHeaderComponent={tokenDetailHeader}
          />
        )}
      </Page.Body>
    </Page>
  );
}

export default function MarketDetailWithProvider(
  props: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>,
) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirror
        storeName={EJotaiContextStoreNames.marketWatchList}
      >
        <MarketDetail {...props} />
      </MarketWatchListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
