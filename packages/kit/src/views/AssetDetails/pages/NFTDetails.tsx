import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
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
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { generateUploadNFTParams } from '@onekeyhq/shared/src/utils/nftUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { getNFTDetailsComponents } from '../../../utils/getNFTDetailsComponents';

import type { DeviceUploadResourceParams } from '@onekeyfe/hd-core';
import type { RouteProp } from '@react-navigation/core';

export function NFTDetails() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const route =
    useRoute<
      RouteProp<IModalAssetDetailsParamList, EModalAssetDetailRoutes.NFTDetails>
    >();
  const {
    networkId,
    accountId,
    walletId,
    accountAddress,
    collectionAddress,
    itemId,
  } = route.params;

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
          networkId,
          accountAddress,
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
    [accountAddress, collectionAddress, itemId, networkId, walletId],
    {
      watchLoading: true,
    },
  );

  const { network, nft, device } = result ?? {};

  const handleCollectNFTToDevice = useCallback(async () => {
    if (!nft || !nft.metadata || !nft.metadata.image || !device) return;

    setIsCollecting(true);
    let uploadResParams: DeviceUploadResourceParams | undefined;
    try {
      const name = nft.metadata?.name;
      uploadResParams = await generateUploadNFTParams({
        imageUri: nft.metadata?.image ?? '',
        metadata: {
          header: name && name?.length > 0 ? name : `#${nft.collectionAddress}`,
          subheader: nft.metadata?.description ?? '',
          network: network?.name ?? '',
          owner: accountAddress,
        },
        deviceType: device.deviceType,
      });
    } catch (e) {
      Toast.error({
        title: intl.formatMessage({ id: 'msg__image_download_failed' }),
      });
      setIsCollecting(false);
      return;
    }
    if (uploadResParams && !modalClosed.current) {
      try {
        await backgroundApiProxy.serviceHardware.uploadResource(
          device?.connectId ?? '',
          uploadResParams,
        );
        Toast.success({
          title: intl.formatMessage({ id: 'msg__change_saved' }),
        });
      } catch (e) {
        Toast.error({ title: (e as Error).message });
      } finally {
        setIsCollecting(false);
      }
    }
  }, [accountAddress, device, intl, network?.name, nft]);

  const headerRight = useCallback(() => {
    const actions: IActionListItemProps[] = [];

    if (
      nft &&
      nft.metadata &&
      nft.metadata.image &&
      device &&
      (device.deviceType === 'touch' || device.deviceType === 'pro')
    ) {
      // TODO collect to device
      actions.push({
        label: `Collect to ${String(device.deviceType).toUpperCase()}`,
        icon: 'InboxOutline',
        onPress: handleCollectNFTToDevice,
        disabled: isCollecting,
      });
    }

    if (actions.length === 0) {
      return null;
    }

    return (
      <ActionList
        title="Actions"
        renderTrigger={
          <HeaderIconButton title="Actions" icon="DotHorOutline" />
        }
        items={actions}
      />
    );
  }, [device, handleCollectNFTToDevice, isCollecting, nft]);

  const handleSendPress = useCallback(() => {
    if (!nft) return;
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendDataInput,
      params: {
        networkId,
        accountId,
        isNFT: true,
        nfts: [nft],
      },
    });
  }, [accountId, navigation, networkId, nft]);

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
      <Page.Header title={nft.metadata?.name} />
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
            <Button icon="ArrowTopOutline" mt="$5" onPress={handleSendPress}>
              {intl.formatMessage({ id: 'action__send' })}
            </Button>
          </Stack>
          <DetailContent networkId={networkId} nft={nft} />
        </Stack>
      </Page.Body>
    </Page>
  );
}
