import React, { FC } from 'react';

import {
  Box,
  Center,
  Divider,
  Flex,
  Icon,
  Image,
  Modal,
  ScrollView,
  Stack,
  Typography,
  VStack,
  useUserDevice,
} from '@onekeyhq/components';

import { SelectedAsset } from './types';

type CollectionModalProps = {
  asset: SelectedAsset | null;
  visible: boolean;
  onClose: () => void;
};

const AssetModal: FC<CollectionModalProps> = ({ asset, visible, onClose }) => {
  const isSmallScreen = ['SMALL', 'NORMAL'].includes(useUserDevice().size);

  if (!asset) return null;

  return (
    <Modal
      visible={visible}
      header={asset.name ?? ''}
      onClose={onClose}
      // Kinda hack to hide the footer
      footer={<Typography.Body1 />}
    >
      <ScrollView flex={1} maxHeight={isSmallScreen ? undefined : '666px'}>
        <Stack
          alignItems="center"
          justifyContent="center"
          flexWrap="wrap"
          space={6}
        >
          <Box width="358px">
            <Box width="100%">
              <Image
                maxHeight="420px"
                minHeight="358px"
                minWidth={['166px', 'auto']}
                borderRadius="20px"
                src={
                  asset.imageUrl ??
                  asset.imagePreviewUrl ??
                  asset.imageOriginalUrl ??
                  undefined
                }
                fallbackElement={
                  <Center
                    width={420}
                    height={420}
                    borderRadius="full"
                    bg="background-selected"
                  >
                    <Icon name="EmptyNftIllus" />
                  </Center>
                }
              />
            </Box>
          </Box>

          <VStack space={6} w="100%">
            <VStack>
              <Typography.DisplayLarge>{asset.name}</Typography.DisplayLarge>
              <Typography.Body2 color="text-subdued">
                {asset.description}
              </Typography.Body2>
            </VStack>
            {!!asset.traits?.length && (
              <VStack space={3}>
                <Typography.Heading>Attributes</Typography.Heading>
                <Flex direction="row" wrap="wrap">
                  {asset.traits.map((trait) => (
                    <Box
                      px="3"
                      py="2"
                      width="fit-content"
                      mr="2"
                      bgColor="surface-default"
                      borderRadius="12px"
                    >
                      <Typography.Caption>{trait.traitType}</Typography.Caption>
                      <Typography.Body2>{trait.value}</Typography.Body2>
                    </Box>
                  ))}
                </Flex>
              </VStack>
            )}

            <VStack>
              <Typography.Heading>Details</Typography.Heading>
              <VStack divider={<Divider />}>
                <Flex
                  display="inline-flex"
                  direction="row"
                  align="start"
                  justify="space-between"
                  py="4"
                >
                  <Typography.Body1
                    fontWeight="600"
                    color="text-subdued"
                    minWidth="fit-content"
                  >
                    Token ID
                  </Typography.Body1>
                  <Typography.Body1
                    ml="4"
                    fontWeight="600"
                    textAlign="right"
                    wordBreak="break-all"
                  >
                    {asset.tokenId}
                  </Typography.Body1>
                </Flex>
                {!!asset.chain && (
                  <Flex
                    display="inline-flex"
                    direction="row"
                    align="start"
                    justify="space-between"
                    py="4"
                  >
                    <Typography.Body1
                      fontWeight="600"
                      color="text-subdued"
                      minWidth="fit-content"
                    >
                      Blockchain
                    </Typography.Body1>

                    <Typography.Body1
                      ml="4"
                      fontWeight="600"
                      textAlign="right"
                      wordBreak="break-all"
                    >
                      {asset.chain}
                    </Typography.Body1>
                  </Flex>
                )}
                {!!asset.contractAddress && (
                  <Flex
                    display="inline-flex"
                    direction="row"
                    align="start"
                    justify="space-between"
                    py="4"
                  >
                    <Typography.Body1
                      fontWeight="600"
                      color="text-subdued"
                      minWidth="fit-content"
                    >
                      Contract Address
                    </Typography.Body1>

                    <Typography.Body1
                      ml="4"
                      fontWeight="600"
                      textAlign="right"
                      wordBreak="break-all"
                    >
                      {asset.contractAddress}
                    </Typography.Body1>
                  </Flex>
                )}
              </VStack>
            </VStack>
          </VStack>
        </Stack>
      </ScrollView>
    </Modal>
  );
};

export default AssetModal;
