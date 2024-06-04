import type { PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';

import type { ISizableTextProps, ITabPageProps } from '@onekeyhq/components';
import {
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketResponsePool } from '@onekeyhq/shared/types/market';

import { listItemPressStyle } from '../../../components/ListItem';
import { NetworkAvatar } from '../../../components/NetworkAvatar';

import { MarketPoolIcon } from './MarketPoolIcon';
import { PoolDetailDialog } from './PoolDetailDialog';
import { useSortType } from './useSortType';

function HeaderColumn({
  name,
  children,
  jc,
  flexGrow = 3,
  sortType,
  onPress,
  order,
}: {
  name: string;
  jc: ISizableTextProps['jc'];
  children: ISizableTextProps['children'];
  flexGrow?: number;
  sortType?: string;
  onPress?: (key: string) => void;
  order?: 'asc' | 'desc' | '';
}) {
  const renderOrderIcon = useCallback(
    () =>
      sortType === name && order ? (
        <Icon
          cursor="pointer"
          name={
            order === 'desc'
              ? 'ChevronDownSmallOutline'
              : 'ChevronTopSmallOutline'
          }
          color="$iconSubdued"
          size="$4"
        />
      ) : null,
    [name, order, sortType],
  );
  const handlePress = useCallback(() => {
    onPress?.(name);
  }, [name, onPress]);
  return (
    <XStack
      flexGrow={flexGrow}
      flexBasis={0}
      ai="center"
      onPress={handlePress}
      jc={jc}
      cursor="pointer"
    >
      {jc === 'flex-end' ? renderOrderIcon() : null}
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {children}
      </SizableText>
      {jc === 'flex-start' ? renderOrderIcon() : null}
    </XStack>
  );
}

function ItemColumn({
  children,
  flexGrow = 3,
}: PropsWithChildren<{ flexGrow?: number }>) {
  return (
    <Stack flexGrow={flexGrow} flexBasis={0} jc="center">
      {children}
    </Stack>
  );
}

function HeaderRow({
  sortType,
  onSortTypeChange,
}: {
  sortType?: { columnName: string; order: 'asc' | 'desc' | undefined };
  onSortTypeChange?: (options: {
    columnName: string;
    order: 'asc' | 'desc' | undefined;
  }) => void;
}) {
  const { gtMd } = useMedia();
  const useSortFunc = !!(sortType || onSortTypeChange);
  const handleColumnPress = useCallback(
    (key: string) => {
      if (!useSortFunc) {
        return;
      }
      if (key === sortType?.columnName) {
        let order: 'asc' | 'desc' | undefined = 'desc';
        if (sortType?.order === 'desc') {
          order = 'asc';
        } else if (sortType?.order === 'asc') {
          order = undefined;
        }
        onSortTypeChange?.({
          columnName: key,
          order,
        });
        return;
      }
      onSortTypeChange?.({
        columnName: key,
        order: 'desc',
      });
    },
    [onSortTypeChange, sortType?.columnName, sortType?.order, useSortFunc],
  );
  return (
    <XStack py="$2.5" px="$5">
      <HeaderColumn
        name="dexDataName"
        jc="flex-start"
        flexGrow={5}
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
      >
        Pair
      </HeaderColumn>
      {gtMd ? (
        <HeaderColumn
          name="price"
          jc="flex-end"
          sortType={sortType?.columnName}
          order={sortType?.order}
          onPress={handleColumnPress}
        >
          Price
        </HeaderColumn>
      ) : null}
      {gtMd ? (
        <HeaderColumn
          name="txTotal"
          jc="flex-end"
          sortType={sortType?.columnName}
          order={sortType?.order}
          onPress={handleColumnPress}
        >
          24H Txns
        </HeaderColumn>
      ) : null}
      <HeaderColumn
        name="volumeUsdH24"
        jc="flex-end"
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
      >
        24H Volume
      </HeaderColumn>
      <HeaderColumn
        name="reserveInUsd"
        jc="flex-end"
        sortType={sortType?.columnName}
        order={sortType?.order}
        onPress={handleColumnPress}
      >
        Liquidity
      </HeaderColumn>
      <View flex={1}>
        <View w="$4" h="$4" />
      </View>
    </XStack>
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
    <XStack space="$2" px="$5" py="$2">
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
  // eslint-disable-next-line react/prop-types
  onContentSizeChange,
}: ITabPageProps & { pools: IMarketResponsePool[] }) {
  const { gtMd } = useMedia();
  const onekeyNetworkIds = useMemo(
    () => pools.map((i) => i.onekeyNetworkId),
    [pools],
  );
  const [index, selectIndex] = useState(0);
  const listData = useMemo(() => pools[index], [index, pools]);
  const formatListData = listData.data.map((i) => ({
    ...i,
    dexDataName: i.relationships.dex.data.id
      .split('_')
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' '),
    price: Number(i.attributes.baseTokenPriceUsd),
    txTotal: Number(
      i.attributes.transactions.h24.buys + i.attributes.transactions.h24.sells,
    ),
    volumeUsdH24: Number(i.attributes.volumeUsd.h24),
    reserveInUsd: Number(i.attributes.reserveInUsd),
  }));
  const handleChange = useCallback((selectedIndex: number) => {
    selectIndex(selectedIndex);
  }, []);

  const { sortedListData, handleSortTypeChange, sortByType } = useSortType(
    formatListData as Record<string, any>[],
    index,
  );
  return (
    <ListView
      data={sortedListData}
      estimatedItemSize={38}
      onContentSizeChange={onContentSizeChange}
      scrollEnabled={platformEnv.isWebTouchable}
      disableScrollViewPanResponder
      ListHeaderComponent={
        <YStack pb="$2" pt="$5">
          <NetworkIdSelect
            options={onekeyNetworkIds}
            value={index}
            onChange={handleChange}
          />
          <HeaderRow
            sortType={sortByType}
            onSortTypeChange={handleSortTypeChange}
          />
        </YStack>
      }
      extraData={index}
      renderItem={
        (({ item }: { item: (typeof formatListData)[0] }) => {
          const {
            attributes,
            dexLogoUrl,
            dexDataName,
            price,
            txTotal,
            volumeUsdH24,
            reserveInUsd,
          } = item;
          return (
            <XStack
              px="$5"
              py="$2"
              {...listItemPressStyle}
              onPress={() => {
                Dialog.confirm({
                  title: 'Pool Details',
                  renderContent: <PoolDetailDialog item={item} />,
                });
              }}
            >
              <ItemColumn flexGrow={5}>
                <XStack space="$2.5" ai="center">
                  <MarketPoolIcon uri={dexLogoUrl} />
                  <YStack flexShrink={1}>
                    <SizableText size="$bodyMdMedium" numberOfLines={1}>
                      {attributes.name}
                    </SizableText>
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                    >
                      {dexDataName}
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
                    {price}
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
                    {txTotal}
                  </NumberSizeableText>
                </ItemColumn>
              ) : null}
              <ItemColumn>
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="marketCap"
                  textAlign="right"
                >
                  {volumeUsdH24}
                </NumberSizeableText>
              </ItemColumn>
              <ItemColumn>
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="marketCap"
                  textAlign="right"
                >
                  {reserveInUsd}
                </NumberSizeableText>
              </ItemColumn>
              <View jc="center" ai="center" flex={1}>
                <Icon name="ChevronRightSmallOutline" size="$4" />
              </View>
            </XStack>
          );
        }) as any
      }
    />
  );
}
