import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { BlurView } from 'expo-blur';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
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
  ToastManager,
  Typography,
  VStack,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import NavigationButton from '@onekeyhq/components/src/Modal/Container/Header/NavigationButton';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { getContentWithAsset } from '@onekeyhq/engine/src/managers/nft';
import type { Device } from '@onekeyhq/engine/src/types/device';
import type { Collection } from '@onekeyhq/engine/src/types/nft';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import {
  getActiveWalletAccount,
  useActiveWalletAccount,
} from '@onekeyhq/kit/src/hooks/redux';
import type { CollectiblesRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Collectibles';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { generateUploadNFTParams } from '@onekeyhq/kit/src/utils/hardware/nftUtils';
import NFTDetailMenu from '@onekeyhq/kit/src/views/Overlay/NFTDetailMenu';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { SendModalRoutes } from '../../../../routes/routesEnum';
// import hardware from '../../../../store/reducers/hardware';
import { deviceUtils } from '../../../../utils/hardware';
import CollectionLogo from '../../../NFTMarket/CollectionLogo';
import { useCollectionDetail } from '../../../NFTMarket/Home/hook';
import { showAmountInputDialog } from '../AmountInputDialog';
import { convertToMoneyFormat } from '../utils';

import CollectibleContent from './CollectibleContent';

import type { CollectiblesModalRoutes } from '../../../../routes/routesEnum';
import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';
import type { RouteProp } from '@react-navigation/core';

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

const Desktop: FC<Props> = ({ imageContent, content }) => (
  <Box flexDirection="row">
    {imageContent}
    <ScrollView h="640px" p="24px">
      {content}
    </ScrollView>
  </Box>
);
const Mobile: FC<Props> = ({ imageContent, content }) => {
  const { bottom } = useSafeAreaInsets();

  return (
    <ScrollView p="16px">
      {imageContent}
      <Box mt="24px" mb={bottom}>
        {content}
      </Box>
    </ScrollView>
  );
};

const NFTDetailModal: FC = () => {
  const intl = useIntl();

  const modalClose = useModalClose();
  const { themeVariant } = useTheme();

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
  const { serviceNFT, serviceHardware } = backgroundApiProxy;

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

  const [showMenu, setShowMenu] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  useEffect(() => {
    (async () => {
      if (!wallet || wallet.type !== 'hw') {
        setShowMenu(false);
        return;
      }
      const hwDevice = await backgroundApiProxy.engine.getHWDeviceByWalletId(
        wallet.id,
      );
      const supportContentType = [
        'image/gif',
        'image/svg',
        'image/png',
        'image/jpeg',
        'image/jpg',
      ];
      const isSupportType = supportContentType.includes(
        asset.contentType ?? '',
      );
      setShowMenu(hwDevice?.deviceType === 'touch' && isSupportType);
      setDevice(hwDevice);
    })();
  }, [wallet, asset]);

  const hardwareCancelFlagRef = useRef(false);
  const onCollectToTouch = useCallback(async () => {
    let uri;
    if (asset.nftscanUri && asset.nftscanUri.length > 0) {
      uri = asset.nftscanUri;
    } else {
      uri = getContentWithAsset(asset);
    }

    if (!uri) return;

    setMenuLoading(true);
    let uploadResParams: DeviceUploadResourceParams | undefined;
    try {
      uploadResParams = await generateUploadNFTParams(uri, {
        header:
          asset.name && asset.name.length > 0
            ? asset.name
            : `#${asset.tokenId as string}`,
        subheader: asset.description ?? '',
        network: network.name,
        owner: asset.owner,
      });
      debugLogger.hardwareSDK.info('should upload: ', uploadResParams);
    } catch (e) {
      debugLogger.hardwareSDK.info('image operate error: ', e);
      ToastManager.show(
        {
          title: intl.formatMessage({ id: 'msg__image_download_failed' }),
        },
        {
          type: 'error',
        },
      );
      setMenuLoading(false);
      return;
    }
    if (uploadResParams && !hardwareCancelFlagRef.current) {
      try {
        await serviceHardware.uploadResource(
          device?.mac ?? '',
          uploadResParams,
        );
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__change_saved' }),
        });
      } catch (e) {
        deviceUtils.showErrorToast(e);
      } finally {
        setMenuLoading(false);
      }
    }
  }, [asset, device, intl, serviceHardware, network]);

  const sendNFTWithAmount = useCallback(
    (amount: string) => {
      const { accountId, networkId } = getActiveWalletAccount();
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.PreSendAddress,
          params: {
            accountId,
            networkId,
            isNFT: true,
            from: '',
            to: '',
            amount,
            token: asset.contractAddress ?? asset.tokenAddress,
            tokenId: asset.tokenId ?? asset.tokenAddress,
            type: asset.ercType,
            closeModal: modalClose,
          },
        },
      });
    },
    [
      asset.contractAddress,
      asset.ercType,
      asset.tokenAddress,
      asset.tokenId,
      modalClose,
      navigation,
    ],
  );

  const goToCollectionDetail = useCollectionDetail();
  const sendAction = () => {
    if (outerAsset.amount && new BigNumber(outerAsset.amount).gt(1)) {
      showAmountInputDialog({
        total: outerAsset.amount,
        onConfirm: (amount) => {
          console.log('amount = ', amount);
          sendNFTWithAmount(amount);
        },
      });
      return;
    }
    sendNFTWithAmount('1');
  };

  const AmountTag = useMemo(() => {
    if (
      outerAsset?.amount &&
      isOwner &&
      Number(outerAsset?.amount) > 1 &&
      outerAsset.ercType === 'erc1155'
    ) {
      return (
        <Badge
          position="absolute"
          right="8px"
          bottom="8px"
          title={`X ${convertToMoneyFormat(outerAsset.amount)}`}
          size="sm"
          type="default"
        />
      );
    }
    return null;
  }, [outerAsset.amount, outerAsset.ercType, isOwner]);

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
              {AmountTag}
            </BlurView>
          </Box>
        ) : isSmallScreen ? (
          <Box>
            <CollectibleContent asset={asset} />
            {AmountTag}
          </Box>
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
              {AmountTag}
            </BlurView>
          </Box>
        )}
      </>
    ),
    content: asset && (
      <VStack space="24px" mb="50px">
        {/* Asset name and collection name */}
        <Box>
          <HStack alignItems="stretch" justifyContent="space-between">
            <Text
              typography={{ sm: 'DisplayLarge', md: 'DisplayLarge' }}
              fontWeight="700"
            >
              {asset.name && asset.name.length > 0
                ? asset.name
                : `#${asset.tokenId as string}`}
            </Text>
            {showMenu && (
              <NFTDetailMenu onCollectToTouch={onCollectToTouch}>
                <IconButton
                  name="EllipsisVerticalOutline"
                  size={isSmallScreen ? 'sm' : 'xs'}
                  type="basic"
                  circle
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="border-default"
                  h={{ base: 34, sm: 30 }}
                  ml={3}
                  mr={{ base: 0, sm: 10 }}
                  isLoading={menuLoading}
                  isDisabled={menuLoading}
                />
              </NFTDetailMenu>
            )}
          </HStack>
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
                    ? 'action-secondary-pressed'
                    : isHovered
                    ? 'action-secondary-hovered'
                    : 'action-secondary-default'
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
                <Icon name="ChevronRightMini" color="icon-subdued" />
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
                    ToastManager.show({
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
                    copyToClipboard(asset.tokenAddress ?? '');
                    ToastManager.show({
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
                    ToastManager.show({
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
      <NavigationButton
        position="absolute"
        top={platformEnv.isExtensionUiPopup ? '8px' : '24px'}
        right={platformEnv.isExtensionUiPopup ? '8px' : '24px'}
        zIndex={1}
        onPress={() => {
          hardwareCancelFlagRef.current = true;
          modalClose();
        }}
      />
      {modalContent()}
    </Modal>
  );
};

export default NFTDetailModal;
