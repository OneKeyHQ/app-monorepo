import React, { FC } from 'react';

import {
  Center,
  HStack,
  Modal,
  NftCard,
  ScrollView,
  Token,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';

import { Collectible, SelectedAsset } from './types';

type CollectionModalProps = {
  collectible: Collectible | null;
  visible: boolean;
  onClose: () => void;
  onSelectAsset: (asset: SelectedAsset) => void;
};

const CollectionModal: FC<CollectionModalProps> = ({
  collectible,
  visible,
  onClose,
  onSelectAsset,
}) => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);

  if (!collectible) return null;

  return (
    <Modal
      visible={visible}
      header={collectible.collection.name ?? ''}
      onClose={onClose}
      footer={null}
    >
      <ScrollView flex={1} mx={-2}>
        <Center>
          <Token
            size="56px"
            src={collectible.collection.imageUrl ?? undefined}
          />
          <Typography.Heading mt="3">
            {collectible.collection.name}
          </Typography.Heading>
          <Typography.Body2 my="6" color="text-subdued">
            {collectible.collection.description}
          </Typography.Body2>

          <VStack space={3} w="100%">
            <HStack
              flexWrap="wrap"
              space={0}
              alignItems="center"
              justifyContent={['space-between', 'initial']}
            >
              {collectible.assets.map((asset, index) => {
                const marginRight = isSmallScreen && !(index % 2 === 0) ? 0 : 4;

                return (
                  <NftCard
                    key={asset.id ?? asset.name}
                    image={asset.imageUrl}
                    title={asset.name}
                    mr={marginRight}
                    mb={4}
                    onPress={() =>
                      onSelectAsset({
                        ...asset,
                        chain: collectible.chain,
                        contractAddress: collectible.contract.address,
                      })
                    }
                  />
                );
              })}
            </HStack>
          </VStack>
        </Center>
      </ScrollView>
    </Modal>
  );
};

export default CollectionModal;
