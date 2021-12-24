import React, { useCallback, useEffect, useState } from 'react';

import {
  HStack,
  ScrollView,
  SegmentedControl,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';

import AssetModal from './AssetModal';
import CollectibleGallery from './CollectibleGallery';
import CollectionModal from './CollectionModal';
import { ASSETS } from './data';
import { Collectible, CollectibleView, SelectedAsset } from './types';

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

const Collectibles = () => {
  const [view, setView] = useState(CollectibleView.Flat);
  const [collectibles] = useState<Collectible[]>(ASSETS);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(
    null,
  );
  const [selectedCollectible, setSelectedCollectible] =
    useState<Collectible | null>(null);
  const assetModalConfig = useDisclose();
  const collectibleModalConfig = useDisclose();

  // Set it to grid view when not in mobile
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  useEffect(() => {
    if (!isSmallScreen) {
      return setView(CollectibleView.Grid);
    }
  }, [isSmallScreen]);

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
    <ScrollView bg="background-default">
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
      <VStack space={3} w="100%" p={4}>
        {isSmallScreen && !!collectibles?.length && (
          <HStack alignItems="center" justifyContent="space-between">
            <Typography.Heading>Collectibles</Typography.Heading>
            <SegmentedControl
              containerProps={{
                width: 70,
                height: 35,
              }}
              options={[
                {
                  iconName: 'ViewListSolid',
                  value: CollectibleView.Flat,
                },
                {
                  iconName: 'ViewGridSolid',
                  value: CollectibleView.Grid,
                },
              ]}
              defaultValue={view}
              onChange={(newView) => setView(newView as CollectibleView)}
            />
          </HStack>
        )}

        <CollectibleGallery
          collectibles={collectibles}
          view={view}
          onSelectCollectible={handleSelectCollectible}
          onSelectAsset={handleSelectAsset}
        />
      </VStack>
    </ScrollView>
  );
};

export default Collectibles;
