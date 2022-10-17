import React, { FC, useCallback, useMemo } from 'react';

import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Box,
  FlatList,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { Chains } from '../../Chains';
import DAppIcon from '../../DAppIcon';
import { DAppItemType, SectionDataType } from '../../type';
import { SectionTitle } from '../TitleView';

type DappTypeTuple = [DAppItemType | undefined, DAppItemType | undefined];

type CardBaseViewCardProps = {
  item: DAppItemType;
  onItemSelect: SectionDataType['onItemSelect'];
};

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

const CardViewMobile: FC<SectionDataType> = ({ title, data, onItemSelect }) => {
  const chuckItems = (items: DAppItemType[]) => {
    const result: DappTypeTuple[] = [];
    for (let i = 0; i < items.length; i += 2) {
      result.push([items[i], items[i + 1]]);
    }
    return result;
  };

  const filterData = data.filter((item, index) => index < 8);
  const items = chuckItems(filterData);

  const renderItem: ListRenderItem<DappTypeTuple> = useCallback(
    ({ item }) => {
      const itemA = item[0];
      const itemB = item[1];
      return (
        <Box>
          {itemA ? (
            <Box>
              <CardBaseViewCard item={itemA} onItemSelect={onItemSelect} />
            </Box>
          ) : null}
          {itemB ? (
            <Box mt="5">
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
        contentContainerStyle={{
          paddingRight: 16,
        }}
        showsHorizontalScrollIndicator={false}
        horizontal
        data={items}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${index}`}
      />
    </Box>
  );
};

const CardViewDesktop: FC<SectionDataType> = ({
  title,
  data,
  onItemSelect,
}) => {
  const { width } = useWindowDimensions();
  const screenWidth = width - 270 - 48;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;
  const filterData = data.filter((item, index) => index < 8);

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
            {item.subtitle}
          </Typography.Caption>
        </Pressable>
      </Box>
    ),
    [cardWidth, onItemSelect],
  );

  const flatList = useMemo(
    () => (
      <FlatList
        paddingLeft="24px"
        data={filterData}
        renderItem={renderItem}
        numColumns={numColumns}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${numColumns}key${index}${item._id}`}
        key={`key${numColumns}`}
      />
    ),
    [filterData, numColumns, renderItem],
  );
  return (
    <Box width="100%" mt="32px">
      <SectionTitle title={title} data={data} onItemSelect={onItemSelect} />
      {flatList}
    </Box>
  );
};

const CardView: FC<SectionDataType> = ({ ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  const { data } = rest;
  return isSmallScreen ? (
    <CardViewMobile {...rest} data={data} />
  ) : (
    <CardViewDesktop {...rest} data={data} />
  );
};

export default CardView;
