import { useCallback, useEffect, useMemo, useState } from 'react';

import { CommonActions, StackActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  HeaderIconButton,
  NavBackButton,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  View,
  XStack,
  YStack,
  useMedia,
  useShare,
} from '@onekeyhq/components';
import type { IPageScreenProps } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabMarketParamList } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { OpenInAppButton } from '../../components/OpenInAppButton';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useDeferredPromise } from '../../hooks/useDeferredPromise';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import { MarketDetailOverview } from './components/MarketDetailOverview';
import { MarketHomeHeaderSearchBar } from './components/MarketHomeHeaderSearchBar';
import { MarketStar } from './components/MarketStar';
import { MarketTokenIcon } from './components/MarketTokenIcon';
import { MarketTokenPrice } from './components/MarketTokenPrice';
import { PriceChangePercentage } from './components/PriceChangePercentage';
import { TextCell } from './components/TextCell';
import { TokenDetailTabs } from './components/TokenDetailTabs';
import { TokenPriceChart } from './components/TokenPriceChart';
import { buildMarketFullUrl } from './marketUtils';
import { MarketWatchListProviderMirror } from './MarketWatchListProviderMirror';

function TokenDetailHeader({
  coinGeckoId,
  token: responseToken,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
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
    stats: {
      performance,
      volume24h,
      marketCap,
      marketCapRank,
      fdv,
      currentPrice,
      lastUpdated,
    },
  } = token;
  return (
    <YStack px="$5" $md={{ minHeight: 150 }}>
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
          <MarketStar
            coingeckoId={coinGeckoId}
            mr="$-2"
            size="medium"
            from={EWatchlistFrom.details}
          />
        </XStack>
        <PriceChangePercentage pt="$0.5" width="100%">
          {performance.priceChangePercentage24h}
        </PriceChangePercentage>
      </YStack>
      {gtMd ? (
        <MarketDetailOverview token={token} />
      ) : (
        <XStack
          flex={1}
          ai="center"
          alignContent="stretch"
          flexWrap="wrap"
          gap="$5"
        >
          <TextCell
            title={intl.formatMessage({ id: ETranslations.market_24h_vol_usd })}
          >
            {volume24h || '-'}
          </TextCell>
          <TextCell
            title={intl.formatMessage({ id: ETranslations.global_market_cap })}
            rank={marketCapRank}
          >
            {marketCap || '-'}
          </TextCell>
          <TextCell
            title={intl.formatMessage({ id: ETranslations.global_fdv })}
          >
            {fdv || '-'}
          </TextCell>
        </XStack>
      )}
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

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  const { token: coinGeckoId } = route.params;
  const { gtMd } = useMedia();

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
        <MarketTokenIcon uri={tokenDetail?.image || ''} size="$6" />
        <SizableText>{tokenDetail?.symbol?.toUpperCase()}</SizableText>
      </XStack>
    ),
    [tokenDetail?.image, tokenDetail?.symbol],
  );
  const { shareText } = useShare();

  const buildDeepLinkUrl = useCallback(
    () =>
      uriUtils.buildDeepLinkUrl({
        path: EOneKeyDeepLinkPath.market_detail,
        query: {
          coinGeckoId,
        },
      }),
    [coinGeckoId],
  );

  const buildFullUrl = useCallback(
    async () => buildMarketFullUrl({ coinGeckoId }),
    [coinGeckoId],
  );

  const renderHeaderRight = useCallback(
    () => (
      <XStack gap="$6" ai="center">
        {!platformEnv.isExtensionUiPopup && !platformEnv.isNative ? (
          <OpenInAppButton
            buildDeepLinkUrl={buildDeepLinkUrl}
            buildFullUrl={buildFullUrl}
          />
        ) : null}
        <HeaderIconButton
          icon="ShareOutline"
          onPress={async () => {
            const url = buildMarketFullUrl({ coinGeckoId });
            await shareText(url);
          }}
        />
        {gtMd ? <MarketHomeHeaderSearchBar /> : null}
      </XStack>
    ),
    [buildDeepLinkUrl, buildFullUrl, coinGeckoId, gtMd, shareText],
  );

  const navigation = useAppNavigation();

  const popPage = useCallback(() => {
    navigation.dispatch((state) => {
      console.log(state);
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
        coinGeckoId={coinGeckoId}
        defer={defer}
        symbol={tokenDetail?.symbol}
      />
    ),
    [coinGeckoId, defer, tokenDetail?.symbol],
  );

  return (
    <Page>
      <Page.Header
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
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
            listHeaderComponent={
              <YStack>
                {tokenDetailHeader}
                {tokenDetail ? tokenPriceChart : null}
              </YStack>
            }
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
    <MarketWatchListProviderMirror
      storeName={EJotaiContextStoreNames.marketWatchList}
    >
      <MarketDetail {...props} />
    </MarketWatchListProviderMirror>
  );
}
