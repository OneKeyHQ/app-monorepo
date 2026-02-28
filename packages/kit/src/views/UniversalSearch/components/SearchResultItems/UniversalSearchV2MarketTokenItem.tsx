import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  IconButton,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
  rootNavigationRef,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import { useToDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ECopyFrom,
  EEnterWay,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IUniversalSearchV2MarketToken } from '@onekeyhq/shared/types/search';
import { ESearchStatus } from '@onekeyhq/shared/types/search';

import { MARKET_DATA_COLUMN_WIDTH, MARKET_NAME_COLUMN_WIDTH } from '../MarketTableHeader';
import { MarketStarV2 } from '../../../Market/components/MarketStarV2';
import { MarketTokenIcon } from '../../../Market/components/MarketTokenIcon';
import { BaseMarketTokenPrice } from '../../../Market/components/MarketTokenPrice';

export function ContractAddress({ address }: { address: string }) {
  const { copyText } = useClipboard();
  const contractAddress = accountUtils.shortenAddress({
    address,
    leadingLength: 6,
    trailingLength: 4,
  });

  if (!address) {
    return null;
  }

  return (
    <XStack ai="center" gap="$1">
      <SizableText size="$bodyMd" color="$textSubdued">
        {contractAddress}
      </SizableText>
      <IconButton
        variant="tertiary"
        size="small"
        iconSize="$4"
        icon="Copy3Outline"
        onPress={() => {
          defaultLogger.dex.actions.dexCopyCA({
            copyFrom: ECopyFrom.Search,
            copiedContent: address,
          });
          copyText(address);
        }}
      />
    </XStack>
  );
}

export function MarketTokenLiquidity({
  liquidity,
  volume24h,
}: {
  liquidity: string;
  volume24h: string;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const displayLiquidity = useMemo(
    () => BigNumber(liquidity).gt(0),
    [liquidity],
  );
  const displayVolume24h = useMemo(
    () => gtMd && BigNumber(volume24h).gt(0),
    [volume24h, gtMd],
  );
  return (
    <XStack>
      {displayLiquidity ? (
        <XStack ai="center" gap="$1">
          <SizableText color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.dexmarket_search_result_liq,
            })}
          </SizableText>
          <NumberSizeableText
            color="$textSubdued"
            formatter="marketCap"
            formatterOptions={{ capAtMaxT: true }}
          >
            {liquidity}
          </NumberSizeableText>
        </XStack>
      ) : null}
      {displayLiquidity && displayVolume24h ? (
        <SizableText color="$textSubdued" px="$1">
          •
        </SizableText>
      ) : null}
      {displayVolume24h ? (
        <XStack ai="center" gap="$1">
          <SizableText color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.dexmarket_search_result_vol,
            })}
          </SizableText>
          <NumberSizeableText
            color="$textSubdued"
            formatter="marketCap"
            formatterOptions={{ capAtMaxT: true }}
          >
            {volume24h}
          </NumberSizeableText>
        </XStack>
      ) : null}
    </XStack>
  );
}

interface IUniversalSearchMarketTokenItemProps {
  item: IUniversalSearchV2MarketToken;
  searchStatus: ESearchStatus;
}

export function UniversalSearchV2MarketTokenItem({
  item,
  searchStatus,
}: IUniversalSearchMarketTokenItemProps) {
  // Ensure market watch list atom is initialized
  const [{ isMounted }] = useMarketWatchListV2Atom();
  const { gtMd } = useMedia();
  const universalSearchActions = useUniversalSearchActions();
  const toMarketDetailPage = useToDetailPage({
    switchToMarketTabFirst: true,
    from: EEnterWay.Search,
  });
  const {
    logoUrl,
    price,
    symbol,
    name,
    address,
    network,
    liquidity,
    volume_24h,
    volume24h: volume24hCamel,
    priceChange24hPercent,
    isNative,
    communityRecognized,
  } = item.payload;

  const volume24h = volume24hCamel || volume_24h;

  // Hide favorite button in extension popup and side panel
  const shouldShowFavoriteButton = useMemo(
    () =>
      !platformEnv.isExtensionUiPopup && !platformEnv.isExtensionUiSidePanel,
    [],
  );

  const handlePress = useCallback(() => {
    rootNavigationRef.current?.goBack();
    setTimeout(async () => {
      // Use toMarketDetailPage hook for navigation
      void toMarketDetailPage({
        tokenAddress: address,
        networkId: network,
        symbol,
        isNative,
      });

      defaultLogger.market.token.searchToken({
        tokenSymbol: symbol,
        from:
          searchStatus === ESearchStatus.init ? 'trendingList' : 'searchList',
      });

      // Only add to recent search list when not in trending section and symbol is not empty
      if (searchStatus !== ESearchStatus.init && symbol?.trim()) {
        setTimeout(() => {
          universalSearchActions.current.addIntoRecentSearchList({
            id: address,
            text: symbol,
            type: item.type,
            timestamp: Date.now(),
          });
        }, 10);
      }
    }, 80);
  }, [
    address,
    network,
    symbol,
    isNative,
    searchStatus,
    universalSearchActions,
    item.type,
    toMarketDetailPage,
  ]);

  if (!isMounted) {
    return null;
  }

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      gap="$3"
      alignSelf="stretch"
      py="$2"
      px="$3"
      mx="$2"
      minHeight="$11"
      borderRadius="$3"
      borderCurve="continuous"
      overflow="hidden"
      onPress={handlePress}
      {...listItemPressStyle}
    >
      {/* # + NAME column */}
      <XStack w={MARKET_NAME_COLUMN_WIDTH} gap="$1" ai="center" flexShrink={0}>
        <XStack w="$8" ai="center" jc="center">
          {shouldShowFavoriteButton ? (
            <MarketStarV2
              chainId={network}
              contractAddress={address}
              from={EWatchlistFrom.Search}
              tokenSymbol={symbol}
              size="small"
              isNative={isNative}
            />
          ) : null}
        </XStack>
        <XStack ai="center" gap="$2" flex={1} minWidth={0}>
          <MarketTokenIcon uri={logoUrl} size="sm" networkId={network} />
          <YStack flex={1} minWidth={0}>
            <XStack ai="center" gap="$1" minWidth={0}>
              <SizableText
                size="$bodyMdMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {symbol}
              </SizableText>
              {communityRecognized ? <CommunityRecognizedBadge /> : null}
            </XStack>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
            >
              {name}
            </SizableText>
          </YStack>
        </XStack>
      </XStack>

      <XStack flex={1} minWidth={0}>
        {/* PRICE / 24H column */}
        <YStack
          w={gtMd ? MARKET_DATA_COLUMN_WIDTH : undefined}
          flex={gtMd ? undefined : 1}
          ai="flex-end"
        >
          <BaseMarketTokenPrice
            price={price}
            size="$bodyMd"
            tokenName={name}
            tokenSymbol={symbol}
          />
          {priceChange24hPercent ? (
            <NumberSizeableText
              size="$bodySm"
              formatter="priceChange"
              color={
                Number(priceChange24hPercent) >= 0
                  ? '$textSuccess'
                  : '$textCritical'
              }
              formatterOptions={{ showPlusMinusSigns: true }}
            >
              {priceChange24hPercent}
            </NumberSizeableText>
          ) : null}
        </YStack>

        {/* LIQUIDITY column - desktop only */}
        {gtMd ? (
          <XStack w={MARKET_DATA_COLUMN_WIDTH} jc="flex-end" ai="center">
            <NumberSizeableText
              size="$bodyMd"
              formatter="marketCap"
              formatterOptions={{ capAtMaxT: true }}
            >
              {BigNumber(liquidity).gt(0) ? liquidity : '--'}
            </NumberSizeableText>
          </XStack>
        ) : null}

        {/* VOLUME 24H column - desktop only */}
        {gtMd ? (
          <XStack w={MARKET_DATA_COLUMN_WIDTH} jc="flex-end" ai="center">
            <NumberSizeableText
              size="$bodyMd"
              formatter="marketCap"
              formatterOptions={{ capAtMaxT: true }}
            >
              {BigNumber(volume24h).gt(0) ? volume24h : '--'}
            </NumberSizeableText>
          </XStack>
        ) : null}
      </XStack>
    </Stack>
  );
}
