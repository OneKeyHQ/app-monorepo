import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nftscan';
import { Network } from '@onekeyhq/engine/src/types/network';
import type {
  Collectible,
  NFTScanAsset,
} from '@onekeyhq/engine/src/types/nftscan';
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
import { useCollectiblesData } from './useCollectiblesData';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

export type CollectiblesProps = {
  address?: string | null;
  network?: Network | null;
};

function CollectibleListView({ address, network }: CollectiblesProps) {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isCollectibleSupported = isCollectibleSupportedChainId(network?.id);

  const { collectibles, isLoading, fetchData } = useCollectiblesData({
    network,
    address,
    isCollectibleSupported,
  });
  console.log('collectibles = ', collectibles);

  const handleSelectAsset = useCallback(
    (asset: NFTScanAsset) => {
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
    (collectible: Collectible) => {
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
      collectibles={collectibles}
      fetchData={fetchData}
      isLoading={isLoading}
      isSupported={isCollectibleSupported}
      onSelectCollectible={handleSelectCollectible}
      onSelectAsset={handleSelectAsset}
    />
  );
}

export default React.memo(CollectibleListView);
