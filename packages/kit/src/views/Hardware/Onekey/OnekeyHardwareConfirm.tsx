import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';

import { Box, LottieView, Modal, Typography } from '@onekeyhq/components';
// import OnekeyClassicConfirm from '@onekeyhq/kit/assets/hardware/lottie_hardware_onekey_classic_confirm.json';
import OnekeyMiniConfirm from '@onekeyhq/kit/assets/hardware/lottie_hardware_onekey_mini_confirm.json';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import {
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<RootRoutesParams>;
type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareConfirmModal
>;

const OnekeyHardwareConfirm: FC = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();

  const { type } = route.params;

  const content = (
    <>
      {!type && (
        <Box flexDirection="column" alignItems="center" w="100%">
          <Box w="100%" h="220px">
            <LottieView source={OnekeyMiniConfirm} autoPlay loop />
          </Box>

          <Typography.DisplayMedium textAlign="center">
            Follow the instructions on your device screen
          </Typography.DisplayMedium>
        </Box>
      )}
    </>
  );

  const handleCloseSetup = () => {
    // Create wallet and account from device
    navigation.navigate(RootRoutes.Root);
  };

  return (
    <Modal
      footer={null}
      modalHeight="426px"
      onSecondaryActionPress={handleCloseSetup}
      staticChildrenProps={{
        flex: '1',
        p: 6,
        px: { base: 4, md: 6 },
      }}
    >
      {content}
    </Modal>
  );
};

export default OnekeyHardwareConfirm;
