import { useCallback, useMemo } from 'react';

import {
  HeaderIconButton,
  Icon,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
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
  IMarketToken,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import { MarketHomeHeader } from './components/MarketHomeHeader';
import { MarketHomeHeader as MDMarketHomeHeader } from './components/MarketHomeHeader.md';
import { MarketHomeHeaderSearchBar } from './components/MarketHomeHeaderSearchBar';

function TokenDetailHeader({
  token: {
    stats: { performance },
  },
}: {
  token: IMarketTokenDetail;
}) {
  return (
    <XStack ai="center" jc="space-between" px="$5">
      <YStack>
        <SizableText size="$headingMd" color="$textSubdued">
          Ethereum
        </SizableText>
        <NumberSizeableText
          size="$heading3xl"
          formatterOptions={{ currency: '$', showPlusMinusSigns: true }}
          formatter="price"
        >
          2963.6
        </NumberSizeableText>
        <NumberSizeableText
          formatter="priceChange"
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
  );
}

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  const { icon, coinGeckoId, symbol } = route.params;
  const { result: tokenDetail } = usePromiseResult(
    async () => backgroundApiProxy.serviceMarket.fetchTokenDetail(coinGeckoId),
    [coinGeckoId],
  );

  const { gtMd } = useMedia();

  const renderHeaderTitle = useCallback(
    () => (
      <XStack space="$2">
        <Image
          width="$6"
          height="$6"
          borderRadius="100%"
          src={decodeURIComponent(icon || '')}
        />
        <SizableText>{symbol?.toUpperCase()}</SizableText>
      </XStack>
    ),
    [icon, symbol],
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
    <Page>
      <Page.Header
        headerTitle={renderHeaderTitle}
        headerRight={renderHeaderRight}
      />
      <TokenDetailHeader token={tokenDetail} />
    </Page>
  );
}

export default MarketDetail;
