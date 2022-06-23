import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/opensea';
import { Network } from '@onekeyhq/engine/src/types/network';
import type { Collectible } from '@onekeyhq/engine/src/types/opensea';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import { useCollectiblesData } from '../../../hooks/useCollectiblesData';

import CollectibleGallery from './CollectibleGallery';

import type { SelectedAsset } from './types';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

export type CollectiblesProps = {
  address?: string | null;
  network?: Network | null;
};

const Collectibles = ({ address, network }: CollectiblesProps) => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isCollectibleSupported = isCollectibleSupportedChainId(
    network?.extraInfo.networkVersion,
  );
  const { collectibles, isLoading, loadMore, fetchData } = useCollectiblesData({
    network,
    address,
    isCollectibleSupported,
  });

  // Open Asset detail modal
  const handleSelectAsset = useCallback(
    (asset: SelectedAsset) => {
      if (!asset.tokenId || !asset.contractAddress) return;

      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectibleDetailModal,
          params: {
            tokenId: asset.tokenId,
            contractAddress: asset.contractAddress,
            name: asset.name,
          },
        },
      });
    },
    [navigation],
  );
  // Open Collection modal
  const handleSelectCollectible = useCallback(
    (collectible: Collectible) => {
      if (!address || !network || !collectible?.collection?.name) {
        return;
      }

      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectionModal,
          params: {
            userAddress: address,
            collectionName: collectible.collection.name,
            chainId: network.extraInfo.networkVersion,
            chainName: network.shortName,
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
      onReachEnd={loadMore}
      onSelectCollectible={handleSelectCollectible}
      onSelectAsset={handleSelectAsset}
    />
  );
};

export default Collectibles;
