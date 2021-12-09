import React from 'react';
import {
  Center,
  FlatList,
  Box,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { useNavigation } from '@react-navigation/native';

type DataItem = {
  name: string;
};

const data: DataItem[] = [
  {
    name: 'Address',
  },
  {
    name: 'Avatar',
  },
  {
    name: 'Typography',
  },
  {
    name: 'Token',
  },
  {
    name: 'Theme',
  },
  {
    name: 'Icon',
  },
  {
    name: 'Badge',
  },
  {
    name: 'Alert',
  },
];

const Index = () => {
  const navigation = useNavigation();
  return (
    <FlatList<DataItem>
      data={data}
      bg="background-hovered"
      renderItem={({ item, index }) => (
        // TODO: typescript type define
        <Pressable
          onPress={() => navigation.navigate(`Components/${item.name}` as any)}
        >
          <Box
            borderBottomWidth={index === data.length - 1 ? '0' : '1'}
            borderColor="text-subdued"
            pl="4"
            pr="5"
            py="2"
            mx="12"
          >
            <Center display="flex" flexDirection="row">
              <Typography.DisplayLarge>{item.name}</Typography.DisplayLarge>
            </Center>
          </Box>
        </Pressable>
      )}
      keyExtractor={(_, index) => index.toString()}
    />
  );
};

export default Index;
