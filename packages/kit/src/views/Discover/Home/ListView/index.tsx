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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { updateHistory } from '@onekeyhq/kit/src/store/reducers/discover';

import DAppIcon from '../../DAppIcon';
import { DAppItemType } from '../../type';
import { SectionTitle } from '../TitleView';
import { SectionDataType } from '../type';

const ListViewMobile: FC<SectionDataType> = ({ title, data }) => {
  const { dispatch } = backgroundApiProxy;
  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item, index }) => (
      <Pressable
        onPress={() => {
          dispatch(updateHistory(item.id));
        }}
      >
        <Box
          padding="16px"
          height="76px"
          width="100%"
          bgColor="surface-default"
          borderTopRadius={index === 0 ? '12px' : '0px'}
          borderRadius={index === data?.length - 1 ? '12px' : '0px'}
        >
          <Box flexDirection="row" flex={1} alignItems="center">
            <DAppIcon size={48} favicon={item.favicon} chain={item.chain} />
            <Box flexDirection="column" ml="12px" flex={1}>
              <Typography.Body1Strong>{item.name}</Typography.Body1Strong>
              <Typography.Body2 color="text-subdued" mt="4px" numberOfLines={1}>
                {item.subtitle}
              </Typography.Body2>
            </Box>
          </Box>
        </Box>
      </Pressable>
    ),
    [data?.length, dispatch],
  );
  return (
    <Box width="100%" mt="32px">
      <SectionTitle title={title} />
      <FlatList
        data={data}
        px="16px"
        ItemSeparatorComponent={() => <Divider />}
        renderItem={renderItem}
        keyExtractor={(item, index) => `ListView${index}`}
      />
    </Box>
  );
};

const ListViewDesktop: FC<SectionDataType> = ({ title, data }) => {
  const { width } = useWindowDimensions();
  const screenWidth = width - 270 - 64;
  const minWidth = 400;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => (
      <Box
        width={cardWidth}
        maxWidth={cardWidth}
        minWidth={cardWidth}
        height="96px"
        paddingX="8px"
        paddingY="8px"
      >
        <Pressable>
          <Box flexDirection="row" padding="16px">
            <DAppIcon size={48} favicon={item.favicon} chain={item.chain} />
            <Box
              flexDirection="column"
              ml="12px"
              //   justifyContent="center"
              flex={1}
            >
              <Typography.Body1Strong>{item.name}</Typography.Body1Strong>
              <Typography.Body2 color="text-subdued" numberOfLines={1} mt="4px">
                {item.subtitle}
              </Typography.Body2>
            </Box>
          </Box>
        </Pressable>
      </Box>
    ),
    [cardWidth],
  );

  const flatList = useMemo(
    () => (
      <FlatList
        mx="32px"
        bgColor="surface-default"
        borderRadius="12px"
        paddingX="8px"
        paddingY="8px"
        data={data}
        renderItem={renderItem}
        numColumns={numColumns}
        keyExtractor={(item, index) => `${numColumns}key${index}`}
        key={`key${numColumns}`}
      />
    ),
    [data, numColumns, renderItem],
  );
  return (
    <Box width="100%" height="100%" mt="32px">
      <SectionTitle title={title} />
      {flatList}
    </Box>
  );
};

const ListView: FC<SectionDataType> = ({ ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  const { data } = rest;
  const maxCount = isSmallScreen ? 5 : 9;
  const filterData = data.filter((item, index) => index < maxCount);
  return isSmallScreen ? (
    <ListViewMobile {...rest} data={filterData} />
  ) : (
    <ListViewDesktop {...rest} data={filterData} />
  );
};

export default ListView;
