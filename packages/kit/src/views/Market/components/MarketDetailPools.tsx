import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { partition } from 'lodash';

import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
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

import { NetworkAvatar } from '../../../components/NetworkAvatar';

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

function NetworkIdSelect({
  value,
  onChange,
  options,
}: {
  options: string[];
  value: number;
  onChange: (selectedIndex: number) => void;
}) {
  return (
    <XStack space="$2">
      {options.map((networkId, index) => (
        <Stack
          key={networkId}
          px="$3"
          py="$2"
          bg={value === index ? '$bgPrimary' : '$bgStrong'}
          borderRadius="$2"
          onPress={() => onChange(index)}
        >
          <NetworkAvatar networkId={networkId} size="$5" />
        </Stack>
      ))}
    </XStack>
  );
}

export function MarketDetailPools({
  token,
  pools,
}: {
  token: IMarketTokenDetail;
  pools: IMarketDetailPool[];
}) {
  const { gtMd } = useMedia();
  const partitions = partition(pools, 'onekeyNetworkId').filter(
    (i) => i.length > 0,
  );
  const onekeyNetworkIds = partitions.map((p) => p[0].onekeyNetworkId);

  const [index, selectIndex] = useState(0);
  const handleChange = useCallback((selectedIndex: number) => {
    selectIndex(selectedIndex);
  }, []);
  return (
    <YStack px="$5" pb="$2" pt="$5">
      <NetworkIdSelect
        options={onekeyNetworkIds}
        value={index}
        onChange={handleChange}
      />
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
                  {relationships.dex.data.id.includes('uniswap') ? (
                    <Icon
                      name="UniswapBrand"
                      size="$5"
                      borderRadius="100%"
                      color={'#ff007a' as IIconProps['color']}
                    />
                  ) : null}
                  <YStack flexShrink={1}>
                    <SizableText size="$bodySmMedium">
                      {attributes.name}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {relationships.dex.data.id
                        .split('_')
                        .map(
                          (word) =>
                            `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
                        )
                        .join(' ')}
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
    </YStack>
  );
}
