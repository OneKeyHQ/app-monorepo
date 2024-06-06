import { useCallback, useEffect, useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';
import * as ExpoSharing from 'expo-sharing';
import { BackHandler } from 'react-native';

import {
  HeaderIconButton,
  Image,
  NavBackButton,
  NumberSizeableText,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  View,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import type { IPageScreenProps } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import type { ITabMarketParamList } from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { OpenInAppButton } from '../../components/OpenInAppButton';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import { MarketDetailOverview } from './components/MarketDetailOverview';
import { MarketHomeHeaderSearchBar } from './components/MarketHomeHeaderSearchBar';
import { MarketStar } from './components/MarketStar';
import { PriceChangePercentage } from './components/PriceChangePercentage';
import { TextCell } from './components/TextCell';
import { TokenDetailTabs } from './components/TokenDetailTabs';
import { TokenPriceChart } from './components/TokenPriceChart';
import { buildMarketFullUrl } from './marketUtils';
import { MarketWatchListProviderMirror } from './MarketWatchListProviderMirror';

function TokenDetailHeader({
  coinGeckoId,
  token,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
}) {
  const {
    name,
    stats: {
      performance,
      volume24h,
      marketCap,
      marketCapRank,
      fdv,
      currentPrice,
    },
  } = token;
  const { gtMd } = useMedia();
  return (
    <YStack px="$5" $md={{ minHeight: 150 }}>
      <YStack flex={1}>
        <SizableText size="$headingMd" color="$textSubdued">
          {name}
        </SizableText>
        <XStack ai="center" jc="space-between" pt="$2">
          <NumberSizeableText
            size="$heading3xl"
            formatterOptions={{ currency: '$' }}
            formatter="price"
          >
            {currentPrice || 0}
          </NumberSizeableText>
          <MarketStar coingeckoId={coinGeckoId} mr="$-2" size="medium" />
        </XStack>
        <PriceChangePercentage pt="$0.5">
          {performance.priceChangePercentage24h}
        </PriceChangePercentage>
      </YStack>
      {gtMd ? (
        <MarketDetailOverview token={token} onContentSizeChange={() => {}} />
      ) : (
        <XStack pt="$6" flex={1} ai="center" jc="center" space="$2">
          <TextCell title="24H VOL(USD)">{volume24h}</TextCell>
          <TextCell title="Market Cap" rank={marketCapRank}>
            {marketCap}
          </TextCell>
          <TextCell title="FDV">{fdv}</TextCell>
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
    <YStack space="$2" flexGrow={1} flexBasis={0}>
      <Skeleton w="$10" h="$3" />
      <Skeleton w="$24" h="$3" />
    </YStack>
  );
}

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  const { icon, coinGeckoId, symbol } = route.params;
  const { gtMd } = useMedia();

  const { result: tokenDetail } = usePromiseResult(
    () => backgroundApiProxy.serviceMarket.fetchTokenDetail(coinGeckoId),
    [coinGeckoId],
  );

  const renderHeaderTitle = useCallback(
    () => (
      <XStack space="$2">
        <Image
          width="$6"
          height="$6"
          borderRadius="$full"
          src={decodeURIComponent(tokenDetail?.image || icon || '')}
        />
        <SizableText>
          {(tokenDetail?.symbol || symbol)?.toUpperCase()}
        </SizableText>
      </XStack>
    ),
    [icon, symbol, tokenDetail?.image, tokenDetail?.symbol],
  );
  const { copyText } = useClipboard();

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
    () => buildMarketFullUrl({ coinGeckoId }),
    [coinGeckoId],
  );

  const renderHeaderRight = useCallback(
    () => (
      <XStack space="$6" ai="center">
        {platformEnv.isNative ? null : (
          <OpenInAppButton
            buildDeepLinkUrl={buildDeepLinkUrl}
            buildFullUrl={buildFullUrl}
          />
        )}
        <HeaderIconButton
          icon="ShareOutline"
          onPress={async () => {
            const url = buildMarketFullUrl({ coinGeckoId });
            if (await ExpoSharing.isAvailableAsync()) {
              // https://docs.expo.dev/versions/latest/sdk/sharing/
              await ExpoSharing.shareAsync(url);
            } else {
              copyText(url);
            }
          }}
        />
        {gtMd ? <MarketHomeHeaderSearchBar /> : null}
      </XStack>
    ),
    [buildDeepLinkUrl, buildFullUrl, coinGeckoId, copyText, gtMd],
  );

  const navigation = useAppNavigation();

  const popPage = useCallback(() => {
    navigation.dispatch((state) => {
      console.log(state);
      if (state.routes.length > 1) {
        return CommonActions.goBack();
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
          <YStack space="$12" width={336}>
            <SkeletonHeader />
            <YStack space="$3">
              <Skeleton w={252} h="$3" />
            </YStack>
            <YStack space="$6">
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
            <YStack space="$6">
              <Skeleton w="$10" h="$3" />
              <Skeleton w={252} h="$3" />
              <Skeleton w={252} h="$3" />
              <Skeleton w={252} h="$3" />
            </YStack>
          </YStack>
        ) : (
          <YStack space="$6" pt="$1">
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

  const tokenPriceChart = useMemo(
    () => <TokenPriceChart coinGeckoId={coinGeckoId} />,
    [coinGeckoId],
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
              <ScrollView minWidth={336} maxWidth={336}>
                {tokenDetailHeader}
              </ScrollView>
              <YStack flex={1}>
                <TokenDetailTabs
                  token={tokenDetail}
                  listHeaderComponent={tokenPriceChart}
                />
              </YStack>
            </XStack>
          </YStack>
        ) : (
          <TokenDetailTabs
            token={tokenDetail}
            listHeaderComponent={
              <YStack>
                {tokenDetailHeader}
                {tokenPriceChart}
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
