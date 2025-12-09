import { memo, useMemo } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import { MarketStarV2 } from '../../../Market/components/MarketStarV2';

interface ISwapProSearchTokenListItemProps {
  item: IMarketSearchV2Token & { networkLogoURI: string };
  onPress: (item: IMarketSearchV2Token & { networkLogoURI: string }) => void;
}

const SwapProSearchTokenListItem = ({
  item,
  onPress,
}: ISwapProSearchTokenListItemProps) => {
  const currencyInfo = useCurrency();
  const formatPrice = useMemo(() => {
    return numberFormat(item.price, {
      formatter: 'price',
      formatterOptions: { currency: currencyInfo.symbol },
    });
  }, [item.price, currencyInfo.symbol]);
  const formatLiq = useMemo(() => {
    return numberFormat(item.liquidity, {
      formatter: 'balance',
    });
  }, [item.liquidity]);
  return (
    <ListItem justifyContent="space-between" onPress={() => onPress(item)}>
      <XStack gap="$2">
        <Token
          tokenImageUri={item.logoUrl}
          networkImageUri={item.networkLogoURI}
        />
        <YStack>
          <SizableText size="$bodyLgMedium">{item.name}</SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {item.symbol}
          </SizableText>
        </YStack>
      </XStack>
      <XStack gap="$1.5">
        <YStack gap="$1">
          <SizableText textAlign="right" size="$bodyLgMedium">
            {formatPrice}
          </SizableText>
          <SizableText textAlign="right" size="$bodyMd" color="$textSubdued">
            {formatLiq}
          </SizableText>
        </YStack>
        <XStack justifyContent="center" alignItems="center">
          <MarketStarV2
            w="$10"
            h="$10"
            chainId={item.network}
            contractAddress={item.address}
            from={EWatchlistFrom.Search}
            tokenSymbol={item.symbol}
            size="small"
            isNative={item.isNative}
          />
        </XStack>
      </XStack>
    </ListItem>
  );
};

export default memo(SwapProSearchTokenListItem);
