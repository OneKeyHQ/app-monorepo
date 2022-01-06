import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Icon,
  Image,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';

import { ASSETS } from './data';
import { SelectedAsset } from './types';

const getAsset = (id: string | number): SelectedAsset | null => {
  const collectible = ASSETS.find((col) =>
    col.assets.find((asset) => String(asset.id) === String(id)),
  );

  if (!collectible) {
    return null;
  }

  const asset = collectible.assets.find(
    (item) => String(item.id) === String(id),
  );

  if (!asset) {
    return null;
  }

  return {
    ...asset,
    chain: collectible.chain,
    contractAddress: collectible.contract.address,
  };
};

const CollectibleDetailModal: FC = () => {
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.CollectibleDetailModal
      >
    >();
  const { assetId } = route.params;
  const asset = getAsset(assetId);

  if (!asset) return null;

  return (
    <Modal
      header={asset.name ?? ''}
      footer={null}
      scrollViewProps={{
        pt: 4,
        children: (
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
                        <Typography.Caption>
                          {trait.traitType}
                        </Typography.Caption>
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
                  <Typography.Body1Strong color="text-subdued">
                    Token ID
                  </Typography.Body1Strong>
                  <Typography.Body1Strong
                    ml="4"
                    textAlign="right"
                    flex="1"
                    numberOfLines={999}
                  >
                    {asset.tokenId}
                  </Typography.Body1Strong>
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
                      <Typography.Body1Strong color="text-subdued">
                        {intl.formatMessage({ id: 'content__blockchain' })}
                      </Typography.Body1Strong>

                      <Typography.Body1Strong
                        ml="4"
                        flex="1"
                        textAlign="right"
                        numberOfLines={999}
                      >
                        {asset.chain}
                      </Typography.Body1Strong>
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
                      <Typography.Body1Strong color="text-subdued">
                        {intl.formatMessage({
                          id: 'transaction__contract_address',
                        })}
                      </Typography.Body1Strong>

                      <Typography.Body1Strong
                        ml="4"
                        flex="1"
                        textAlign="right"
                        numberOfLines={999}
                      >
                        {asset.contractAddress}
                      </Typography.Body1Strong>
                    </Box>
                  </>
                )}
              </VStack>
            </VStack>
          </Center>
        ),
      }}
    />
  );
};

export default CollectibleDetailModal;
