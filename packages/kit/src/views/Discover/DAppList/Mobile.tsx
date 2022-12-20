import type { FC } from 'react';
import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  Box,
  CustomSkeleton,
  FlatList,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import DAppIcon from '../DAppIcon';
import { useTagDapps } from '../hooks';

import type { DAppItemType, DAppListProps } from '../type';
import type { ListRenderItem } from 'react-native';

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingBottom: 24,
  },
});

const EmptySkeleton = () => (
  <FlatList
    contentContainerStyle={styles.container}
    data={[1, 2, 3, 4, 5]}
    renderItem={() => (
      <Box px="4" w="full" flexDirection="row" alignItems="center">
        <Box w="12" h="12" borderRadius={12} mr="3" overflow="hidden">
          <CustomSkeleton />
        </Box>
        <Box flex="1">
          <Box h="4" borderRadius={8} mb="3" overflow="hidden">
            <CustomSkeleton />
          </Box>
          <Box h="3" borderRadius={6} overflow="hidden" width="70%">
            <CustomSkeleton />
          </Box>
        </Box>
      </Box>
    )}
    showsVerticalScrollIndicator={false}
    keyExtractor={(item) => String(item)}
    ItemSeparatorComponent={() => <Box h="8" />}
  />
);

export const Mobile: FC<DAppListProps> = ({ ...rest }) => {
  const { onItemSelect, tagId } = rest;
  const data = useTagDapps(tagId);
  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => {
          onItemSelect?.(item);
        }}
      >
        <Box width="full" mb="5">
          <Box flexDirection="row" flex={1} alignItems="center">
            <DAppIcon
              size={48}
              url={item.logoURL}
              networkIds={item.networkIds}
            />
            <Box flexDirection="column" ml="12px" flex={1}>
              <Typography.Body2Strong flex="1" numberOfLines={1}>
                {item.name}
              </Typography.Body2Strong>
              <Typography.Caption
                color="text-subdued"
                mt="4px"
                numberOfLines={1}
              >
                {item.subtitle}
              </Typography.Caption>
            </Box>
          </Box>
        </Box>
      </Pressable>
    ),
    [onItemSelect],
  );
  return (
    <Box flex="1" bg="background-default">
      <FlatList
        contentContainerStyle={styles.container}
        data={data}
        px="16px"
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={EmptySkeleton}
      />
    </Box>
  );
};
