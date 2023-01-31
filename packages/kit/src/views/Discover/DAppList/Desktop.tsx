import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { StyleSheet, useWindowDimensions } from 'react-native';

import {
  Box,
  CustomSkeleton,
  FlatList,
  Pressable,
  Skeleton,
  Typography,
} from '@onekeyhq/components';

import { useTranslation } from '../../../hooks';
import { Chains } from '../Chains';
import DAppIcon from '../DAppIcon';
import { useTagDapps } from '../hooks';

import type { DAppItemType, DAppListProps } from '../type';
import type { ListRenderItem } from 'react-native';

const styles = StyleSheet.create({
  container: {
    paddingTop: 32,
    paddingBottom: 32,
  },
});

const ItemSeparatorComponentH3 = () => <Box h="3" />;

const ItemSeparatorComponentH8 = () => <Box h="8" />;

const ListEmptyComponentRenderItem = () => {
  const { width } = useWindowDimensions();
  const screenWidth = width - 270 - 48;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;
  const data = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8], []);

  const renderItem: ListRenderItem<number> = useCallback(
    () => (
      <Box
        width={cardWidth}
        maxWidth={cardWidth}
        minWidth={cardWidth}
        height={156}
        paddingX="2"
        justifyContent="center"
        alignItems="center"
      >
        <Pressable
          bgColor="surface-default"
          flexDirection="column"
          borderRadius="12px"
          padding="4"
          width={cardWidth - 16}
          height={144}
          borderWidth={1}
          _hover={{ bgColor: 'surface-hovered' }}
          borderColor="border-subdued"
        >
          <Box flexDirection="row" mb="3">
            <Box w="12" h="12" overflow="hidden" borderRadius={12}>
              <CustomSkeleton />
            </Box>
            <Box ml="3">
              <Skeleton shape="Body1" />
              <Skeleton shape="Caption" />
            </Box>
          </Box>
          <Box h="4" w="full" mb="2" borderRadius={8} overflow="hidden">
            <CustomSkeleton />
          </Box>
          <Box h="3" w="80%" borderRadius={6} overflow="hidden">
            <CustomSkeleton />
          </Box>
        </Pressable>
      </Box>
    ),
    [cardWidth],
  );

  const flatList = useMemo(
    () => (
      <FlatList
        paddingLeft="24px"
        data={data}
        renderItem={renderItem}
        numColumns={numColumns}
        removeClippedSubviews
        windowSize={5}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => `${item}`}
        key={`key${numColumns}`}
        ItemSeparatorComponent={ItemSeparatorComponentH3}
      />
    ),
    [data, numColumns, renderItem],
  );
  return <Box width="100%">{flatList}</Box>;
};

export const EmptySkeleton = () => (
  <FlatList
    contentContainerStyle={{
      paddingBottom: 24,
      paddingTop: 24,
    }}
    data={[1, 2]}
    renderItem={() => <ListEmptyComponentRenderItem />}
    keyExtractor={(item) => String(item)}
    ItemSeparatorComponent={ItemSeparatorComponentH8}
  />
);

export const Desktop: FC<DAppListProps> = ({ ...rest }) => {
  const { tagId, onItemSelect } = rest;
  const data = useTagDapps(tagId);
  const t = useTranslation();
  const { width } = useWindowDimensions();
  const screenWidth = width - 72 - 256;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => (
      <Box
        width={cardWidth}
        maxWidth={cardWidth}
        minWidth={cardWidth}
        height={156}
        paddingX="2"
        justifyContent="center"
        alignItems="center"
      >
        <Pressable
          bgColor="surface-default"
          flexDirection="column"
          borderRadius="12px"
          padding="4"
          width={cardWidth - 16}
          height={144}
          borderWidth={1}
          _hover={{ bgColor: 'surface-hovered' }}
          borderColor="border-subdued"
          onPress={() => {
            if (onItemSelect) {
              onItemSelect(item);
            }
          }}
        >
          <Box flexDirection="row">
            <DAppIcon
              size={48}
              url={item.logoURL}
              networkIds={item.networkIds}
            />
            <Box ml="3" flex="1">
              <Typography.Body2Strong numberOfLines={1} mb="1" flex="1">
                {item.name}
              </Typography.Body2Strong>
              <Chains networkIds={item.networkIds} />
            </Box>
          </Box>
          <Typography.Caption
            mt="3"
            numberOfLines={2}
            textAlign="left"
            color="text-subdued"
          >
            {t(item._subtitle) ?? item.subtitle}
          </Typography.Caption>
        </Pressable>
      </Box>
    ),
    [cardWidth, onItemSelect, t],
  );

  const flatList = useMemo(
    () => (
      <FlatList
        contentContainerStyle={styles.container}
        paddingLeft="24px"
        data={data}
        renderItem={renderItem}
        numColumns={numColumns}
        keyExtractor={(item, index) => `${numColumns}key${index}${item?._id}`}
        key={`key${numColumns}`}
        ListEmptyComponent={EmptySkeleton}
      />
    ),
    [data, numColumns, renderItem],
  );
  return (
    <Box width="100%" height="100%">
      {flatList}
    </Box>
  );
};
