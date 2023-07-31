import type { FC } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';

import {
  Box,
  Modal,
  ScrollView,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import NavigationButton from '@onekeyhq/components/src/Modal/Container/Header/NavigationButton';
import type { INFTAsset } from '@onekeyhq/engine/src/types/nft';
import type { CollectiblesRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Collectibles';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getNFTDetailComponents } from './getNFTDetailComponents';

import type { CollectiblesModalRoutes } from '../../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

function ModalContent({
  isOwner,
  asset,
  accountId,
  networkId,
}: {
  asset: INFTAsset;
  networkId: string;
  accountId?: string;
  isOwner: boolean;
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
        />
      </ScrollView>
    </Box>
  );
}

const NFTDetailModal: FC = () => {
  const navigation = useNavigation();

  const route =
    useRoute<
      RouteProp<
        CollectiblesRoutesParams,
        CollectiblesModalRoutes.NFTDetailModal
      >
    >();

  const { networkId, accountId, asset, isOwner } = route.params;

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
          navigation.goBack?.();
        }}
      />
      <ModalContent
        asset={asset}
        isOwner={isOwner}
        networkId={networkId}
        accountId={accountId}
      />
    </Modal>
  );
};

export default NFTDetailModal;
