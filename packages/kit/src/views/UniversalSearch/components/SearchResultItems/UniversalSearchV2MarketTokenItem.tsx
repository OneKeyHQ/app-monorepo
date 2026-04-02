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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useMarketWatchListV2Atom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import {
  StockSourceLogo,
  SubtitleBadge,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { TokenTagsPopover } from '@onekeyhq/kit/src/views/Market/components/TokenTagsPopover';
import { useToDetailPage } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ECopyFrom,
  EEnterWay,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EUniversalSearchPages } from '@onekeyhq/shared/src/routes/universalSearch';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import { formatTokenSymbolForDisplay } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IUniversalSearchV2MarketToken } from '@onekeyhq/shared/types/search';

import { MarketStarV2 } from '../../../Market/components/MarketStarV2';
import { MarketTokenIcon } from '../../../Market/components/MarketTokenIcon';
import { BaseMarketTokenPrice } from '../../../Market/components/MarketTokenPrice';
import { MARKET_DATA_COLUMN_WIDTH } from '../MarketTableHeader';

import {
  formatContractAddress,
  shouldRenderContractAddress,
} from './utils/contractAddress';

export function ContractAddress({
  address,
  compact,
}: {
  address: string;
  compact?: boolean;
}) {
  const { copyText } = useClipboard();
  const contractAddress = formatContractAddress(address);

  if (!address) {
    return null;
  }

  const textSize = compact ? '$bodyXs' : '$bodyMd';
  const iconSize = compact ? '$3' : '$4';
  const gap = compact ? '$0.5' : '$1';

  return (
    <XStack ai="center" gap={gap}>
      <SizableText size={textSize} color="$textSubdued">
        {contractAddress}
      </SizableText>
      <IconButton
        variant="tertiary"
        size="small"
        iconSize={iconSize}
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
  isTrending?: boolean;
}

export function UniversalSearchV2MarketTokenItem({
  item,
  isTrending,
}: IUniversalSearchMarketTokenItemProps) {
  // Ensure market watch list atom is initialized
  const [{ isMounted }] = useMarketWatchListV2Atom();
  const { gtMd } = useMedia();
  const appNavigation = useAppNavigation();
  const universalSearchActions = useUniversalSearchActions();
  const toMarketDetailPage = useToDetailPage({
    switchToMarketTabFirst: true,
    from: EEnterWay.Search,
  });

  const {
    logoUrl,
    logoUrls,
    price,
    symbol,
    name,
    address,
    network,
    liquidity,
    // eslint-disable-next-line camelcase
    volume_24h,
    volume24h: volume24hCamel,
    priceChange24hPercent,
    isNative,
    communityRecognized,
    stock,
  } = item.payload;

  // When network is empty, the item was converted from IMarketToken (trending/legacy)
  // and address contains coingeckoId for legacy navigation
  // eslint-disable-next-line camelcase
  const volume24h = volume24hCamel || volume_24h;

  const isLegacyNavigation = !network;
  const isContractAddressVisible = shouldRenderContractAddress({
    address,
    isLegacyNavigation,
  });

  // Hide favorite button in extension popup and side panel
  const shouldShowFavoriteButton = useMemo(
    () =>
      !platformEnv.isExtensionUiPopup && !platformEnv.isExtensionUiSidePanel,
    [],
  );

  const handlePress = useCallback(() => {
    if (isLegacyNavigation) {
      // Legacy trending item: address contains coingeckoId, use legacy navigation
      setTimeout(async () => {
        appNavigation.push(EUniversalSearchPages.MarketDetail, {
          token: address,
        });
        defaultLogger.market.token.searchToken({
          tokenSymbol: symbol,
          from: 'trendingList',
        });
      }, 80);
    } else {
      rootNavigationRef.current?.goBack();
      setTimeout(async () => {
        void toMarketDetailPage({
          tokenAddress: address,
          networkId: network,
          symbol,
          isNative,
        });

        defaultLogger.market.token.searchToken({
          tokenSymbol: symbol,
          from: isTrending ? 'trendingList' : 'searchList',
        });

        if (!isTrending && symbol?.trim()) {
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
    }
  }, [
    isLegacyNavigation,
    isTrending,
    address,
    network,
    symbol,
    isNative,
    universalSearchActions,
    item.type,
    toMarketDetailPage,
    appNavigation,
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
      <XStack flex={1} minWidth={0} gap="$1" ai="center">
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
          <MarketTokenIcon
            uri={logoUrl}
            uris={logoUrls}
            size="sm"
            networkId={network}
          />
          <YStack flex={1} minWidth={0}>
            <XStack ai="center" gap="$1" minWidth={0}>
              <SizableText
                size="$bodyMdMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {formatTokenSymbolForDisplay(symbol)}
              </SizableText>
              {gtMd ? (
                <>
                  <StockSourceLogo stock={stock} />
                  {communityRecognized ? <CommunityRecognizedBadge /> : null}
                </>
              ) : (
                <TokenTagsPopover
                  communityRecognized={communityRecognized}
                  stock={stock}
                />
              )}
              {stock?.subtitle ? (
                <SubtitleBadge subtitle={stock.subtitle} />
              ) : null}
            </XStack>
            <XStack ai="center" gap="$0.5" minWidth={0}>
              {name ? (
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                  minWidth={0}
                  flexShrink={1}
                  maxWidth={isContractAddressVisible ? '52%' : '100%'}
                >
                  {name}
                </SizableText>
              ) : null}
              {isContractAddressVisible ? (
                <>
                  {name ? (
                    <SizableText size="$bodySm" color="$textSubdued">
                      |
                    </SizableText>
                  ) : null}
                  <ContractAddress address={address} compact />
                </>
              ) : null}
            </XStack>
          </YStack>
        </XStack>
      </XStack>

      <XStack flexShrink={0} ai="center">
        {/* PRICE / 24H column */}
        <YStack w={MARKET_DATA_COLUMN_WIDTH} ai="flex-end">
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
