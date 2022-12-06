import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { BlurView } from 'expo-blur';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  CustomSkeleton,
  HStack,
  Icon,
  IconButton,
  Modal,
  Pressable,
  ScrollView,
  Skeleton,
  Text,
  Typography,
  VStack,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useTheme,
  useToast,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { Collection } from '@onekeyhq/engine/src/types/nft';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import {
  getActiveWalletAccount,
  useActiveWalletAccount,
} from '@onekeyhq/kit/src/hooks/redux';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { SendRoutes } from '../../../../routes';
import CollectionLogo from '../../../NFTMarket/CollectionLogo';
import { useCollectionDetail } from '../../../NFTMarket/Home/hook';

import CollectibleContent from './CollectibleContent';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

type Props = {
  imageContent: JSX.Element;
  content: JSX.Element | null;
};

function isImage(contentType?: string | null) {
  if (
    contentType === 'image/jpeg' ||
    contentType === 'image/jpg' ||
    contentType === 'image/png'
  ) {
    return true;
  }
  return false;
}

const NFTDetailModal: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const modalClose = useModalClose();
  const { themeVariant } = useTheme();
  const { bottom } = useSafeAreaInsets();

  const { wallet } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isSmallScreen = useIsVerticalLayout();
  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.NFTDetailModal
      >
    >();
  const { network, asset: outerAsset, isOwner } = route.params;

  const [asset, updateAsset] = useState(outerAsset);
  const { serviceNFT } = backgroundApiProxy;

  let hasBlurViewBG = isImage(asset.contentType);
  if (asset.nftscanUri && asset.nftscanUri?.length > 0) {
    hasBlurViewBG = true;
  }
  hasBlurViewBG = !!(asset.nftscanUri && asset.nftscanUri?.length > 0);
  useEffect(() => {
    (async () => {
      if (network.id) {
        if (network.id === OnekeyNetwork.sol) {
          const data = await serviceNFT.fetchAsset({
            chain: network.id,
            tokenId: outerAsset.tokenAddress as string,
          });
          if (data) {
            updateAsset(data);
          }
        } else {
          const data = await serviceNFT.fetchAsset({
            chain: network.id,
            contractAddress: outerAsset.contractAddress,
            tokenId: outerAsset.tokenId as string,
            showAttribute: true,
          });
          if (data) {
            updateAsset(data);
          }
        }
      }
    })();
  }, [
    outerAsset.contractAddress,
    outerAsset.tokenAddress,
    outerAsset.tokenId,
    network.id,
    serviceNFT,
  ]);

  const isEVM = network.impl === IMPL_EVM;
  const [collection, updateCollection] = useState<Collection>();
  useEffect(() => {
    (async () => {
      if (network.id && isEVM) {
        const data = await serviceNFT.getCollection({
          chain: network.id,
          contractAddress: outerAsset.contractAddress as string,
        });
        if (data) {
          updateCollection(data);
        }
      }
    })();
  }, [outerAsset.contractAddress, network.id, serviceNFT, isEVM]);

  const isDisabled = wallet?.type === WALLET_TYPE_WATCHING;

  const goToCollectionDetail = useCollectionDetail();
  const sendAction = () => {
    const { accountId, networkId } = getActiveWalletAccount();
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Send,
      params: {
        screen: SendRoutes.PreSendAddress,
        params: {
          accountId,
          networkId,
          isNFT: true,
          from: '',
          to: '',
          amount: outerAsset.amount ?? '1',
          token: asset.contractAddress ?? asset.tokenAddress,
          tokenId: asset.tokenId ?? asset.tokenAddress,
          type: asset.ercType,
          closeModal: modalClose,
        },
      },
    });
  };

  const shareProps: Props = {
    imageContent: (
      <>
        {/* eslint-disable-next-line no-nested-ternary */}
        {(isSmallScreen && platformEnv.isExtension) ||
        platformEnv.isNativeIOSPad ? (
          <Box overflow="hidden" mt="-16px" mr="-16px" ml="-16px">
            {hasBlurViewBG && (
              <Center position="absolute" top={0} right={0} bottom={0} left={0}>
                <CollectibleContent
                  asset={asset}
                  size={platformEnv.isExtension ? 360 : 680}
                />
              </Center>
            )}
            <BlurView
              tint={themeVariant === 'light' ? 'light' : 'dark'}
              intensity={100}
              style={{
                alignItems: 'center',
                padding: 24,
              }}
            >
              <CollectibleContent asset={asset} />
            </BlurView>
          </Box>
        ) : isSmallScreen ? (
          <CollectibleContent asset={asset} />
        ) : (
          <Box
            alignSelf="stretch"
            borderLeftRadius={24}
            mr="24px"
            overflow="hidden"
          >
            {hasBlurViewBG && (
              <Center position="absolute" top={0} right={0} bottom={0} left={0}>
                <CollectibleContent
                  asset={asset}
                  size={platformEnv.isExtension ? 360 : 680}
                />
              </Center>
            )}
            <BlurView
              tint={themeVariant === 'light' ? 'light' : 'dark'}
              intensity={100}
              style={{
                flex: 1,
                alignSelf: 'stretch',
                justifyContent: 'center',
                padding: 24,
              }}
            >
              <CollectibleContent asset={asset} />
            </BlurView>
          </Box>
        )}
      </>
    ),
    content: asset && (
      <VStack space="24px" mb="50px">
        {/* Asset name and collection name */}
        <Box>
          <Typography.DisplayLarge fontWeight="700">
            {asset.name && asset.name.length > 0
              ? asset.name
              : `#${asset.tokenId as string}`}
          </Typography.DisplayLarge>
          <HStack space="8px" mt="4px">
            <Text typography="Body1" color="text-subdued">
              {intl.formatMessage({ id: 'content__last_sale' })}
            </Text>
            <Text typography="Body1Strong" color="text-subdued">
              {(asset.latestTradePrice &&
                asset.latestTradeSymbol &&
                `${asset.latestTradePrice} ${asset.latestTradeSymbol}`) ||
                'N/A'}
            </Text>
          </HStack>
          {/* {!!asset.collection.contractName && (
            <Typography.Body2 color="text-subdued">
              {asset.collection.contractName}
            </Typography.Body2>
          )} */}
        </Box>

        {/* Collection */}
        {isEVM && (
          <Pressable
            onPress={() => {
              goToCollectionDetail({
                networkId: network.id,
                contractAddress: collection?.contractAddress as string,
                collection,
                title: collection?.name,
              });
            }}
          >
            {({ isHovered, isPressed }) => (
              <HStack
                px="16px"
                py="12px"
                rounded="12px"
                space="12px"
                borderWidth={StyleSheet.hairlineWidth}
                alignItems="center"
                borderColor="border-default"
                bgColor={
                  // eslint-disable-next-line no-nested-ternary
                  isPressed
                    ? 'surface-pressed'
                    : isHovered
                    ? 'surface-hovered'
                    : 'surface-default'
                }
              >
                {collection ? (
                  <CollectionLogo
                    src={collection.logoUrl}
                    width="40px"
                    height="40px"
                  />
                ) : (
                  <CustomSkeleton
                    width="40px"
                    height="40px"
                    borderRadius="12px"
                  />
                )}
                <Box flex={1}>
                  <Text typography="Body1Strong">
                    {asset.collection.contractName}
                  </Text>
                  <Box mt="4px">
                    {collection ? (
                      <Text typography="Body2" color="text-subdued">
                        {`${
                          collection?.itemsTotal ?? '-'
                        } Items • ${intl.formatMessage({
                          id: 'content__floor',
                        })} ${
                          collection.floorPrice
                            ? `${collection.floorPrice} ${
                                collection.priceSymbol as string
                              }`
                            : '-'
                        }`}
                      </Text>
                    ) : (
                      <Skeleton shape="Body2" />
                    )}
                  </Box>
                </Box>
                <Icon name="ChevronRightMini" />
              </HStack>
            )}
          </Pressable>
        )}

        {isOwner && (
          <HStack space="16px">
            <Button
              type="primary"
              isDisabled={isDisabled}
              width="full"
              size="lg"
              leftIconName="ArrowUpMini"
              onPress={sendAction}
            >
              {intl.formatMessage({
                id: 'action__send',
              })}
            </Button>
            {/* More button in future */}
          </HStack>
        )}

        {/* Description */}
        {!!asset.description && (
          <Typography.Body2 color="text-subdued">
            {asset.description}
          </Typography.Body2>
        )}

        {/* traits */}
        {isEVM && !!asset.assetAttributes?.length && (
          <VStack space="16px">
            <Typography.Heading>
              {intl.formatMessage({ id: 'content__attributes' })}
            </Typography.Heading>
            {platformEnv.isNative ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  mb="-8px"
                  mx="-16px"
                  pl="16px"
                >
                  {asset.assetAttributes.map((trait, index) => (
                    <Box
                      key={`${trait.attribute_name}-${index}`}
                      px="12px"
                      py="8px"
                      mr="8px"
                      mb="8px"
                      bgColor="surface-neutral-subdued"
                      borderRadius="12px"
                    >
                      <HStack justifyContent="space-between" mb="4px">
                        <Typography.Caption
                          mr="12px"
                          numberOfLines={1}
                          color="text-subdued"
                        >
                          {trait.attribute_name}
                        </Typography.Caption>
                        <Typography.Caption color="text-success">
                          {trait.percentage}
                        </Typography.Caption>
                      </HStack>
                      <Typography.Body2Strong>
                        {trait.attribute_value}
                      </Typography.Body2Strong>
                    </Box>
                  ))}
                </ScrollView>
              </>
            ) : (
              <Box flexDirection="row" flexWrap="wrap" mb="-8px" mr="-8px">
                {asset.assetAttributes.map((trait, index) => (
                  <Box
                    key={`${trait.attribute_name}-${index}`}
                    px="12px"
                    py="8px"
                    mr="8px"
                    mb="8px"
                    bgColor="surface-neutral-subdued"
                    borderRadius="12px"
                  >
                    <HStack justifyContent="space-between" mb="4px">
                      <Typography.Caption
                        mr="12px"
                        numberOfLines={1}
                        color="text-subdued"
                      >
                        {trait.attribute_name}
                      </Typography.Caption>
                      <Typography.Caption color="text-success">
                        {trait.percentage}
                      </Typography.Caption>
                    </HStack>
                    <Typography.Body2Strong>
                      {trait.attribute_value}
                    </Typography.Body2Strong>
                  </Box>
                ))}
              </Box>
            )}
          </VStack>
        )}

        {/* Details */}
        <Box>
          <Typography.Heading mb="16px">
            {intl.formatMessage({ id: 'content__details' })}
          </Typography.Heading>
          <VStack space="16px">
            {!!asset.contractAddress && (
              <HStack space="12px">
                <Typography.Body2Strong color="text-subdued" flex={1}>
                  {intl.formatMessage({
                    id: 'transaction__contract_address',
                  })}
                </Typography.Body2Strong>

                <Pressable
                  flexDirection="row"
                  onPress={() => {
                    copyToClipboard(asset.contractAddress ?? '');
                    toast.show({
                      title: intl.formatMessage({ id: 'msg__copied' }),
                    });
                  }}
                >
                  <Typography.Body2Strong mr="8px">
                    {shortenAddress(asset.contractAddress, 6)}
                  </Typography.Body2Strong>
                  <Icon name="Square2StackMini" size={20} />
                </Pressable>
              </HStack>
            )}
            {!!asset.tokenAddress && (
              <HStack space="12px">
                <Typography.Body2Strong color="text-subdued" flex={1}>
                  NFT ID
                </Typography.Body2Strong>
                <Pressable
                  flexDirection="row"
                  onPress={() => {
                    copyToClipboard(asset.tokenId ?? '');
                    toast.show({
                      title: intl.formatMessage({ id: 'msg__copied' }),
                    });
                  }}
                >
                  <Typography.Body2Strong mr="8px" isTruncated maxW="160px">
                    {asset.tokenAddress}
                  </Typography.Body2Strong>
                  <Icon name="Square2StackMini" size={20} />
                </Pressable>
              </HStack>
            )}
            {!!asset.tokenId && (
              <HStack space="12px">
                <Typography.Body2Strong color="text-subdued" flex={1}>
                  NFT ID
                </Typography.Body2Strong>
                <Pressable
                  flexDirection="row"
                  onPress={() => {
                    copyToClipboard(asset.tokenId ?? '');
                    toast.show({
                      title: intl.formatMessage({ id: 'msg__copied' }),
                    });
                  }}
                >
                  <Typography.Body2Strong mr="8px" isTruncated maxW="160px">
                    {asset.tokenId}
                  </Typography.Body2Strong>
                  <Icon name="Square2StackMini" size={20} />
                </Pressable>
              </HStack>
            )}
            {!!asset.ercType && (
              <HStack space="12px">
                <Typography.Body2Strong color="text-subdued" flex={1}>
                  {intl.formatMessage({
                    id: 'content__nft_standard',
                  })}
                </Typography.Body2Strong>
                <Typography.Body2Strong>{asset.ercType}</Typography.Body2Strong>
              </HStack>
            )}
            {!!network && (
              <HStack space="12px">
                <Typography.Body2Strong color="text-subdued" flex={1}>
                  {intl.formatMessage({ id: 'content__blockchain' })}
                </Typography.Body2Strong>

                <Typography.Body2Strong>{network.name}</Typography.Body2Strong>
              </HStack>
            )}
          </VStack>
        </Box>
      </VStack>
    ),
  };

  const Desktop: FC<Props> = ({ imageContent, content }) => (
    <Box flexDirection="row">
      {imageContent}
      <ScrollView h="640px" p="24px">
        {content}
      </ScrollView>
    </Box>
  );
  const Mobile: FC<Props> = ({ imageContent, content }) => (
    <ScrollView p="16px">
      {imageContent}
      <Box mt="24px" mb={bottom}>
        {content}
      </Box>
    </ScrollView>
  );

  const modalContent = () =>
    isSmallScreen || platformEnv.isNativeIOSPad ? (
      <Mobile {...shareProps} />
    ) : (
      <Desktop {...shareProps} />
    );
  return (
    <Modal
      size="2xl"
      footer={null}
      headerShown={false}
      staticChildrenProps={{ p: 0, flex: 1 }}
    >
      <IconButton
        name="XMarkMini"
        size="xs"
        position="absolute"
        top={platformEnv.isExtension ? '8px' : '24px'}
        right={platformEnv.isExtension ? '8px' : '24px'}
        circle
        zIndex={1}
        onPress={modalClose}
      />
      {modalContent()}
    </Modal>
  );
};

export default NFTDetailModal;
