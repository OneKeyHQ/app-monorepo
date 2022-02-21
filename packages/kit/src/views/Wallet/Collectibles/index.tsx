import React, { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import { getUserAssets } from '@onekeyhq/engine/src/managers/opensea';
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

import type { Collectible, SelectedAsset } from './types';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

export type CollectiblesProps = {
  accountId: string | null | undefined;
  networkId: string | null | undefined;
};

const Collectibles = ({ accountId, networkId }: CollectiblesProps) => {
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const navigation = useNavigation<NavigationProps['navigation']>();

  useEffect(() => {
    if (!accountId || !networkId) {
      return;
    }

    (async () => {
      const cols = await getUserAssets({ account: accountId, chainId: 1 });
      setCollectibles(cols);
    })();
  }, [accountId, networkId]);

  // Open Asset detail modal
  const handleSelectAsset = useCallback(
    (asset: SelectedAsset) => {
      if (!accountId) return;

      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectibleDetailModal,
          params: { assetId: asset.id, userAddress: accountId },
        },
      });
    },
    [accountId, navigation],
  );
  // Open Collection modal
  const handleSelectCollectible = useCallback(
    (collectible: Collectible) => {
      if (!accountId) return;

      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectionModal,
          params: { id: collectible.id, userAddress: accountId },
        },
      });
    },
    [accountId, navigation],
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
