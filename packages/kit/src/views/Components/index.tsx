import React from 'react';

import { NavigationProp, RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';

import {
  Box,
  Center,
  FlatList,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { StackRoutes, StackRoutesParams } from '@onekeyhq/kit/src/routes/Stack';

type StackRoutesType = typeof StackRoutes;

type NavigationProps = NavigationProp<
  StackRoutesParams,
  StackRoutesType[keyof StackRoutesType]
>;

type RouteProps = RouteProp<StackRoutesParams, StackRoutesType['Developer']>;

const Index = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  console.log('route: ', route.params.ts);

  const componentsRoute = Object.values(StackRoutes)
    .filter((item) => item.startsWith('component'))
    .sort();

  return (
    <FlatList
      data={componentsRoute}
      bg="background-hovered"
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
