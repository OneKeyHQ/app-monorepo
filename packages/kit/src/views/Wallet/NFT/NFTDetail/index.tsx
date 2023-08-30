import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';

import {
  Box,
  Modal,
  ScrollView,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import NavigationButton from '@onekeyhq/components/src/Modal/Container/Header/NavigationButton';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { INFTAsset } from '@onekeyhq/engine/src/types/nft';
import type { CollectiblesRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Collectibles';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

import { getNFTDetailComponents } from './getNFTDetailComponents';

import type { CollectiblesModalRoutes } from '../../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

function ModalContent({
  isOwner,
  asset,
  accountId,
  networkId,
  onRecycleUtxo,
}: {
  asset: INFTAsset;
  networkId: string;
  accountId?: string;
  isOwner: boolean;
  onRecycleUtxo?: () => void;
}) {
  const isVertical = useIsVerticalLayout();
  const { ImageContent, DetailContent } = getNFTDetailComponents({ asset });
  const { bottom } = useSafeAreaInsets();
  if (isVertical || platformEnv.isNativeIOSPad) {
    return (
      <ScrollView p="16px">
        <ImageContent asset={asset} isOwner={isOwner} networkId={networkId} />
        <Box mt="24px" mb={bottom}>
          <DetailContent
            asset={asset}
            isOwner={isOwner}
            networkId={networkId}
            accountId={accountId}
            onRecycleUtxo={onRecycleUtxo}
          />
        </Box>
      </ScrollView>
    );
  }
  return (
    <Box flexDirection="row">
      <ImageContent asset={asset} isOwner={isOwner} networkId={networkId} />
      <ScrollView h="640px" p="24px">
        <DetailContent
          asset={asset}
          isOwner={isOwner}
          networkId={networkId}
          accountId={accountId}
          onRecycleUtxo={onRecycleUtxo}
        />
      </ScrollView>
    </Box>
  );
}

const NFTDetailModal: FC = () => {
  const [accountId, setAccountId] = useState<string | undefined>();
  const hardwareCancelFlagRef = useRef<boolean>(false);
  const navigation = useNavigation();

  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.NFTDetailModal
      >
    >();

  const {
    asset,
    isOwner,
    accountId: originAccountId,
    networkId,
    onRecycleUtxo,
  } = route.params;

  useEffect(() => {
    if (!isAllNetworks(networkId)) {
      setAccountId(originAccountId);
      return;
    }
    backgroundApiProxy.serviceAccount
      .getAccountByAddress({
        address: asset.accountAddress ?? '',
        networkId: asset.networkId,
      })
      .then((account) => {
        if (account) {
          setAccountId(account?.id);
        }
      });
  }, [asset, originAccountId, networkId]);

  return (
    <Modal
      size="2xl"
      height="640px"
      maxHeight="640px"
      footer={null}
      headerShown={false}
      staticChildrenProps={{ flex: 1 }}
    >
      <NavigationButton
        position="absolute"
        top={platformEnv.isExtensionUiPopup ? '8px' : '24px'}
        right={platformEnv.isExtensionUiPopup ? '8px' : '24px'}
        zIndex={1}
        onPress={() => {
          hardwareCancelFlagRef.current = true;
          navigation.goBack?.();
        }}
      />
      <ModalContent
        // ref={hardwareCancelFlagRef}
        asset={asset}
        isOwner={isOwner}
        networkId={asset.networkId ?? networkId}
        accountId={accountId}
        onRecycleUtxo={onRecycleUtxo}
      />
    </Modal>
  );
};

export default NFTDetailModal;
