/* eslint-disable @typescript-eslint/no-unused-vars */

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import natsort from 'natsort';
import { FlatList, TouchableOpacity } from 'react-native';
import { Button, Stack } from 'tamagui';

import {
  //   Box,
  //   Button,
  //   Center,
  //   FlatList,
  //   Pressable,
  //   Typography,
  Text,
} from '@onekeyhq/components';

import { useNavigationBack } from '../../hooks/useAppNavigation';
import { GalleryRoutes } from '../../routes/routesEnum';

import type { GalleryParams } from '../../routes/Root/Gallery';
import type { NavigationProp, RouteProp } from '@react-navigation/core';

type StackRoutesType = typeof GalleryRoutes;

type NavigationProps = NavigationProp<
  GalleryParams,
  StackRoutesType[keyof StackRoutesType]
>;

type RouteProps = RouteProp<GalleryParams, StackRoutesType['Components']>;

const ListHeaderComponent = () => {
  const goBack = useNavigationBack();
  return (
    <Button onPress={goBack}>
      <Text>Back to HOME</Text>
    </Button>
  );
};

const Index = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  // console.log('route: ', route.params.ts);

  const componentsRoute = Object.values(GalleryRoutes)
    .filter((item) => item.startsWith('component'))
    .sort((a, b) => natsort({ insensitive: true })(a, b));

  return (
    <FlatList
      data={componentsRoute}
      style={{ flex: 1, backgroundColor: 'background-hovered' }}
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item, index }) => (
        <TouchableOpacity
          onPress={() => {
            navigation.navigate(item);
          }}
        >
          <Stack
            borderBottomWidth={index === componentsRoute.length - 1 ? 0 : 1}
            borderColor="text-subdued"
            paddingLeft={4}
            paddingRight={5}
            paddingHorizontal={2}
            marginVertical={12}
          >
            <Stack display="flex" flexDirection="row">
              <Text>{item.replace('component/', '')}</Text>
            </Stack>
          </Stack>
        </TouchableOpacity>
      )}
      keyExtractor={(_, index) => index.toString()}
    />
  );
};

export default Index;
