import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import {
  ActionList,
  Button,
  ImageCrop,
  Page,
  Spinner,
  Stack,
  Toast,
} from '@onekeyhq/components';
import type { IPickerImage } from '@onekeyhq/components/src/composite/ImageCrop/type';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IPro2NftUploadParams } from '@onekeyhq/kit-bg/src/services/ServiceNFT';
import { OneKeyAppError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import imageUtils from '@onekeyhq/shared/src/utils/imageUtils';
import {
  generatePro2NftMetadata,
  generateUploadNFTParams,
  isCollectNFTDeviceCompatible,
  isCollectibleNftMediaSupportedOnDevice,
} from '@onekeyhq/shared/src/utils/nftUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { getNFTDetailsComponents } from '../../../utils/getNFTDetailsComponents';

import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';
import type { RouteProp } from '@react-navigation/core';

// Disable NFT image collection on web due to CORS errors when fetching NFT image data
const canCollectNFT = (nft?: IAccountNFT, device?: IDBDevice) =>
  !platformEnv.isWeb &&
  nft?.metadata?.image &&
  isCollectNFTDeviceCompatible(device?.deviceType);

export default function NFTDetails() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const route =
    useRoute<
      RouteProp<IModalAssetDetailsParamList, EModalAssetDetailRoutes.NFTDetails>
    >();
  const { networkId, accountId, walletId, collectionAddress, itemId } =
    route.params;

  const [isCollecting, setIsCollecting] = useState(false);
  const [supportedCollectibleImageSource, setSupportedCollectibleImageSource] =
    useState<string>();
  const modalClosed = useRef(false);

  const { ImageContent, DetailContent } = getNFTDetailsComponents();

  const { result, isLoading } = usePromiseResult(
    async () => {
      const isHardware = accountUtils.isHwWallet({ walletId });

      const requests: [
        Promise<IServerNetwork>,
        Promise<IAccountNFT[]>,
        Promise<IDBDevice | undefined>,
      ] = [
        backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
        backgroundApiProxy.serviceNFT.fetchNFTDetails({
          accountId,
          networkId,
          nfts: [{ collectionAddress, itemId }],
        }),
        isHardware
          ? backgroundApiProxy.serviceAccount.getWalletDevice({ walletId })
          : Promise.resolve(undefined),
      ];

      const [n, details, device] = await Promise.all(requests);

      return {
        network: n,
        nft: details[0],
        device,
      };
    },
    [collectionAddress, itemId, networkId, walletId, accountId],
    {
      watchLoading: true,
    },
  );

  const { network, nft, device } = result ?? {};
  const collectibleImageSource = nft?.metadata?.image;
  const canCollectCurrentNFT = Boolean(canCollectNFT(nft, device));
  const isProtocolV2Product = isProtocolV2ProductType(device?.deviceType);
  const canShowCollectNFTAction =
    canCollectCurrentNFT &&
    (!isProtocolV2Product ||
      supportedCollectibleImageSource === collectibleImageSource);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();
    setSupportedCollectibleImageSource(undefined);

    if (
      !canCollectCurrentNFT ||
      !isProtocolV2Product ||
      !collectibleImageSource
    ) {
      return () => {
        isCurrent = false;
        controller.abort();
      };
    }

    void imageUtils
      .probeImageMimeType(collectibleImageSource, controller.signal)
      .then((mimeType) => {
        if (
          isCurrent &&
          isCollectibleNftMediaSupportedOnDevice(device?.deviceType, mimeType)
        ) {
          setSupportedCollectibleImageSource(collectibleImageSource);
        }
      })
      .catch(() => {
        // Unsupported or unavailable media must not expose the collect action.
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [
    canCollectCurrentNFT,
    collectibleImageSource,
    device?.deviceType,
    isProtocolV2Product,
  ]);

  const handleCollectNFTToDevice = useCallback(
    async (close: () => void) => {
      close();
      if (!nft || !collectibleImageSource || !device) return;

      setIsCollecting(true);
      let uploadResParams: DeviceUploadResourceParams | undefined;
      let pro2UploadParams: IPro2NftUploadParams | undefined;

      let config: Awaited<
        ReturnType<typeof backgroundApiProxy.serviceHardware.getDeviceNftConfig>
      >;
      try {
        config = await backgroundApiProxy.serviceHardware.getDeviceNftConfig({
          dbDeviceId: device?.id,
        });
      } catch (_error) {
        setIsCollecting(false);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_unknown_error,
          }),
        });
        return;
      }

      if (!config || !config.size) {
        setIsCollecting(false);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_unknown_error,
          }),
        });
        return;
      }

      let croppedImage: IPickerImage | undefined;
      let actionPreparedImageCleanup: (() => Promise<void>) | undefined;
      try {
        const preparedImage = await imageUtils.prepareImageForCropWithInfo(
          collectibleImageSource,
        );
        actionPreparedImageCleanup = preparedImage.cleanup;
        if (
          isProtocolV2Product &&
          !isCollectibleNftMediaSupportedOnDevice(
            device.deviceType,
            preparedImage.mimeType,
          )
        ) {
          throw new OneKeyAppError({
            message: intl.formatMessage({
              id: ETranslations.global_unknown_error,
            }),
          });
        }
        croppedImage = await ImageCrop.openCropImage(
          preparedImage.uri,
          config.size?.width,
          config.size?.height,
        );
      } catch (error: any) {
        if (error instanceof OneKeyAppError) {
          Toast.error({
            title: error.message,
          });
          setIsCollecting(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const message = error?.message;
        const cancelError =
          typeof message === 'string' && message.includes('User cancelled');
        if (cancelError) {
          setIsCollecting(false);
          return;
        }
        // ignore error
      } finally {
        await actionPreparedImageCleanup?.();
      }

      if (!croppedImage || !croppedImage?.data) {
        setIsCollecting(false);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_unknown_error,
          }),
        });
        return;
      }

      try {
        const name = nft.metadata?.name;

        const imgBase64: string = croppedImage?.data ?? '';
        const originW = croppedImage?.width ?? 0;
        const originH = croppedImage?.height ?? 0;

        const img = await imageUtils.resizeImage({
          uri: imgBase64,

          width: config.size?.width,
          height: config.size?.height,

          originW,
          originH,
          includeHex: false,
        });

        if (isProtocolV2Product) {
          if (!config.thumbnailSize) {
            throw new OneKeyAppError({
              message: 'Pro2 NFT thumbnail config is missing',
            });
          }
          const thumbnail = await imageUtils.resizeImage({
            uri: img.uri,
            width: config.thumbnailSize.width,
            height: config.thumbnailSize.height,
            originW: config.size.width,
            originH: config.size.height,
            includeHex: false,
          });
          if (!img.base64 || !thumbnail.base64) {
            throw new OneKeyAppError({
              message: 'Pro2 NFT JPEG data is missing',
            });
          }
          pro2UploadParams = {
            imageJpegBase64: img.base64,
            thumbnailJpegBase64: thumbnail.base64,
            ...generatePro2NftMetadata({
              title:
                name && name.length > 0 ? name : `#${nft.collectionAddress}`,
              subtitle: nft.collectionName ?? network?.name ?? '',
            }),
          };
        } else {
          const accountAddress =
            await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
              accountId,
              networkId,
            });
          const {
            screenHex: customScreenHex,
            thumbnailHex: customThumbnailHex,
            blurScreenHex: customBlurScreenHex,
          } = await deviceHomeScreenUtils.buildCustomScreenHex({
            dbDeviceId: device.id,
            url: img.uri,
            deviceType: device.deviceType,
            isUserUpload: true,
            config,
          });

          uploadResParams = await generateUploadNFTParams({
            screenHex: customScreenHex,
            thumbnailHex: customThumbnailHex ?? '',
            blurScreenHex: customBlurScreenHex ?? '',
            metadata: {
              header:
                name && name?.length > 0 ? name : `#${nft.collectionAddress}`,
              subheader: nft.metadata?.description ?? '',
              network: network?.name ?? '',
              owner: accountAddress,
            },
          });
        }
      } catch (_e) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.update_download_failed,
          }),
        });
        setIsCollecting(false);
        return;
      }
      if ((!uploadResParams && !pro2UploadParams) || modalClosed.current) {
        setIsCollecting(false);
        return;
      }
      try {
        await backgroundApiProxy.serviceNFT.uploadNFTImageToDevice({
          accountId,
          uploadResParams,
          pro2UploadParams,
        });
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.nft_already_collected,
          }),
        });
      } catch (e) {
        Toast.error({ title: (e as Error).message });
      } finally {
        setIsCollecting(false);
      }
    },
    [
      accountId,
      collectibleImageSource,
      device,
      intl,
      isProtocolV2Product,
      network?.name,
      networkId,
      nft,
    ],
  );

  const headerRight = useCallback(() => {
    const actions: IActionListItemProps[] = [];
    if (device && canShowCollectNFTAction) {
      actions.push({
        label: intl.formatMessage(
          {
            id: ETranslations.nft_collect_to_touch,
          },
          {
            device: stringUtils.capitalizeWords(String(device.deviceType)),
          },
        ),
        icon: 'InboxOutline',
        onPress: handleCollectNFTToDevice,
      });
    }

    if (actions.length === 0) {
      return null;
    }

    if (isCollecting) {
      return <Spinner color="$iconSubdued" size="small" />;
    }

    return (
      <ActionList
        title="Actions"
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
        items={actions}
      />
    );
  }, [
    canShowCollectNFTAction,
    device,
    handleCollectNFTToDevice,
    intl,
    isCollecting,
  ]);

  const handleSendPress = useCallback(() => {
    if (!nft) return;
    navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
      screen: EModalSignatureConfirmRoutes.TxDataInput,
      params: {
        networkId,
        accountId,
        isNFT: true,
        nfts: [nft],
        onSuccess: () => navigation.popStack(),
      },
    });
  }, [accountId, navigation, networkId, nft]);

  const isOwnNFT = useMemo(
    () => new BigNumber(nft?.amount ?? 0).gt(0),
    [nft?.amount],
  );

  useEffect(
    () => () => {
      modalClosed.current = true;
    },
    [],
  );

  if (!nft)
    return (
      <Page>
        <Page.Body>
          {isLoading ? (
            <Stack pt={240} justifyContent="center" alignItems="center">
              <Spinner size="large" />
            </Stack>
          ) : null}
        </Page.Body>
      </Page>
    );

  return (
    <Page scrollEnabled>
      <Page.Header title={nft.metadata?.name || ''} headerRight={headerRight} />
      <Page.Body>
        <Stack
          $gtMd={{
            flexDirection: 'row',
          }}
          pb="$5"
        >
          <Stack
            px="$5"
            pb="$5"
            $gtMd={{
              flexBasis: '33.3333%',
            }}
          >
            <Stack pb="100%">
              <Stack position="absolute" left={0} top={0} bottom={0} right={0}>
                <ImageContent nft={nft} />
              </Stack>
            </Stack>
            <Button
              testID="asset-details-btn"
              icon="ArrowTopOutline"
              mt="$5"
              variant="primary"
              onPress={handleSendPress}
              disabled={!isOwnNFT}
              $md={
                {
                  size: 'large',
                } as any
              }
            >
              {intl.formatMessage({ id: ETranslations.global_send })}
            </Button>
          </Stack>
          <DetailContent networkId={networkId} nft={nft} />
        </Stack>
      </Page.Body>
    </Page>
  );
}
