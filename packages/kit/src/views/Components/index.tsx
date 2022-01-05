import React from 'react';

import { useNavigation } from '@react-navigation/native';

import {
  Box,
  Center,
  FlatList,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { StackRoutes, StackRoutesParams } from '@onekeyhq/kit/src/routes/Stack';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type StackRoutesType = typeof StackRoutes;

type NavigationProps = NativeStackNavigationProp<
  StackRoutesParams,
  StackRoutesType[keyof StackRoutesType]
>;

const Index = () => {
  const navigation = useNavigation<NavigationProps>();

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
