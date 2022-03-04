import React, { FC, useEffect, useRef, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Center,
  Divider,
  Icon,
  Image,
  Modal,
  Spinner,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { getUserAsset } from '@onekeyhq/engine/src/managers/opensea';
import { OpenSeaAsset } from '@onekeyhq/engine/src/types/opensea';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { useToast } from '../../../hooks/useToast';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

const MODAL_PADDING = 8;

const CollectibleDetailModal: FC = () => {
  const intl = useIntl();
  const { width } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();
  // use modal content width 352px on larger screens
  const imageWidth = isSmallScreen ? width - MODAL_PADDING * 2 : 352;
  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.CollectibleDetailModal
      >
    >();
  const { tokenId, contractAddress, chainName, chainId } = route.params;
  const [asset, setAsset] = useState<OpenSeaAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigation = useNavigation<NavigationProps['navigation']>();
  const toast = useToast();
  const toastId = useRef<string>();

  useEffect(() => {
    if (!contractAddress || !tokenId || !!asset) {
      return;
    }

    (async () => {
      setIsLoading(true);
      try {
        const assetFromBe = await getUserAsset({
          chainId,
          contractAddress,
          tokenId: tokenId.toString(),
        });
        setAsset(assetFromBe);
        setIsLoading(false);
      } catch (e) {
        console.log(`Error on fetching nft asset ${tokenId}`);
        const error = e as Error | string | null | undefined;
        const message = typeof error === 'string' ? error : error?.message;
        if (message && !toastId.current) {
          toastId.current = toast.show({
            title: message,
          });
        }
        // Delay after hook
        setTimeout(() => {
          const navParent = navigation.getParent();
          if (navParent?.canGoBack()) {
            return navParent.goBack();
          }
        }, 50);
      }
    })();
  }, [tokenId, contractAddress, chainId, navigation, toast, asset]);

  if (!asset) {
    if (isLoading) {
      return (
        <Modal
          footer={null}
          height="640px"
          scrollViewProps={{
            children: (
              <Center flex={1}>
                <Spinner size="lg" />
              </Center>
            ),
          }}
        />
      );
    }
    return null;
  }

  return (
    <Modal
      footer={null}
      height="640px"
      scrollViewProps={{
        children: (
          <Center>
            <Image
              flex="1"
              alt={`image of ${
                typeof asset.name === 'string' ? asset.name : 'nft'
              }`}
              height={imageWidth}
              width={imageWidth}
              borderRadius="20px"
              src={
                asset.imageUrl ??
                asset.imagePreviewUrl ??
                asset.imageOriginalUrl ??
                undefined
              }
              fallbackElement={
                <Center
                  width={imageWidth}
                  height="333px"
                  bgColor="surface-default"
                  borderRadius="20px"
                >
                  <Icon name="QuestionMarkCircleOutline" size={166} />
                </Center>
              }
            />

            <VStack mt={6} space={6} w="100%">
              {/* Asset name and collection name */}
              <VStack>
                <Typography.DisplayLarge fontWeight="700">
                  {asset.name}
                </Typography.DisplayLarge>
                {!!asset.collection.name && (
                  <Typography.Body2 color="text-subdued">
                    {asset.collection.name}
                  </Typography.Body2>
                )}
              </VStack>

              {/* Description */}
              {!!asset.description && (
                <VStack space={3}>
                  <Typography.Heading fontWeight="600">
                    {intl.formatMessage({ id: 'content__description' })}
                  </Typography.Heading>
                  <Typography.Body2 color="text-subdued">
                    {asset.description}
                  </Typography.Body2>
                </VStack>
              )}

              {/* traits */}
              {!!asset.traits?.length && (
                <VStack space={3}>
                  <Typography.Heading>
                    {intl.formatMessage({ id: 'content__attributes' })}
                  </Typography.Heading>
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
                        <Typography.Caption
                          color="text-subdued"
                          textTransform="uppercase"
                        >
                          {trait.traitType}
                        </Typography.Caption>
                        <Typography.Body2>{trait.value}</Typography.Body2>
                      </Box>
                    ))}
                  </Box>
                </VStack>
              )}

              {/* Details */}
              <VStack>
                <Typography.Heading>
                  {intl.formatMessage({ id: 'content__details' })}
                </Typography.Heading>
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
                {!!chainName && (
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
                        {chainName}
                      </Typography.Body1Strong>
                    </Box>
                  </>
                )}
                {!!contractAddress && (
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
                        {contractAddress}
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
