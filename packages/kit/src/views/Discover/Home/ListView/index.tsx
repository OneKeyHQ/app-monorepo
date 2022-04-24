import React, { FC, useCallback, useMemo } from 'react';

import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import DAppIcon from '../../DAppIcon';
import { DAppItemType } from '../../type';
import { SectionTitle } from '../TitleView';
import { SectionDataType } from '../type';

const ListViewMobile: FC<SectionDataType> = ({ title, data, onItemSelect }) => {
  const filterData = data.filter((item, index) => index < 5);

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item, index }) => (
      <Pressable
        onPress={() => {
          if (onItemSelect) {
            onItemSelect(item);
          }
        }}
      >
        <Box
          padding="16px"
          height="76px"
          width="100%"
          bgColor="surface-default"
          borderTopRadius={index === 0 ? '12px' : '0px'}
          borderRadius={index === filterData?.length - 1 ? '12px' : '0px'}
        >
          <Box flexDirection="row" flex={1} alignItems="center">
            <DAppIcon size={48} favicon={item.favicon} chain={item.chain} />
            <Box flexDirection="column" ml="12px" flex={1}>
              <Typography.Body2Strong>{item.name}</Typography.Body2Strong>
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
    [filterData?.length, onItemSelect],
  );
  return (
    <Box width="100%" mt="32px">
      <SectionTitle title={title} data={data} onItemSelect={onItemSelect} />
      <FlatList
        data={filterData}
        px="16px"
        ItemSeparatorComponent={() => <Divider />}
        renderItem={renderItem}
        keyExtractor={(item, index) => `ListView${index}`}
      />
    </Box>
  );
};

const ListViewDesktop: FC<SectionDataType> = ({
  title,
  data,
  onItemSelect,
}) => {
  const { width } = useWindowDimensions();
  const screenWidth = width - 270 - 64;
  const minWidth = 400;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;
  const filterData = data.filter((item, index) => index < 9);

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => (
      <Box
        width={cardWidth}
        maxWidth={cardWidth}
        minWidth={cardWidth}
        height="92px"
        paddingY="6px"
      >
        <Pressable
          flexDirection="row"
          padding="16px"
          _hover={{ bg: 'surface-hovered', borderRadius: '12px' }}
          onPress={() => {
            if (onItemSelect) {
              onItemSelect(item);
            }
          }}
        >
          <DAppIcon size={48} favicon={item.favicon} chain={item.chain} />
          <Box flexDirection="column" ml="12px" flex={1}>
            <Typography.Body2Strong>{item.name}</Typography.Body2Strong>
            <Typography.Caption color="text-subdued" numberOfLines={1} mt="4px">
              {item.subtitle}
            </Typography.Caption>
          </Box>
        </Pressable>
      </Box>
    ),
    [cardWidth, onItemSelect],
  );

  const flatList = useMemo(
    () => (
      <FlatList
        mx="32px"
        bgColor="surface-default"
        borderRadius="12px"
        paddingX="8px"
        paddingY="10px"
        data={filterData}
        renderItem={renderItem}
        numColumns={numColumns}
        keyExtractor={(item, index) => `${numColumns}key${index}`}
        key={`key${numColumns}`}
      />
    ),
    [filterData, numColumns, renderItem],
  );
  return (
    <Box width="100%" height="100%" mt="32px">
      <SectionTitle title={title} data={data} onItemSelect={onItemSelect} />
      {flatList}
    </Box>
  );
};

const ListView: FC<SectionDataType> = ({ ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  const { data } = rest;
  return isSmallScreen ? (
    <ListViewMobile {...rest} data={data} />
  ) : (
    <ListViewDesktop {...rest} data={data} />
  );
};

export default ListView;
