import { useCallback, useMemo } from 'react';

import { type RouteProp, useRoute } from '@react-navigation/core';

import {
  Badge,
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  TradingViewNative,
  getTradingViewNativeSource,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';

import { MarketTestIDs } from '../../../Market/testIDs';

export default function MarketChart() {
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.MarketChart
      >
    >();
  const { networkId, networkName, symbol, tokenAddress, tokenImageUri } =
    route.params;
  const { gtMd } = useMedia();
  const { network } = useAccountData({ networkId });
  const resolvedNetworkName = networkName || network?.name || '';
  const source = useMemo(
    () =>
      getTradingViewNativeSource({
        hyperliquidCoin: '',
        marketDataSource: undefined,
        networkId,
        symbol,
        tokenAddress,
      }),
    [networkId, symbol, tokenAddress],
  );
  const renderHeaderTitle = useCallback(
    () => (
      <XStack alignItems="center" gap="$2">
        <Token
          size="sm"
          tokenImageUri={tokenImageUri}
          networkImageUri={!gtMd ? network?.logoURI : undefined}
          networkId={networkId}
        />
        <SizableText size="$headingLg" numberOfLines={1}>
          {symbol}
        </SizableText>
        {gtMd && resolvedNetworkName ? (
          <Badge badgeSize="sm">
            <Badge.Text>{resolvedNetworkName}</Badge.Text>
          </Badge>
        ) : null}
      </XStack>
    ),
    [
      gtMd,
      network?.logoURI,
      networkId,
      resolvedNetworkName,
      symbol,
      tokenImageUri,
    ],
  );

  return (
    <Page>
      <Page.Header headerTitle={renderHeaderTitle} />
      <Page.Body>
        <Stack flex={1} minHeight={0} overflow="hidden">
          <TradingViewNative
            testID={MarketTestIDs.detailChart}
            source={source}
            nativeControlsLayoutMode="mobile"
          />
        </Stack>
      </Page.Body>
    </Page>
  );
}
