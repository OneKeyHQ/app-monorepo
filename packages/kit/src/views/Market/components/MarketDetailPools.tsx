import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { groupBy } from 'lodash';

import type { ISizableTextProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Icon,
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

import { listItemPressStyle } from '../../../components/ListItem';
import { NetworkAvatar } from '../../../components/NetworkAvatar';

import { MarketPoolIcon } from './MarketPoolIcon';
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
    <XStack space="$2" px="$5">
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
  pools,
}: {
  pools: IMarketDetailPool[];
}) {
  const { gtMd } = useMedia();
  const partitions = useMemo(() => groupBy(pools, 'onekeyNetworkId'), [pools]);
  const onekeyNetworkIds = useMemo(() => Object.keys(partitions), [partitions]);
  const [showAll, setIsShowAll] = useState<boolean[]>([]);
  const [index, selectIndex] = useState(0);
  const listData = useMemo(
    () => partitions[onekeyNetworkIds[index]],
    [index, onekeyNetworkIds, partitions],
  );
  const handleChange = useCallback((selectedIndex: number) => {
    selectIndex(selectedIndex);
  }, []);
  const isShowAllData = showAll[index] || listData.length < 6;
  return (
    <YStack pb="$2" pt="$5">
      <NetworkIdSelect
        options={onekeyNetworkIds}
        value={index}
        onChange={handleChange}
      />
      <ListView
        data={isShowAllData ? listData : listData.slice(0, 5)}
        estimatedItemSize={38}
        ListHeaderComponent={
          <XStack py="$2.5" px="$5">
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
        ListFooterComponent={
          isShowAllData ? null : (
            <Button
              my="$5"
              onPress={() => {
                setIsShowAll((prev) => {
                  prev[index] = true;
                  return prev.slice();
                });
              }}
            >
              View More
            </Button>
          )
        }
        renderItem={
          (({ item }: { item: IMarketDetailPool }) => {
            const { attributes, relationships } = item;
            return (
              <XStack
                px="$5"
                py="$2"
                {...listItemPressStyle}
                onPress={() => {
                  Dialog.confirm({
                    title: 'Pool Details',
                    renderContent: <PoolDetails item={item} />,
                  });
                }}
              >
                <ItemColumn>
                  <XStack space="$2.5" ai="center">
                    <MarketPoolIcon id={relationships.dex.data.id} />
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
                      {attributes.baseTokenPriceUsd}
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
                    {attributes.volumeUsd.h24}
                  </NumberSizeableText>
                </ItemColumn>
                <ItemColumn>
                  <NumberSizeableText
                    size="$bodyMd"
                    formatter="marketCap"
                    textAlign="right"
                  >
                    {attributes.reserveInUsd}
                  </NumberSizeableText>
                </ItemColumn>
                <View jc="center">
                  <Icon name="ChevronRightSmallOutline" size="$4" pl="$3" />
                </View>
              </XStack>
            );
          }) as any
        }
      />
    </YStack>
  );
}
