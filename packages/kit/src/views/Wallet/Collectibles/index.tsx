import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import { Network } from '@onekeyhq/engine/src/types/network';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import CollectibleGallery from './CollectibleGallery';
import { useCollectiblesData, useNFTPrice } from './hooks';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

export type CollectiblesProps = {
  address?: string | null;
  network?: Network | null;
};

function CollectibleListView({ address, network }: CollectiblesProps) {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isCollectibleSupported = isCollectibleSupportedChainId(network?.id);
  const price = useNFTPrice({ network });

  const { collectibles, isLoading, fetchData } = useCollectiblesData({
    network,
    address,
    isCollectibleSupported,
  });

  const handleSelectAsset = useCallback(
    (asset: NFTAsset) => {
      if (!network) return;
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

  // Open Collection modal
  const handleSelectCollectible = useCallback(
    (collectible: Collection) => {
      if (!address || !network) return;

      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectionModal,
          params: {
            collectible,
            network,
          },
        },
      });
    },
    [address, navigation, network],
  );

  return (
    <CollectibleGallery
      price={price}
      collectibles={collectibles}
      onSelectCollection={handleSelectCollectible}
      onSelectAsset={handleSelectAsset}
      fetchData={fetchData}
      isCollectibleSupported={isCollectibleSupported}
      isLoading={isLoading}
    />
  );
}

export default React.memo(CollectibleListView);
