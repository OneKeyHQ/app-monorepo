import React, { FC, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp, useNavigation } from '@react-navigation/native';

import {
  Center,
  HStack,
  Icon,
  Image,
  Modal,
  NftCard,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
import { getUserAssets } from '@onekeyhq/engine/src/managers/opensea';
import { Asset, Collectible } from '@onekeyhq/engine/src/types/opensea';
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

const getCollectible = async (address: string, id: string | number) => {
  const collectibles = await getUserAssets({ account: address });
  const collectible = collectibles.find((col) => col.id === String(id));
  return collectible;
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
  const { id, userAddress } = route.params;
  const [collectible, setCollectible] = useState<Collectible | null>();

  useEffect(() => {
    if (!userAddress || !id) {
      return;
    }

    (async () => {
      const collectibleFromBe = await getCollectible(userAddress, id);
      setCollectible(collectibleFromBe);
    })();
  }, [id, userAddress]);

  // Open Asset detail modal
  const handleSelectAsset = React.useCallback(
    (asset: Asset) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectibleDetailModal,
          params: { assetId: asset.id, userAddress },
        },
      });
    },
    [navigation, userAddress],
  );

  if (!collectible) return null;

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
