import React, { useCallback } from 'react';

import { FlashList, ListRenderItem } from '@shopify/flash-list';

import {
  Box,
  Center,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Collection } from '@onekeyhq/engine/src/types/nft';

import { MAX_PAGE_CONTAINER_WIDTH } from '../../../config';
import CollectibleCard from '../../Wallet/Collectibles/CollectibleGallery/CollectibleCard';
import CollectionCard from '../../Wallet/Collectibles/CollectibleGallery/CollectionCard';

import { collectionData } from './mackData';

const FlashListGallery = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const margin = isSmallScreen ? 16 : 20;
  const padding = 16;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + margin));
  const cardWidth = isSmallScreen
    ? Math.floor((pageWidth - padding * 2 - margin) / 2)
    : 177;
  const cardInnerPadding = isSmallScreen ? 8 : 12;
  const imageWidth = cardWidth - 2 * cardInnerPadding;
  const cardHeight = imageWidth + cardInnerPadding + 36;

  console.log('1111 = ', collectionData);

  const renderItem: ListRenderItem<Collection> = useCallback(
    ({ item, index }) => {
      console.log('renderItem = ', index);
      return <CollectionCard collectible={item} />;
    },
    [],
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
