import React, { FC } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp, useNavigation } from '@react-navigation/native';

import {
  Center,
  HStack,
  Icon,
  Image,
  Modal,
  NftCard,
  Spinner,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
import { useCollectibleCache } from '@onekeyhq/kit/src/hooks/useCollectiblesData';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '../../../routes/Modal/Collectibles';

import { SelectedAsset } from './types';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

type CollectionModalProps = {
  onSelectAsset: (asset: SelectedAsset) => void;
};

const CollectionImage: FC<{ src?: string | null; size?: number | string }> = ({
  src,
  size = '56px',
}) => {
  const fallbackElement = React.useMemo(
    () => (
      <Center
        borderRadius="full"
        bg="surface-neutral-default"
        width={size}
        height={size}
      >
        <Icon size={32} name="QuestionMarkCircleSolid" color="icon-default" />
      </Center>
    ),
    [size],
  );

  if (!src) return fallbackElement;

  return (
    <Image
      src={src}
      key={src}
      alt={src}
      width={size}
      height={size}
      fallbackElement={fallbackElement}
      borderRadius="full"
    />
  );
};

const CollectionModal: FC<CollectionModalProps> = () => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const navigation = useNavigation<NavigationProps['navigation']>();

  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.CollectionModal
      >
    >();
  const { collectionName, userAddress, chainId, chainName } = route.params;
  const collectible = useCollectibleCache(userAddress, collectionName);

  // Open Asset detail modal
  const handleSelectAsset = React.useCallback(
    (asset: SelectedAsset) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectibleDetailModal,
          params: {
            chainId,
            chainName,
            contractAddress:
              asset.contractAddress ?? asset.assetContract.address,
            tokenId: asset.tokenId,
          },
        },
      });
    },
    [chainId, chainName, navigation],
  );

  if (!collectible) {
    return (
      <Modal
        footer={null}
        height="640px"
        scrollViewProps={{
          pt: 4,
          children: (
            <Center flex={1}>
              <Spinner size="lg" />
            </Center>
          ),
        }}
      />
    );
  }

  return (
    <Modal
      footer={null}
      scrollViewProps={{
        pt: 4,
        children: (
          <Center>
            <CollectionImage src={collectible.collection.imageUrl} />
            <Typography.Heading mt="3">
              {collectible.collection.name}
            </Typography.Heading>
            <Typography.Body2 my="6" color="text-subdued">
              {collectible.collection.description}
            </Typography.Body2>

            <VStack space={3} w="100%">
              <HStack
                flexWrap="wrap"
                space={0}
                alignItems="center"
                justifyContent={['space-between', 'initial']}
              >
                {collectible.assets.map((asset, index) => {
                  const marginRight =
                    isSmallScreen && !(index % 2 === 0) ? 0 : 4;

                  return (
                    <NftCard
                      key={asset.id ?? asset.name}
                      image={asset.imageUrl}
                      title={asset.name}
                      mr={marginRight}
                      mb={4}
                      onPress={() => handleSelectAsset(asset)}
                    />
                  );
                })}
              </HStack>
            </VStack>
          </Center>
        ),
      }}
    />
  );
};

export default CollectionModal;
