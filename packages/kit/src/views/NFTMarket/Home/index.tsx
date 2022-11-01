import React, { useCallback } from 'react';

import { ListRenderItem } from 'react-native';

import { Box, FlatList, useIsVerticalLayout } from '@onekeyhq/components';

import CollectionModule from './Collection';
import LiveMintingModule from './LiveMinting';
import SearchBar from './SearchBar';
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
  console.log();

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
      contentContainerStyle={{
        paddingBottom: 16,
        paddingTop: 16,
      }}
      data={data}
      ItemSeparatorComponent={() => <Box height="32px" />}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
    />
  );
};

const NFTMarket = () => {
  const isSmallScreen = useIsVerticalLayout();
  const paddingX = isSmallScreen ? 0 : '51px';
  return (
    <Box paddingX={paddingX} flex={1}>
      <SearchBar />
      <Content />
    </Box>
  );
};

export default NFTMarket;
