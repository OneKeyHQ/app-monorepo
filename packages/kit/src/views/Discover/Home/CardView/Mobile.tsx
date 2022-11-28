import { FC, useCallback } from 'react';

import { ListRenderItem, StyleSheet } from 'react-native';

import { Box, FlatList, Pressable, Typography } from '@onekeyhq/components';

import DAppIcon from '../../DAppIcon';
import { DAppItemType, SectionDataType } from '../../type';
import { SectionTitle } from '../TitleView';

type DappTypeTuple = [DAppItemType | undefined, DAppItemType | undefined];

type CardBaseViewCardProps = {
  item: DAppItemType;
  onItemSelect: SectionDataType['onItemSelect'];
};

const styles = StyleSheet.create({
  listContentContainer: {
    paddingRight: 16,
  },
});

const CardBaseViewCard: FC<CardBaseViewCardProps> = ({
  item,
  onItemSelect,
}) => (
  <Pressable
    onPress={() => {
      if (onItemSelect) {
        onItemSelect(item);
      }
    }}
  >
    <Box
      width="260px"
      ml="4"
      borderRadius="12px"
      alignItems="center"
      flexDirection="row"
    >
      <DAppIcon size={48} url={item.logoURL} networkIds={item.networkIds} />
      <Box flex={1} ml="2">
        <Typography.Body2Strong numberOfLines={1}>
          {item.name}
        </Typography.Body2Strong>
        <Typography.Caption
          numberOfLines={1}
          mt="1"
          color="text-subdued"
          overflow="hidden"
        >
          {item.subtitle}
        </Typography.Caption>
      </Box>
    </Box>
  </Pressable>
);

const group = (items: DAppItemType[]) => {
  const result: DappTypeTuple[] = [];
  for (let i = 0; i < items.length; i += 2) {
    result.push([items[i], items[i + 1]]);
  }
  return result;
};

export const Mobile: FC<SectionDataType> = ({ title, data, onItemSelect }) => {
  const filterData = data.slice(0, 8);
  const items = group(filterData);

  const renderItem: ListRenderItem<DappTypeTuple> = useCallback(
    ({ item }) => {
      const itemA = item[0];
      const itemB = item[1];
      return (
        <Box>
          {itemA ? (
            <Box key={itemA._id}>
              <CardBaseViewCard item={itemA} onItemSelect={onItemSelect} />
            </Box>
          ) : null}
          {itemB ? (
            <Box key={itemB._id} mt="5">
              <CardBaseViewCard item={itemB} onItemSelect={onItemSelect} />
            </Box>
          ) : null}
        </Box>
      );
    },
    [onItemSelect],
  );
  return (
    <Box width="100%" mt="8">
      <SectionTitle title={title} data={data} onItemSelect={onItemSelect} />
      <FlatList
        contentContainerStyle={styles.listContentContainer}
        removeClippedSubviews
        windowSize={5}
        showsHorizontalScrollIndicator={false}
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item[0]?._id ?? index}`}
      />
    </Box>
  );
};
