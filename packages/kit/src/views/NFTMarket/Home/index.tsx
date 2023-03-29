import { useCallback } from 'react';

import { Box, FlatList, useSafeAreaInsets } from '@onekeyhq/components';

// import Banner from './Banner';

import LiveMintingModule from './LiveMinting';
import NotableCollections from './NotableCollections';
import PageHeader from './PageHeader';
import StatsModule from './Stats';

import type { ListRenderItem } from 'react-native';

export enum NFTModule {
  BannerSection = 'BannerSection',
  Collection = 'Collection',
  Stats = 'Stats',
  Category = 'Category',
  LiveMinting = 'LiveMinting',
}

type ModuleData = {
  id: string;
};
const Content = () => {
  const { bottom } = useSafeAreaInsets();
  const data: ModuleData[] = [
    // { id: NFTModule.BannerSection },
    { id: NFTModule.Collection },
    { id: NFTModule.Stats },
    // { id: NFTModule.Category },
    { id: NFTModule.LiveMinting },
  ];

  const renderItem: ListRenderItem<ModuleData> = useCallback(({ item }) => {
    const { id } = item;
    // if (id === NFTModule.BannerSection) {
    //   return <Banner />;
    // }
    if (id === NFTModule.Collection) {
      return <NotableCollections />;
    }
    if (id === NFTModule.Stats) {
      return <StatsModule />;
    }
    if (id === NFTModule.LiveMinting) {
      return <LiveMintingModule />;
    }
    return <Box />;
  }, []);

  const ItemSeparatorComponent = useCallback(
    () => <Box h={{ base: '32px', md: '48px' }} />,
    [],
  );

  return (
    <FlatList
      data={data}
      ItemSeparatorComponent={ItemSeparatorComponent}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      p={{ base: '16px', md: '32px' }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        width: '100%',
        maxWidth: 992,
        paddingBottom: bottom,
        alignSelf: 'center',
      }}
    />
  );
};

const NFTMarket = () => {
  const { top } = useSafeAreaInsets();

  return (
    <Box flex={1} mt={`${top}px`}>
      {/* TODO repleace with Header component in the future  */}
      <PageHeader />
      <Content />
    </Box>
  );
};

export default NFTMarket;
