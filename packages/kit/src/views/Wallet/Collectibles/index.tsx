/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import { ModalTypes } from '@onekeyhq/kit/src/routes';
import { CollectiblesModalRoutes } from '@onekeyhq/kit/src/routes/Modal/Collectibles';

import CollectibleGallery from './CollectibleGallery';
import { ASSETS } from './data';
import { Collectible, SelectedAsset } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ModalCollectibleNavigationProp = NativeStackNavigationProp<
  ModalTypes,
  CollectiblesModalRoutes.CollectionModal
>;

const Collectibles = () => {
  const [collectibles] = useState<Collectible[]>(ASSETS);
  const navigation = useNavigation<ModalCollectibleNavigationProp>();

  // Open Asset detail modal
  const handleSelectAsset = useCallback(
    (asset: SelectedAsset) => {
      navigation.navigate(CollectiblesModalRoutes.CollectionModal, {
        screen: CollectiblesModalRoutes.CollectibleDetailModal,
        params: {
          assetId: asset.id,
        },
      });
    },
    [navigation],
  );
  // Open Collection modal
  const handleSelectCollectible = useCallback(
    (collectible: Collectible) => {
      navigation.navigate(CollectiblesModalRoutes.CollectionModal, {
        screen: CollectiblesModalRoutes.CollectionModal,
        params: {
          id: collectible.id,
        },
      });
    },
    [navigation],
  );

  return (
    <CollectibleGallery
      collectibles={collectibles}
      onSelectCollectible={handleSelectCollectible}
      onSelectAsset={handleSelectAsset}
    />
  );
};

export default Collectibles;
