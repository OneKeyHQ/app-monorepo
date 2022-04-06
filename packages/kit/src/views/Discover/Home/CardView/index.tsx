import React, { FC, useCallback, useMemo } from 'react';

import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Box,
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

const CardViewMobile: FC<SectionDataType> = ({ title, data }) => {
  const { dispatch } = backgroundApiProxy;
  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => {
          dispatch(updateHistory(item.id));
        }}
      >
        <Box
          width="139px"
          height="100%"
          bgColor="surface-default"
          ml="16px"
          borderRadius="12px"
          padding="16px"
          alignItems="center"
        >
          <DAppIcon size={48} favicon={item.favicon} chain={item.chain} />
          <Typography.Body2Strong numberOfLines={1} mt="12px">
            {item.name}
          </Typography.Body2Strong>
          <Typography.Caption
            numberOfLines={4}
            mt="4px"
            textAlign="center"
            color="text-subdued"
          >
            {item.subtitle}
          </Typography.Caption>
        </Box>
      </Pressable>
    ),
    [dispatch],
  );
  return (
    <Box width="100%" height="224px" mt="32px">
      <SectionTitle title={title} />
      <FlatList
        contentContainerStyle={{
          paddingRight: 16,
        }}
        showsHorizontalScrollIndicator={false}
        horizontal
        data={data}
        renderItem={renderItem}
        keyExtractor={(item, index) => `CardView${index}`}
      />
    </Box>
  );
};

const CardViewDesktop: FC<SectionDataType> = ({ title, data }) => {
  const { width } = useWindowDimensions();
  const screenWidth = width - 270 - 48;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => (
      <Box
        width={cardWidth}
        maxWidth={cardWidth}
        minWidth={cardWidth}
        height={176}
        paddingX="8px"
      >
        <Pressable>
          <Box
            bgColor="surface-default"
            flexDirection="column"
            // margin="8px"
            borderRadius="12px"
            padding="16px"
            height={164}
          >
            <DAppIcon size={48} favicon={item.favicon} chain={item.chain} />
            <Typography.Body2Strong numberOfLines={1} mt="12px">
              {item.name}
            </Typography.Body2Strong>
            <Typography.Caption
              numberOfLines={3}
              mt="4px"
              textAlign="left"
              color="text-subdued"
            >
              {item.subtitle}
            </Typography.Caption>
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

const CardView: FC<SectionDataType> = ({ ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  const { data } = rest;
  const filterData = data.filter((item, index) => index < 8);
  return isSmallScreen ? (
    <CardViewMobile {...rest} data={filterData} />
  ) : (
    <CardViewDesktop {...rest} data={filterData} />
  );
};

export default CardView;
