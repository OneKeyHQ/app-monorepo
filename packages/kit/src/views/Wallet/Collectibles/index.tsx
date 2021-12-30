import React, { useCallback, useState } from 'react';

import { Box } from '@onekeyhq/components';

import { ScrollRoute } from '../type';

import AssetModal from './AssetModal';
import CollectibleGallery from './CollectibleGallery';
import CollectionModal from './CollectionModal';
import { ASSETS } from './data';
import { Collectible, SelectedAsset } from './types';

const useDisclose = (initState?: boolean) => {
  const [isOpen, setIsOpen] = useState(initState || false);
  const onOpen = () => {
    setIsOpen(true);
  };
  const onClose = () => {
    setIsOpen(false);
  };
  const onToggle = () => {
    setIsOpen(!isOpen);
  };
  return {
    isOpen,
    onOpen,
    onClose,
    onToggle,
  };
};

const Collectibles = ({ route }: { route: ScrollRoute }) => {
  const tabPageIndex = route.index;
  const [collectibles] = useState<Collectible[]>(ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(
    null,
  );
  const [selectedCollectible, setSelectedCollectible] =
    useState<Collectible | null>(null);
  const assetModalConfig = useDisclose();
  const collectibleModalConfig = useDisclose();

  const handleSelectAsset = useCallback(
    (asset: SelectedAsset) => {
      setSelectedAsset(asset);
      if (collectibleModalConfig.isOpen) {
        collectibleModalConfig.onClose();
      }
      assetModalConfig.onOpen();
    },
    [assetModalConfig, collectibleModalConfig],
  );
  const handleSelectCollectible = useCallback(
    (collectible: Collectible) => {
      setSelectedCollectible(collectible);
      collectibleModalConfig.onOpen();
    },
    [collectibleModalConfig],
  );
  const handleCloseAssetModal = useCallback(() => {
    assetModalConfig.onClose();
    setSelectedAsset(null);
    if (selectedCollectible) {
      collectibleModalConfig.onOpen();
    }
  }, [assetModalConfig, collectibleModalConfig, selectedCollectible]);
  const handleCloseCollectibleModal = useCallback(() => {
    collectibleModalConfig.onClose();
    setSelectedCollectible(null);
  }, [collectibleModalConfig]);

  return (
    <Box flex={1} p={4}>
      <CollectibleGallery
        index={tabPageIndex}
        collectibles={collectibles}
        onSelectCollectible={handleSelectCollectible}
        onSelectAsset={handleSelectAsset}
      />
      <CollectionModal
        collectible={selectedCollectible}
        visible={collectibleModalConfig.isOpen}
        onClose={handleCloseCollectibleModal}
        onSelectAsset={handleSelectAsset}
      />
      <AssetModal
        asset={selectedAsset}
        visible={assetModalConfig.isOpen}
        onClose={handleCloseAssetModal}
      />
    </Box>
  );
};

export default Collectibles;
