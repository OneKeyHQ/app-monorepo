import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList, Button, Page, Spinner, Stack } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { getNFTDetailsComponents } from '../../../utils/getNFTDetailsComponents';

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

  const { ImageContent, DetailContent } = getNFTDetailsComponents();

  const { result, isLoading } = usePromiseResult(
    async () => {
      const isHardware = accountUtils.isHwWallet({ walletId });

      const requests: [Promise<IAccountNFT[]>, Promise<IDBDevice | undefined>] =
        [
          backgroundApiProxy.serviceNFT.fetchNFTDetails({
            networkId,
            accountAddress,
            nfts: [{ collectionAddress, itemId }],
          }),
          isHardware
            ? backgroundApiProxy.serviceAccount.getWalletDevice({ walletId })
            : Promise.resolve(undefined),
        ];

      const [details, device] = await Promise.all(requests);

      return {
        nft: details[0],
        device,
      };
    },
    [accountAddress, collectionAddress, itemId, networkId, walletId],
    {
      watchLoading: true,
    },
  );

  const { nft, device } = result ?? {};

  const headerRight = useCallback(() => {
    const actions: IActionListItemProps[] = [];

    if (
      device &&
      (device.deviceType === 'touch' || device.deviceType === 'pro')
    ) {
      // TODO collect to device
      actions.push({
        label: `Collect to ${device.deviceType}`,
        icon: 'InboxOutline',
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
  }, [device]);

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
      <Page.Header title={nft.metadata?.name} headerRight={headerRight} />
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
