import React, { FC, useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import DAppIcon from '../DAppIcon';
import { SectionDataType } from '../Home/type';
import { DAppItemType } from '../type';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.DAppListScreen>;

const Mobile: FC<SectionDataType> = ({ ...rest }) => {
  const { data, onItemSelect } = rest;
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
          borderRadius={index === data?.length - 1 ? '12px' : '0px'}
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
    [data?.length, onItemSelect],
  );
  return (
    <Box width="100%">
      <FlatList
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}
        data={data}
        px="16px"
        ItemSeparatorComponent={() => <Divider />}
        renderItem={renderItem}
        keyExtractor={(item, index) => `ListView${index}`}
      />
    </Box>
  );
};

const Desktop: FC<SectionDataType> = ({ ...rest }) => {
  const { data, onItemSelect } = rest;
  const { width } = useWindowDimensions();
  const screenWidth = width - 48;
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
        <Pressable
          onPress={() => {
            if (onItemSelect) {
              onItemSelect(item);
            }
          }}
        >
          <Box
            bgColor="surface-default"
            flexDirection="column"
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
    [cardWidth, onItemSelect],
  );

  const flatList = useMemo(
    () => (
      <FlatList
        contentContainerStyle={{ paddingTop: 32, paddingBottom: 32 }}
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
    <Box width="100%" height="100%">
      {flatList}
    </Box>
  );
};

const DAppList: FC = () => {
  const route = useRoute<RouteProps>();
  const { title, onItemSelect } = route.params;
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      title,
    });
  }, [navigation, title]);
  const callback = useCallback(
    (item: DAppItemType) => {
      if (platformEnv.isDesktop || platformEnv.isNative) {
        navigation.goBack();
      }
      if (onItemSelect) {
        onItemSelect(item);
      }
    },
    [navigation, onItemSelect],
  );
  return (
    <Box flex="1" bg="background-default">
      {isSmallScreen ? (
        <Mobile {...route.params} onItemSelect={callback} />
      ) : (
        <Desktop {...route.params} onItemSelect={callback} />
      )}
    </Box>
  );
};

export default DAppList;
