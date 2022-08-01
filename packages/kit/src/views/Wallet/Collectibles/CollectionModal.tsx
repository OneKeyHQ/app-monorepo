import React, { FC } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  HStack,
  Modal,
  NetImage,
  Pressable,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { NFTScanAsset } from '@onekeyhq/engine/src/types/nftscan';
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
  onSelectAsset: (asset: NFTScanAsset) => void;
};

const CollectionModal: FC<CollectionModalProps> = () => {
  const isSmallScreen = useIsVerticalLayout();
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
    (asset: NFTScanAsset) => {
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
      scrollViewProps={{
        pt: 4,
        children: (
          <Box>
            <Box alignItems="center" mb="8px">
              <NetImage
                src={collectible.logoUrl ?? ''}
                width="56px"
                height="56px"
                borderRadius="28px"
              />
            </Box>
            {collectible.contractName && (
              <Typography.Heading mt="3" width="full" textAlign="center">
                {collectible.contractName}
              </Typography.Heading>
            )}

            {collectible.description && (
              <Typography.Body2 my="6" color="text-subdued">
                {collectible.description}
              </Typography.Body2>
            )}

            <HStack flexWrap="wrap">
              {collectible.assets.map((asset, itemIndex) => {
                const marginRight =
                  itemIndex % numofColumn < numofColumn - 1 ? 16 : 0;
                return (
                  <Pressable
                    key={asset.contractAddress + asset.tokenId}
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
