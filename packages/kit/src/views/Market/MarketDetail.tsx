import { useCallback, useMemo } from 'react';


import {
  HeaderIconButton,
  Icon,
  Stack,
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
import { TextCell } from './components/TextCell';

function TokenDetailHeader({
  token: {
    stats: { performance, volume24h, marketCap, marketCapRank, fdv },
  },
}: {
  token: IMarketTokenDetail;
}) {
  const { gtMd } = useMedia();
  return (
    <YStack $gtMd={{ minWidth: 296 }}>
      <XStack>
        <YStack  flex={1}>
          <SizableText size="$headingMd" color="$textSubdued">
            Ethereum
          </SizableText>
          <NumberSizeableText
            pt="$2"
            size="$heading3xl"
            formatterOptions={{ currency: '$' }}
            formatter="price"
          >
            2963.6
          </NumberSizeableText>
          <NumberSizeableText
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
      {gtMd ? null : (
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

function DetailTokenChart() {
  return (
    <YStack width="100%" $gtMd={{ px: '$5' }}>
      <SizableText>chart</SizableText>
    </YStack>
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
      <YStack px="$5">
        <Stack
          flexDirection="column"
          $gtMd={{ flexDirection: 'row' }}
          space="$5"
        >
          <TokenDetailHeader token={tokenDetail} />
          <DetailTokenChart />
        </Stack>
      </YStack>
    </Page>
  );
}

export default MarketDetail;
