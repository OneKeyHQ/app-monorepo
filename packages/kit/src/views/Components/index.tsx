import React from 'react';
import {
  Center,
  FlatList,
  Box,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { useNavigation } from '@react-navigation/native';

// eslint-disable-next-line import/no-cycle
import { stackRoutes } from '../../routes';

const Index = () => {
  const navigation = useNavigation();

  const componentsRoute = stackRoutes
    .filter((item) => item.name.startsWith('Components'))
    .map((item) => item.name);

  return (
    <FlatList
      data={componentsRoute}
      bg="background-hovered"
      renderItem={({ item, index }) => (
        <Pressable onPress={() => navigation.navigate(item as any)}>
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
                {item.replace('Components/', '')}
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
