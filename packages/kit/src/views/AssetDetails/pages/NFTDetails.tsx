import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IActionListItemProps, IButtonProps } from '@onekeyhq/components';
import {
  ActionList,
  Button,
  Page,
  Spinner,
  Stack,
  Toast,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { generateUploadNFTParams } from '@onekeyhq/shared/src/utils/nftUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { getNFTDetailsComponents } from '../../../utils/getNFTDetailsComponents';

import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';
import type { RouteProp } from '@react-navigation/core';

const isCollectNFTDeviceCompatible = (device?: IDBDevice) =>
  device && (device.deviceType === 'touch' || device.deviceType === 'pro');

// Disable NFT image collection on web due to CORS errors when fetching NFT image data
const canCollectNFT = (nft?: IAccountNFT, device?: IDBDevice) =>
  !platformEnv.isWeb &&
  nft?.metadata?.image &&
  isCollectNFTDeviceCompatible(device);

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

  const handleCollectNFTToDevice = useCallback(
    async (close: () => void) => {
      close();
      if (!nft || !nft.metadata || !nft.metadata.image || !device) return;

      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });

      setIsCollecting(true);
      let uploadResParams: DeviceUploadResourceParams | undefined;
      try {
        const name = nft.metadata?.name;
        uploadResParams = await generateUploadNFTParams({
          imageUri: nft.metadata?.image ?? '',
          metadata: {
            header:
              name && name?.length > 0 ? name : `#${nft.collectionAddress}`,
            subheader: nft.metadata?.description ?? '',
            network: network?.name ?? '',
            owner: accountAddress,
          },
          deviceType: device.deviceType,
        });
      } catch (e) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.update_download_failed,
          }),
        });
        setIsCollecting(false);
        return;
      }
      if (uploadResParams && !modalClosed.current) {
        try {
          await backgroundApiProxy.serviceNFT.uploadNFTImageToDevice({
            accountId,
            uploadResParams,
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
      }
    },
    [accountId, device, intl, network?.name, networkId, nft],
  );

  const headerRight = useCallback(() => {
    const actions: IActionListItemProps[] = [];
    if (device && canCollectNFT(nft, device)) {
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
  }, [device, handleCollectNFTToDevice, intl, isCollecting, nft]);

  const handleSendPress = useCallback(() => {
    if (!nft) return;
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendDataInput,
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
