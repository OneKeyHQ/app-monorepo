/* eslint-disable @typescript-eslint/no-unused-vars */

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';

import {
  Box,
  Button,
  Center,
  FlatList,
  Pressable,
  Typography,
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
  return <Button onPress={goBack}>Back to HOME</Button>;
};

const Index = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  console.log('route: ', route.params.ts);

  const componentsRoute = Object.values(GalleryRoutes)
    .filter((item) => item.startsWith('component'))
    .sort();

  return (
    <FlatList
      data={componentsRoute}
      bg="background-hovered"
      ListHeaderComponent={ListHeaderComponent}
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => {
            navigation.navigate(item);
          }}
        >
          <Box
            borderBottomWidth={index === componentsRoute.length - 1 ? '0' : '1'}
            borderColor="text-subdued"
            pl="4"
            pr="5"
            py="2"
            mx="12"
          >
            <Center display="flex" flexDirection="row">
              <Typography.DisplayLarge>
                {item.replace('component/', '')}
              </Typography.DisplayLarge>
            </Center>
          </Box>
        </Pressable>
      )}
      keyExtractor={(_, index) => index.toString()}
    />
  );
};

export default Index;
