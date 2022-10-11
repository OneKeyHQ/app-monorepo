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
          onItemSelect?.(item);
        }}
      >
        <Box
          padding="16px"
          height="76px"
          width="100%"
          bgColor="surface-default"
          borderTopRadius={index === 0 ? '12px' : '0px'}
          borderRadius={index === data?.length - 1 ? '12px' : '0px'}
          borderWidth={1}
          borderColor="border-subdued"
          borderTopWidth={index === 0 ? 1 : 0}
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
  const screenWidth = width - 48 - 256;
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
        justifyContent="center"
        alignItems="center"
      >
        <Pressable
          bgColor="surface-default"
          flexDirection="column"
          borderRadius="12px"
          padding="16px"
          borderWidth={1}
          borderColor="border-subdued"
          width={cardWidth - 16}
          height={164}
          _hover={{
            bg: 'surface-hovered',
          }}
          onPress={() => {
            if (onItemSelect) {
              onItemSelect(item);
            }
          }}
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
