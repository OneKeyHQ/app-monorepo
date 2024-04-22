import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  HStack,
  IconButton,
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
import type { NFTAsset } from '@onekeyhq/engine/src/types/nft';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import { generateUploadNFTParams } from '@onekeyhq/kit/src/utils/hardware/nftUtils';
import NFTDetailMenu from '@onekeyhq/kit/src/views/Overlay/NFTDetailMenu';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import { useNetwork, useWallet } from '../../../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../../../routes/routesEnum';
import { deviceUtils } from '../../../../../../utils/hardware';
import { SendModalRoutes } from '../../../../../Send/enums';
import { DetailItem } from '../DetailItem';
import { useDeviceMenu } from '../hooks/useDeviceMenu';

import type { CollectiblesRoutesParams } from '../../../../../../routes/Root/Modal/Collectibles';
import type { ModalScreenProps } from '../../../../../../routes/types';
import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

function SOLAssetDetailContent({
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
  const isDisabled =
    wallet?.type === WALLET_TYPE_WATCHING ||
    asset.owner !== outerAsset.accountAddress ||
    !accountId;
  const { network } = useNetwork({
    networkId,
  });

  const [menuLoading, setMenuLoading] = useState(false);
  const { device, showMenu } = useDeviceMenu({ wallet, asset });

  const hardwareCancelFlagRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (network?.id) {
        if (network.id === OnekeyNetwork.sol) {
          const data = (await serviceNFT.fetchAsset({
            chain: network.id,
            tokenId: outerAsset.tokenAddress as string,
          })) as NFTAsset;
          if (data) {
            updateAsset(data);
          }
        }
      }
    })();
    return () => {
      hardwareCancelFlagRef.current = true;
    };
  }, [
    outerAsset.contractAddress,
    outerAsset.tokenAddress,
    outerAsset.tokenId,
    network?.id,
    serviceNFT,
  ]);

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
    (amount: string) => {
      if (!accountId || !networkId) {
        return;
      }
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
            token: asset.tokenAddress,
            nftTokenId: asset.tokenAddress,
            closeModal: modalClose,
          },
        },
      });
    },
    [accountId, asset.tokenAddress, modalClose, navigation, networkId],
  );

  return (
    <VStack space="24px" mb="50px">
      {/* Asset name and collection name */}
      <Box>
        <HStack alignItems="stretch" justifyContent="space-between">
          <Text
            typography={{ sm: 'DisplayLarge', md: 'DisplayLarge' }}
            fontWeight="700"
            isTruncated
            flex="1"
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

      {isOwner && (
        <HStack space="16px">
          <Button
            type="primary"
            isDisabled={isDisabled}
            width="full"
            size="lg"
            leftIconName="ArrowUpMini"
            onPress={() => {
              sendNFTWithAmount('1');
            }}
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

      {/* Details */}
      <Box>
        <Typography.Heading mb="16px">
          {intl.formatMessage({ id: 'content__details' })}
        </Typography.Heading>
        <VStack space="16px">
          {!!asset.tokenAddress && (
            <DetailItem
              title="NFT ID"
              value={asset.tokenAddress}
              icon="Square2StackMini"
              onPress={() => {
                copyToClipboard(asset.tokenAddress ?? '');
                ToastManager.show({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
              }}
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

export { SOLAssetDetailContent };
