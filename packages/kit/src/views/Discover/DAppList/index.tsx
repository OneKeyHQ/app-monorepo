import { FC, useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Box,
  FlatList,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import { Chains } from '../Chains';
import DAppIcon from '../DAppIcon';
import { DAppItemType, SectionDataType } from '../type';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.DAppListScreen>;

const Mobile: FC<SectionDataType> = ({ ...rest }) => {
  const { data, onItemSelect } = rest;
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
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 24 }}
        data={data}
        px="16px"
        renderItem={renderItem}
        keyExtractor={(item, index) => `ListView${index}`}
      />
    </Box>
  );
};

const Desktop: FC<SectionDataType> = ({ ...rest }) => {
  const { data, onItemSelect } = rest;
  const { width } = useWindowDimensions();
  // with sidebar
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
  const { title } = route.params;
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      title,
    });
  }, [navigation, title]);
  return (
    <Box flex="1" bg="background-default">
      {isSmallScreen ? (
        <Mobile {...route.params} />
      ) : (
        <Desktop {...route.params} />
      )}
    </Box>
  );
};

export default DAppList;
