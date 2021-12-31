import React, { FC } from 'react';

import {
  Box,
  Center,
  Divider,
  Icon,
  Image,
  Modal,
  ScrollView,
  Typography,
  VStack,
} from '@onekeyhq/components';

import { SelectedAsset } from './types';

type CollectionModalProps = {
  asset: SelectedAsset | null;
  visible: boolean;
  onClose: () => void;
};

const AssetModal: FC<CollectionModalProps> = ({ asset, visible, onClose }) => {
  if (!asset) return null;

  return (
    <Modal
      visible={visible}
      header={asset.name ?? ''}
      onClose={onClose}
      footer={null}
    >
      <ScrollView flex={1}>
        <Center>
          <Image
            flex="1"
            alt={`image of ${
              typeof asset.name === 'string' ? asset.name : 'nft'
            }`}
            height={333}
            width={333}
            borderRadius="20px"
            src={
              asset.imageUrl ??
              asset.imagePreviewUrl ??
              asset.imageOriginalUrl ??
              undefined
            }
            fallbackElement={
              <Center
                width="100%"
                height="333px"
                bgColor="surface-default"
                borderRadius="20px"
              >
                <Icon name="QuestionMarkOutline" size={233} />
              </Center>
            }
          />

          <VStack mt={6} space={6} w="100%">
            <VStack>
              <Typography.DisplayLarge>{asset.name}</Typography.DisplayLarge>
              <Typography.Body2 color="text-subdued">
                {asset.description}
              </Typography.Body2>
            </VStack>
            {!!asset.traits?.length && (
              <VStack space={3}>
                <Typography.Heading>Attributes</Typography.Heading>
                <Box flexDirection="row" flexWrap="wrap">
                  {asset.traits.map((trait, index) => (
                    <Box
                      key={`${trait.traitType}-${index}`}
                      alignSelf="flex-start"
                      px="3"
                      py="2"
                      mr="2"
                      mb="2"
                      bgColor="surface-default"
                      borderRadius="12px"
                    >
                      <Typography.Caption>{trait.traitType}</Typography.Caption>
                      <Typography.Body2>{trait.value}</Typography.Body2>
                    </Box>
                  ))}
                </Box>
              </VStack>
            )}

            <VStack>
              <Typography.Heading>Details</Typography.Heading>
              <Box
                flexDirection="row"
                alignItems="flex-start"
                justifyContent="space-between"
                py="4"
              >
                <Typography.Body1 fontWeight="600" color="text-subdued">
                  Token ID
                </Typography.Body1>
                <Typography.Body1
                  ml="4"
                  fontWeight="600"
                  textAlign="right"
                  flex="1"
                  numberOfLines={999}
                >
                  {asset.tokenId}
                </Typography.Body1>
              </Box>
              {!!asset.chain && (
                <>
                  <Divider />
                  <Box
                    display="flex"
                    flexDirection="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    py="4"
                  >
                    <Typography.Body1 fontWeight="600" color="text-subdued">
                      Blockchain
                    </Typography.Body1>

                    <Typography.Body1
                      ml="4"
                      flex="1"
                      fontWeight="600"
                      textAlign="right"
                      numberOfLines={999}
                    >
                      {asset.chain}
                    </Typography.Body1>
                  </Box>
                </>
              )}
              {!!asset.contractAddress && (
                <>
                  <Divider />
                  <Box
                    display="flex"
                    flexDirection="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    py="4"
                  >
                    <Typography.Body1 fontWeight="600" color="text-subdued">
                      Contract Address
                    </Typography.Body1>

                    <Typography.Body1
                      ml="4"
                      flex="1"
                      fontWeight="600"
                      textAlign="right"
                      numberOfLines={999}
                    >
                      {asset.contractAddress}
                    </Typography.Body1>
                  </Box>
                </>
              )}
            </VStack>
          </VStack>
        </Center>
      </ScrollView>
    </Modal>
  );
};

export default AssetModal;
