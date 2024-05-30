import { useCallback, useEffect, useMemo, useState } from 'react';

import { CommonActions } from '@react-navigation/native';
import * as ExpoSharing from 'expo-sharing';

import {
  HeaderIconButton,
  Image,
  NavBackButton,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
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
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { OpenInAppButton } from '../../components/OpenInAppButton';
import useAppNavigation from '../../hooks/useAppNavigation';

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
  pools,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
  pools: IMarketDetailPool[];
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
    <YStack $gtMd={{ maxWidth: 336 }} px="$5">
      <XStack ai="center">
        <YStack flex={1}>
          <SizableText size="$headingMd" color="$textSubdued">
            {name}
          </SizableText>
          <NumberSizeableText
            pt="$2"
            size="$heading3xl"
            formatterOptions={{ currency: '$' }}
            formatter="price"
          >
            {currentPrice || 0}
          </NumberSizeableText>
          <PriceChangePercentage pt="$0.5">
            {performance.priceChangePercentage24h}
          </PriceChangePercentage>
        </YStack>
        <MarketStar coingeckoId={coinGeckoId} mr="$-2" />
      </XStack>
      {gtMd ? (
        <MarketDetailOverview token={token} pools={pools} />
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

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  const { icon, coinGeckoId, symbol } = route.params;
  const [isLoading, setIsLoading] = useState(true);
  const [tokenDetail, setTokenDetail] = useState<
    IMarketTokenDetail | undefined
  >();
  const [pools, setPools] = useState<IMarketDetailPool[]>([]);

  const { gtMd } = useMedia();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const responseToken =
      await backgroundApiProxy.serviceMarket.fetchTokenDetail(coinGeckoId);
    const responsePools = await backgroundApiProxy.serviceMarket.fetchPools(
      responseToken.symbol,
    );
    setTokenDetail(responseToken);
    setPools(responsePools);
    setIsLoading(false);
  }, [coinGeckoId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const renderHeaderTitle = useCallback(
    () => (
      <XStack space="$2" $gtMd={{ ml: '$4' }}>
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

  const renderHeaderLeft = useCallback(
    () => (
      <NavBackButton
        onPress={() => {
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
        }}
      />
    ),
    [navigation],
  );

  const tokenDetailHeader = useMemo(
    () =>
      tokenDetail ? (
        <TokenDetailHeader
          coinGeckoId={coinGeckoId}
          token={tokenDetail}
          pools={pools}
        />
      ) : null,
    [coinGeckoId, pools, tokenDetail],
  );

  const tokenPriceChart = useMemo(
    () => <TokenPriceChart coinGeckoId={coinGeckoId} />,
    [coinGeckoId],
  );

  if (!tokenDetail) {
    return null;
  }
  return (
    <Page scrollEnabled>
      <Page.Header
        disableClose
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
        headerLeft={renderHeaderLeft}
      />
      <Page.Body>
        {gtMd ? (
          <YStack>
            <Stack
              flexDirection="column"
              $gtMd={{ flexDirection: 'row', pt: '$5' }}
              $md={{ space: '$5', pt: '$3' }}
            >
              {tokenDetailHeader}
              <YStack flex={1}>
                {tokenPriceChart}
                <TokenDetailTabs token={tokenDetail} pools={pools} />
              </YStack>
            </Stack>
          </YStack>
        ) : (
          <TokenDetailTabs
            token={tokenDetail}
            pools={pools}
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
