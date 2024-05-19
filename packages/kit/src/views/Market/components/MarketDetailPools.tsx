import { useEffect, useState } from 'react';

import {
  Button,
  IconButton,
  ListView,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function MarketDetailPools({
  token: { id },
}: {
  token: IMarketTokenDetail;
}) {
  const [pools, setPools] = useState<IMarketDetailPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    void backgroundApiProxy.serviceMarket
      .fetchPools('ETH', 'eth')
      .then((response) => {
        setPools(response);
        setIsLoading(false);
      });
  }, []);
  return (
    <ListView
      data={pools}
      ListHeaderComponent={
        <XStack>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            Pair
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            price
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            24H Txns
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            24H Volume
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            Liquidity
          </SizableText>
        </XStack>
      }
      renderItem={({
        item: { attributes, relationships },
      }: {
        item: IMarketDetailPool;
      }) => (
        <XStack>
          <YStack>
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {attributes.name}
            </SizableText>

            <SizableText size="$bodySmMedium" color="$textSubdued">
              {relationships.dex.data.id}
            </SizableText>
          </YStack>
          <NumberSizeableText
            formatter="price"
            formatterOptions={{ currency: '$' }}
          >
            {attributes.base_token_price_usd}
          </NumberSizeableText>
          <NumberSizeableText formatter="marketCap">
            {String(attributes.transactions.h24.buyers)}
          </NumberSizeableText>
          <NumberSizeableText formatter="marketCap">
            {attributes.volume_usd.h24}
          </NumberSizeableText>
        </XStack>
      )}
    />
  );
}
