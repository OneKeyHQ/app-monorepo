import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  ListView,
  NumberSizeableText,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { PoolDetails } from './PoolDetails';

function HeaderColumn({
  children,
  textAlign,
}: {
  textAlign: ISizableTextProps['textAlign'];
  children: ISizableTextProps['children'];
}) {
  return (
    <SizableText
      flexGrow={1}
      flexBasis={0}
      size="$bodySmMedium"
      color="$textSubdued"
      textAlign={textAlign}
    >
      {children}
    </SizableText>
  );
}

function ItemColumn({ children }: PropsWithChildren) {
  return (
    <Stack flexGrow={1} flexBasis={0} jc="center">
      {children}
    </Stack>
  );
}

export function MarketDetailPools({ token }: { token: IMarketTokenDetail }) {
  const [pools, setPools] = useState<IMarketDetailPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { gtMd } = useMedia();

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
        <XStack py="$2.5">
          <HeaderColumn textAlign="left">Pair</HeaderColumn>
          {gtMd ? <HeaderColumn textAlign="right">Price</HeaderColumn> : null}
          {gtMd ? (
            <HeaderColumn textAlign="right">24H Txns</HeaderColumn>
          ) : null}
          <HeaderColumn textAlign="right">24H Volume</HeaderColumn>
          <HeaderColumn textAlign="right">Liquidity</HeaderColumn>
          <Stack h="$4" w="$4" pl="$3" />
        </XStack>
      }
      renderItem={({ item }: { item: IMarketDetailPool }) => {
        const { attributes, relationships } = item;
        return (
          <XStack
            py="$2"
            onPress={() => {
              Dialog.confirm({
                title: 'Pool Details',
                renderContent: <PoolDetails item={item} />,
              });
            }}
          >
            <ItemColumn>
              <XStack space="$2.5" ai="center">
                <View>
                  <Icon name="TelegramBrand" size="$5" borderRadius="100%" />
                </View>
                <YStack flexShrink={1}>
                  <SizableText size="$bodySmMedium">
                    {attributes.name}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {relationships.dex.data.id}
                  </SizableText>
                </YStack>
              </XStack>
            </ItemColumn>

            {gtMd ? (
              <ItemColumn>
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="price"
                  formatterOptions={{ currency: '$' }}
                  textAlign="right"
                >
                  {attributes.base_token_price_usd}
                </NumberSizeableText>
              </ItemColumn>
            ) : null}
            {gtMd ? (
              <ItemColumn>
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="marketCap"
                  textAlign="right"
                >
                  {String(
                    attributes.transactions.h24.buys +
                      attributes.transactions.h24.sells,
                  )}
                </NumberSizeableText>
              </ItemColumn>
            ) : null}
            <ItemColumn>
              <NumberSizeableText
                size="$bodyMd"
                formatter="marketCap"
                textAlign="right"
              >
                {attributes.volume_usd.h24}
              </NumberSizeableText>
            </ItemColumn>
            <ItemColumn>
              <NumberSizeableText
                size="$bodyMd"
                formatter="marketCap"
                textAlign="right"
              >
                {attributes.reserve_in_usd}
              </NumberSizeableText>
            </ItemColumn>
            <View jc="center">
              <Icon name="ChevronRightSmallOutline" size="$4" pl="$3" />
            </View>
          </XStack>
        );
      }}
    />
  );
}
