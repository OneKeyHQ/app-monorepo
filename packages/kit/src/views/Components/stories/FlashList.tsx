import React from 'react';

import { FlashList, ListRenderItem } from '@shopify/flash-list';

import {
  Box,
  Center,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Collection } from '@onekeyhq/engine/src/types/nft';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../config';
import CollectionCard from '../../Wallet/Collectibles/CollectibleGallery/CollectionCard';

const collectionData: Collection[] = [];
const FlashListGallery = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const margin = isSmallScreen ? 16 : 20;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + margin));

  const renderItem: ListRenderItem<Collection> = ({ item }) => (
    <CollectionCard collectible={item} />
  );
  return (
    <Center flex="1" bg="background-hovered">
      <Box width={pageWidth} height="full">
        <FlashList
          ListHeaderComponent={() => <Box width="full" height="50px" />}
          style={{ backgroundColor: 'red', flex: 1 }}
          data={collectionData}
          numColumns={numColumns}
          renderItem={renderItem}
          estimatedItemSize={200}
        />
      </Box>
    </Center>
  );
};

export default FlashListGallery;
