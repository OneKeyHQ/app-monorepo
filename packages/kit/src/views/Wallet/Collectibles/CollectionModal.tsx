import React, { FC } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  HStack,
  Modal,
  Pressable,
  useUserDevice,
} from '@onekeyhq/components';
import { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '../../../routes/Modal/Collectibles';

import CollectibleCard from './CollectibleGallery/CollectibleCard';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

type CollectionModalProps = {
  onSelectAsset: (asset: MoralisNFT) => void;
};

const CollectionModal: FC<CollectionModalProps> = () => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const navigation = useNavigation<NavigationProps['navigation']>();
  const dimensions = useWindowDimensions();

  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.CollectionModal
      >
    >();
  const { collectible, network } = route.params;

  // Open Asset detail modal
  const handleSelectAsset = React.useCallback(
    (asset: MoralisNFT) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectibleDetailModal,
          params: {
            asset,
            network,
          },
        },
      });
    },
    [navigation, network],
  );

  const numofColumn = isSmallScreen ? 2 : 4;
  const cardWidth = isSmallScreen
    ? Math.floor((dimensions.width - 16 * 3) / 2)
    : (800 - 96) / 4;
  return (
    <Modal
      size="2xl"
      footer={null}
      height="640px"
      header={collectible.collection.name ?? ''}
      scrollViewProps={{
        pt: 4,
        children: (
          <Box>
            {/* <CollectionImage src={collectible.collection.imageUrl} /> */}
            {/* <Typography.Heading mt="3" width="full" textAlign="center">
              {collectible.collection.name}
            </Typography.Heading> */}
            {/* <Typography.Body2 my="6" color="text-subdued">
              {collectible.collection.description}
            </Typography.Body2> */}
            <HStack flexWrap="wrap">
              {collectible.assets.map((asset, itemIndex) => {
                // const marginRight = itemIndex % 2 === 0 ? 0 : 16;
                const marginRight =
                  itemIndex % numofColumn < numofColumn - 1 ? 16 : 0;
                return (
                  <Pressable
                    key={asset.tokenAddress + asset.tokenId}
                    onPress={() => {
                      handleSelectAsset(asset);
                    }}
                  >
                    <CollectibleCard
                      width={cardWidth}
                      marginRight={`${marginRight}px`}
                      asset={asset}
                    />
                  </Pressable>
                );
              })}
            </HStack>
          </Box>
        ),
      }}
    />
  );
};

export default CollectionModal;
