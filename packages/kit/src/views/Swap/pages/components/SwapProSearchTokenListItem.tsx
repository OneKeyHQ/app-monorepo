import { memo, useMemo } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import { CommunityRecognizedBadge } from '../../../Market/components/CommunityRecognizedBadge';
import { MarketStarV2 } from '../../../Market/components/MarketStarV2';
import { MarketTokenIcon } from '../../../Market/components/MarketTokenIcon';
import { BaseMarketTokenPrice } from '../../../Market/components/MarketTokenPrice';
import {
  ContractAddress,
  MarketTokenLiquidity,
} from '../../../UniversalSearch/components/SearchResultItems';

interface ISwapProSearchTokenListItemProps {
  item: IMarketSearchV2Token & { networkLogoURI: string };
  onPress: (item: IMarketSearchV2Token & { networkLogoURI: string }) => void;
}

const SwapProSearchTokenListItem = ({
  item,
  onPress,
}: ISwapProSearchTokenListItemProps) => {
  const {
    logoUrl,
    network,
    symbol,
    name,
    address,
    isNative,
    communityRecognized,
    volume_24h: volume24h,
    liquidity,
    price,
  } = item;
  return (
    <ListItem
      jc="space-between"
      onPress={() => {
        onPress(item);
      }}
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
        <MarketStarV2
          chainId={network}
          contractAddress={address}
          ml="$3"
          from={EWatchlistFrom.Search}
          tokenSymbol={symbol}
          size="medium"
          isNative={isNative}
        />
      </XStack>
    </ListItem>
  );
};

export default memo(SwapProSearchTokenListItem);
