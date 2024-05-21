import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  HeaderIconButton,
  Icon,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  Tab,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IPageScreenProps } from '@onekeyhq/components';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import type {
  IMarketDetailPool,
  IMarketToken,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import { MarketDetailOverview } from './components/MarketDetailOverview';
import { MarketHomeHeader } from './components/MarketHomeHeader';
import { MarketHomeHeader as MDMarketHomeHeader } from './components/MarketHomeHeader.md';
import { MarketHomeHeaderSearchBar } from './components/MarketHomeHeaderSearchBar';
import { TextCell } from './components/TextCell';
import { TokenDetailTabs } from './components/TokenDetailTabs';
import { TokenPriceChart } from './components/TokenPriceChart';

function TokenDetailHeader({
  token,
  pools,
}: {
  token: IMarketTokenDetail;
  pools: IMarketDetailPool[];
}) {
  const {
    name,
    price,
    stats: { performance, volume24h, marketCap, marketCapRank, fdv },
  } = token;
  const { gtMd } = useMedia();
  return (
    <YStack $gtMd={{ maxWidth: 296 }}>
      <XStack>
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
            {price || 0}
          </NumberSizeableText>
          <NumberSizeableText
            pt="$0.5"
            formatter="priceChange"
            formatterOptions={{ showPlusMinusSigns: true }}
            color={
              Number(performance.priceChangePercentage24h) > 0
                ? '$textSuccess'
                : '$textCritical'
            }
          >
            {performance.priceChangePercentage24h}
          </NumberSizeableText>
        </YStack>
        <Icon name="StarOutline" size="$5" />
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
  // const { result: tokenDetail } = usePromiseResult(
  //   async () => ,
  //   [coinGeckoId],
  // );

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
      responseToken.name,
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
      <XStack space="$2">
        <Image
          width="$6"
          height="$6"
          borderRadius="100%"
          src={decodeURIComponent(tokenDetail?.image || icon || '')}
        />
        <SizableText>
          {(tokenDetail?.symbol || symbol)?.toUpperCase()}
        </SizableText>
      </XStack>
    ),
    [icon, symbol, tokenDetail?.image, tokenDetail?.symbol],
  );
  const renderHeaderRight = useCallback(
    () => (
      <XStack space="$10" ai="center">
        <HeaderIconButton icon="ShareOutline" />
        {gtMd ? <MarketHomeHeaderSearchBar /> : null}
      </XStack>
    ),
    [gtMd],
  );

  if (!tokenDetail) {
    return null;
  }

  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
      />
      <YStack px="$5">
        <Stack
          flexDirection="column"
          $gtMd={{ flexDirection: 'row' }}
          space="$5"
        >
          <TokenDetailHeader token={tokenDetail} pools={pools} />
          <YStack flex={1}>
            <TokenPriceChart coinGeckoId={coinGeckoId} />
            <TokenDetailTabs token={tokenDetail} pools={pools} />
          </YStack>
        </Stack>
      </YStack>
    </Page>
  );
}

export default MarketDetail;
