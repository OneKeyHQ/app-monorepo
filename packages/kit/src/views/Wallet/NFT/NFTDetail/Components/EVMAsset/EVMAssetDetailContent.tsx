import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  CustomSkeleton,
  HStack,
  IconButton,
  ScrollView,
  Skeleton,
  Text,
  ToastManager,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { getWalletIdFromAccountId } from '@onekeyhq/engine/src/managers/account';
import { getContentWithAsset } from '@onekeyhq/engine/src/managers/nft';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import { NFTAssetType } from '@onekeyhq/engine/src/types/nft';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import { generateUploadNFTParams } from '@onekeyhq/kit/src/utils/hardware/nftUtils';
import NFTDetailMenu from '@onekeyhq/kit/src/views/Overlay/NFTDetailMenu';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import { useNetwork, useWallet } from '../../../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../../../routes/routesEnum';
import { deviceUtils } from '../../../../../../utils/hardware';
import CollectionLogo from '../../../../../NFTMarket/CollectionLogo';
import { SendModalRoutes } from '../../../../../Send/enums';
import { showAmountInputDialog } from '../../../AmountInputDialog';
import { DetailItem } from '../DetailItem';
import { useDeviceMenu } from '../hooks/useDeviceMenu';

import type { CollectiblesRoutesParams } from '../../../../../../routes/Root/Modal/Collectibles';
import type { ModalScreenProps } from '../../../../../../routes/types';
import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

function EVMAssetDetailContent({
  asset: outerAsset,
  isOwner,
  networkId,
  accountId,
}: {
  asset: NFTAsset;
  isOwner: boolean;
  networkId: string;
  accountId?: string;
}) {
  const intl = useIntl();
  const { serviceNFT, serviceHardware } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps['navigation']>();

  const walletId = useMemo(() => {
    if (accountId) {
      return getWalletIdFromAccountId(accountId);
    }
    return null;
  }, [accountId]);

  const { wallet } = useWallet({ walletId });
  const modalClose = useModalClose();
  const isVertical = useIsVerticalLayout();
  const [asset, updateAsset] = useState(outerAsset);
  const isDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING || !accountId) {
      return true;
    }
    if (
      asset.ercType === 'erc721' &&
      asset.owner !== outerAsset.accountAddress
    ) {
      return true;
    }
    return false;
  }, [
    accountId,
    asset.ercType,
    asset.owner,
    outerAsset.accountAddress,
    wallet?.type,
  ]);

  const { network } = useNetwork({ networkId });

  const [menuLoading, setMenuLoading] = useState(false);
  const { device, showMenu } = useDeviceMenu({ wallet, asset });

  const hardwareCancelFlagRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (networkId) {
        const data = (await serviceNFT.fetchAsset({
          chain: networkId,
          contractAddress: outerAsset.contractAddress,
          tokenId: outerAsset.tokenId as string,
          showAttribute: true,
        })) as NFTAsset;
        if (data) {
          updateAsset(data);
        }
      }
    })();
    return () => {
      hardwareCancelFlagRef.current = true;
    };
  }, [outerAsset.contractAddress, outerAsset.tokenId, networkId, serviceNFT]);

  const isEVM = asset.type === NFTAssetType.EVM;
  const [collection, updateCollection] = useState<Collection>();
  useEffect(() => {
    (async () => {
      if (networkId && isEVM) {
        const data = await serviceNFT.getCollection({
          chain: networkId,
          contractAddress: outerAsset.contractAddress as string,
        });
        if (data) {
          updateCollection(data);
        }
      }
    })();
  }, [outerAsset.contractAddress, networkId, serviceNFT, isEVM]);

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
      uploadResParams = await generateUploadNFTParams(
        uri,
        {
          header:
            asset.name && asset.name.length > 0
              ? asset.name
              : `#${asset.tokenId as string}`,
          subheader: asset.description ?? '',
          network: network?.name ?? '',
          owner: asset.owner,
        },
        {
          deviceType: device?.deviceType,
        },
      );
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
    async (amount: string) => {
      const { accountAddress } = outerAsset ?? {};
      if (!networkId || !accountAddress) {
        return;
      }
      const account =
        await backgroundApiProxy.serviceAccount.getAccountByAddress({
          networkId,
          address: accountAddress ?? '',
        });
      if (!account) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.PreSendAddress,
          params: {
            accountId: account?.id,
            networkId,
            isNFT: true,
            from: '',
            to: '',
            amount,
            token: asset.contractAddress,
            nftTokenId: asset.tokenId,
            nftType: asset.ercType,
            closeModal: modalClose,
          },
        },
      });
    },
    [
      asset.contractAddress,
      asset.ercType,
      asset.tokenId,
      modalClose,
      navigation,
      networkId,
      outerAsset,
    ],
  );

  const sendAction = () => {
    if (outerAsset.amount && new BigNumber(outerAsset.amount).gt(1)) {
      showAmountInputDialog({
        total: outerAsset.amount,
        onConfirm: (amount) => {
          sendNFTWithAmount(amount);
        },
      });
      return;
    }
    sendNFTWithAmount('1');
  };

  return (
    <VStack space="24px" mb="50px">
      {/* Asset name and collection name */}
      <Box>
        <HStack alignItems="stretch" justifyContent="space-between">
          <Text
            typography={{ sm: 'DisplayLarge', md: 'DisplayLarge' }}
            fontWeight="700"
            isTruncated
            flex={1}
          >
            {asset.name && asset.name.length > 0
              ? asset.name
              : `#${asset.tokenId as string}`}
          </Text>
          {showMenu && (
            <NFTDetailMenu onCollectToTouch={onCollectToTouch}>
              <IconButton
                name="EllipsisVerticalOutline"
                size={isVertical ? 'sm' : 'xs'}
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
      </Box>

      {/* Collection */}
      {isEVM && !!network && (
        <HStack
          px="16px"
          py="12px"
          rounded="12px"
          space="12px"
          borderWidth={StyleSheet.hairlineWidth}
          alignItems="center"
          borderColor="border-default"
          bgColor="action-secondary-default"
        >
          {collection ? (
            <CollectionLogo
              src={collection.logoUrl}
              width="40px"
              height="40px"
            />
          ) : (
            <CustomSkeleton width="40px" height="40px" borderRadius="12px" />
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
        </HStack>
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
            <DetailItem
              title={intl.formatMessage({
                id: 'transaction__contract_address',
              })}
              value={asset.contractAddress}
              icon="Square2StackMini"
              onPress={() => {
                copyToClipboard(asset.contractAddress ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
            />
          )}
          {!!asset.tokenId && (
            <DetailItem
              title="NFT ID"
              value={asset.tokenId}
              icon="Square2StackMini"
              onPress={() => {
                copyToClipboard(asset.tokenId ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
            />
          )}
          {!!asset.ercType && (
            <DetailItem
              title={intl.formatMessage({ id: 'content__nft_standard' })}
              value={asset.ercType}
            />
          )}
          {!!network && (
            <DetailItem
              title={intl.formatMessage({ id: 'content__blockchain' })}
              value={network.name}
            />
          )}
        </VStack>
      </Box>
    </VStack>
  );
}

export { EVMAssetDetailContent };
