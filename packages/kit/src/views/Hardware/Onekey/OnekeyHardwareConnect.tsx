import React, { FC, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';

import { Box, LottieView, Modal, Typography } from '@onekeyhq/components';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import OnekeyBluetoothConnect from '@onekeyhq/kit/assets/animations/lottie_connect_onekey_by_bluetooth.json';
import OnekeyUsbConnect from '@onekeyhq/kit/assets/animations/lottie_connect_onekey_by_usb.json';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '../../../routes/Modal/HardwareOnekey';

// type NavigationProps = ModalScreenProps<RootRoutesParams>;
type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareConnectModal
>;

/**
 * 硬件详情
 */
const OnekeyHardwareConnect: FC = () => {
  const route = useRoute<RouteProps>();

  const { walletId } = route?.params;
  const [wallet, setWallet] = useState<Wallet>();
  const { engine } = backgroundApiProxy;
  const [connectType, setConnectType] = useState('ble');

  useEffect(() => {
    engine
      .getWallet(walletId)
      .then((_wallet) => {
        setWallet(_wallet);
        console.log(wallet);
      })
      .catch(() => {
        setConnectType('usb');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      footer={null}
      modalHeight="426px"
      scrollViewProps={{
        pt: 4,
        children: (
          <Box
            flexDirection="column"
            p={0.5}
            alignItems="center"
            mb={{ base: 4, md: 0 }}
          >
            {connectType === 'ble' && (
              <>
                <Box w="358px" h="220px" mb={-4}>
                  <LottieView source={OnekeyBluetoothConnect} autoPlay loop />
                </Box>

                <Typography.DisplayLarge mt={8}>
                  Looking for Devices
                </Typography.DisplayLarge>
                <Typography.Body1 color="text-subdued">
                  Please make sure your Bluetooth is enabled.
                </Typography.Body1>
              </>
            )}

            {connectType === 'usb' && (
              <>
                <Box w="358px" h="220px" mb={-4}>
                  <LottieView source={OnekeyUsbConnect} autoPlay loop />
                </Box>

                <Typography.DisplayMedium>
                  Connect and unlock your device
                </Typography.DisplayMedium>
              </>
            )}
          </Box>
        ),
      }}
    />
  );
};

export default OnekeyHardwareConnect;
