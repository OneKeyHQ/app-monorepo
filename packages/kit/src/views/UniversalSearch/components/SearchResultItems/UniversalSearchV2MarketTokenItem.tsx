import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  IconButton,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
  rootNavigationRef,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
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
    volume_24h: volume24h,
    isNative,
    communityRecognized,
  } = item.payload;

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
    <ListItem
      jc="space-between"
      onPress={handlePress}
      renderAvatar={
        <MarketTokenIcon uri={logoUrl} size="lg" networkId={network} />
      }
    >
      <ListItem.Text
        flex={1}
        primary={
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodyLgMedium">{symbol}</SizableText>
            {communityRecognized ? <CommunityRecognizedBadge /> : null}
          </XStack>
        }
        secondary={<ContractAddress address={address} />}
      />
      <XStack alignItems="center">
        <YStack alignItems="flex-end">
          <BaseMarketTokenPrice
            price={price}
            size="$bodyLgMedium"
            tokenName={name}
            tokenSymbol={symbol}
          />
          <MarketTokenLiquidity liquidity={liquidity} volume24h={volume24h} />
        </YStack>
        {shouldShowFavoriteButton ? (
          <MarketStarV2
            chainId={network}
            contractAddress={address}
            ml="$3"
            from={EWatchlistFrom.Search}
            tokenSymbol={symbol}
            size="medium"
            isNative={isNative}
          />
        ) : null}
      </XStack>
    </ListItem>
  );
}
