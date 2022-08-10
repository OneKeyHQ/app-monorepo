import React, { useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Empty, Spinner } from '@onekeyhq/components';
import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import { Network } from '@onekeyhq/engine/src/types/network';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import IconNFT from '@onekeyhq/kit/assets/3d_nft.png';
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
// import { collectibles } from './mockData';
import { useCollectiblesData } from './useCollectiblesData';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

export type CollectiblesProps = {
  address?: string | null;
  network?: Network | null;
};

function CollectibleListView({ address, network }: CollectiblesProps) {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isCollectibleSupported = isCollectibleSupportedChainId(network?.id);
  const intl = useIntl();

  const { collectibles, isLoading, fetchData } = useCollectiblesData({
    network,
    address,
    isCollectibleSupported,
  });
  // console.log('collectibles = ', collectibles);

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

  if (!isCollectibleSupported) {
    return (
      <Box py={4}>
        <Empty
          imageUrl={IconNFT}
          title={intl.formatMessage({ id: 'empty__not_supported' })}
          subTitle={intl.formatMessage({ id: 'empty__not_supported_desc' })}
        />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Center pb={8} pt={8}>
        <Spinner size="lg" />
      </Center>
    );
  }
  if (collectibles.length === 0) {
    return (
      <Box py={4}>
        <Empty
          imageUrl={IconNFT}
          title={intl.formatMessage({
            id: 'asset__collectibles_empty_title',
          })}
          subTitle={intl.formatMessage({
            id: 'asset__collectibles_empty_desc',
          })}
          actionTitle={intl.formatMessage({ id: 'action__refresh' })}
          handleAction={fetchData}
        />
      </Box>
    );
  }

  return (
    <CollectibleGallery
      collectibles={collectibles}
      onSelectCollection={handleSelectCollectible}
      onSelectAsset={handleSelectAsset}
    />
  );
}

export default React.memo(CollectibleListView);
