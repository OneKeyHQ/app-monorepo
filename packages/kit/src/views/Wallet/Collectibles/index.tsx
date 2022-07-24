import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/moralis';
import type {
  Collectible,
  MoralisNFT,
} from '@onekeyhq/engine/src/types/moralis';
import { Network } from '@onekeyhq/engine/src/types/network';
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

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

export type CollectiblesProps = {
  address?: string | null;
  network?: Network | null;
  isTab?: boolean;
};

const Collectibles = ({ address, network, isTab }: CollectiblesProps) => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isCollectibleSupported = isCollectibleSupportedChainId(network?.id);

  const { collectibles, isLoading, fetchData } = useCollectiblesData({
    network,
    address,
    isCollectibleSupported,
  });

  const handleSelectAsset = useCallback(
    (asset: MoralisNFT) => {
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
      isTab={isTab}
      collectibles={collectibles}
      fetchData={fetchData}
      isLoading={isLoading}
      isSupported={isCollectibleSupported}
      onSelectCollectible={handleSelectCollectible}
      onSelectAsset={handleSelectAsset}
    />
  );
};

export default Collectibles;
