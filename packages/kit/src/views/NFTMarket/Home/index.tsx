import React, { useCallback, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { ListRenderItem } from 'react-native';

import { Box, FlatList } from '@onekeyhq/components';

import CollectionModule from './Collection';
import LiveMintingModule from './LiveMinting';
import PageHeader from './PageHeader';
import StatsModule from './Stats';

export enum NFTModule {
  Collection = 'Collection',
  Stats = 'Stats',
  Category = 'Category',
  LiveMinting = 'LiveMinting',
}

type ModuleData = {
  id: string;
};
const Content = () => {
  const data: ModuleData[] = [
    { id: NFTModule.Collection },
    { id: NFTModule.Stats },
    // { id: NFTModule.Category },
    { id: NFTModule.LiveMinting },
  ];

  const renderItem: ListRenderItem<ModuleData> = useCallback(({ item }) => {
    const { id } = item;
    if (id === NFTModule.Collection) {
      return <CollectionModule />;
    }
    if (id === NFTModule.Stats) {
      return <StatsModule />;
    }
    if (id === NFTModule.Category) {
      return <Box bgColor="amber.300" height="50px" />;
    }
    if (id === NFTModule.LiveMinting) {
      return <LiveMintingModule />;
    }
    return <Box />;
  }, []);

  return (
    <FlatList
      data={data}
      ItemSeparatorComponent={() => <Box height="32px" />}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      w="100%"
      maxW="992px"
      mx="auto"
      py="32px"
    />
  );
};

const NFTMarket = () => {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <Box flex={1}>
      {/* TODO repleace with Header component in the future  */}
      <PageHeader />
      <Box justifyContent="center" px={{ base: '16px', md: '32px' }} flex={1}>
        <Content />
      </Box>
    </Box>
  );
};

export default NFTMarket;
