import React, { FC } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp, useNavigation } from '@react-navigation/native';

import {
  Center,
  HStack,
  Modal,
  NftCard,
  Token,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';
import { ModalRoutes } from '@onekeyhq/kit/src/routes';

import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '../../../routes/Modal/Collectibles';

import { ASSETS } from './data';
import { SelectedAsset } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  CollectiblesRoutesParams,
  CollectiblesModalRoutes.CollectionModal
>;

type CollectionModalProps = {
  onSelectAsset: (asset: SelectedAsset) => void;
};

const getCollection = (id: string | number) => {
  const data = ASSETS.find((col) => String(col.id) === String(id));
  return data;
};

const CollectionModal: FC<CollectionModalProps> = () => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const navigation = useNavigation<NavigationProps>();

  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.CollectionModal
      >
    >();
  const { id } = route.params;
  const collectible = getCollection(id);

  // Open Asset detail modal
  const handleSelectAsset = React.useCallback(
    (asset: SelectedAsset) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      navigation.navigate(ModalRoutes.CollectibleDetailModal, {
        assetId: asset.id,
      });
    },
    [navigation],
  );

  if (!collectible) return null;

  return (
    <Modal
      header={collectible.collection.name ?? ''}
      footer={null}
      scrollViewProps={{
        pt: 4,
        children: (
          <Center>
            <Token
              size="56px"
              src={collectible.collection.imageUrl ?? undefined}
            />
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
                      onPress={() =>
                        handleSelectAsset({
                          ...asset,
                          chain: collectible.chain,
                          contractAddress: collectible.contract.address,
                        })
                      }
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
