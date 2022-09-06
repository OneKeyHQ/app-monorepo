import React, { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import CollectibleGallery from './CollectibleGallery';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

function CollectibleListView() {
  const { account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isCollectibleSupported = isCollectibleSupportedChainId(network?.id);
  const { serviceNFT } = backgroundApiProxy;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [price, updatePrice] = useState<number>(0);
  const [collectibles, updateListData] = useState<Collection[]>([]);

  const [refresh, setRefresh] = useState(0);

  const fetchData = () => {
    setRefresh((prev) => prev + 1);
  };

  useEffect(() => {
    let isCancel = false;
    (async () => {
      if (account && network?.id) {
        setIsLoading(true);
        const localData = await serviceNFT.getLocalNFTs({
          networkId: network.id,
          accountId: account.address,
        });
        updateListData(localData);
        const result = await serviceNFT.fetchNFT({
          accountId: account.address,
          networkId: network?.id,
        });
        if (!isCancel) {
          updateListData(result);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      isCancel = true;
    };
  }, [account, network, serviceNFT, refresh]);

  useEffect(() => {
    let isCancel = false;
    (async () => {
      if (network?.id) {
        const data = await serviceNFT.fetchSymbolPrice(network.id);
        if (!isCancel) {
          updatePrice(data);
        }
      }
    })();
    return () => {
      isCancel = true;
    };
  }, [network, serviceNFT]);

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
      if (!account || !network) return;

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
    [account, navigation, network],
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
