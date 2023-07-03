import type { FC } from 'react';
import { useRef } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Box,
  Modal,
  ScrollView,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import NavigationButton from '@onekeyhq/components/src/Modal/Container/Header/NavigationButton';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { INFTAsset } from '@onekeyhq/engine/src/types/nft';
import type { CollectiblesRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Collectibles';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getNFTDetailComponents } from './getNFTDetailComponents';

import type { CollectiblesModalRoutes } from '../../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

function ModalContent({
  isOwner,
  asset,
  network,
}: {
  asset: INFTAsset;
  network: Network;
  isOwner: boolean;
}) {
  const isVertical = useIsVerticalLayout();
  const { ImageContent, DetailContent } = getNFTDetailComponents({ asset });
  const { bottom } = useSafeAreaInsets();
  if (isVertical || platformEnv.isNativeIOSPad) {
    return (
      <ScrollView p="16px">
        <ImageContent asset={asset} isOwner={isOwner} network={network} />
        <Box mt="24px" mb={bottom}>
          <DetailContent asset={asset} isOwner={isOwner} network={network} />
        </Box>
      </ScrollView>
    );
  }
  return (
    <Box flexDirection="row">
      <ImageContent asset={asset} isOwner={isOwner} network={network} />
      <ScrollView h="640px" p="24px">
        <DetailContent asset={asset} isOwner={isOwner} network={network} />
      </ScrollView>
    </Box>
  );
}

const NFTDetailModal: FC = () => {
  const modalClose = useModalClose();

  const hardwareCancelFlagRef = useRef<boolean>(false);

  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.NFTDetailModal
      >
    >();

  const { network, asset, isOwner } = route.params;
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
          modalClose();
        }}
      />
      <ModalContent
        // ref={hardwareCancelFlagRef}
        asset={asset}
        isOwner={isOwner}
        network={network}
      />
    </Modal>
  );
};

export default NFTDetailModal;
