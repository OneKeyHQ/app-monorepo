/* eslint-disable @typescript-eslint/no-unsafe-member-access, global-require, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-var-requires */
import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  Modal,
  Spinner,
  Typography,
  VStack,
} from '@onekeyhq/components';
import ClassicDeviceIcon from '@onekeyhq/components/img/deviceIcon_classic.png';
import MiniDeviceIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import KeepDeviceAroundSource from '@onekeyhq/kit/assets/wallet/keep_device_close.png';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import Platform from '@onekeyhq/shared/src/platformEnv';

// A hack for document unfound on native error
// import LottieView from 'lottie-react';
let LottieViewNative: typeof import('lottie-react-native').default;
let LottieViewWeb: typeof import('lottie-react').default;
try {
  LottieViewNative = require('lottie-react-native');
} catch (e) {
  // Ignore
  console.debug('Error on require `lottie-react-native` module', e);
}
try {
  LottieViewWeb = require('lottie-react').default;
} catch (e) {
  // Ignore
  console.debug('Error on require `lottie-react` module', e);
}

type NavigationProps = ModalScreenProps<RootRoutesParams> &
  ModalScreenProps<CreateWalletRoutesParams>;

type DeviceType = 'classic' | 'mini';
type Device = {
  type: DeviceType;
  name: string;
};

const getDeviceIcon = (
  type: DeviceType,
): import('react-native').ImageSourcePropType | undefined => {
  switch (type) {
    case 'classic':
      return ClassicDeviceIcon as number;
    case 'mini':
      return MiniDeviceIcon as number;
    default:
      return undefined;
  }
};

/* TODO: use i18n keys when available */
const ConnectHardwareModal: FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const [isSearching, setIsSearching] = useState(false);
  const [isConnectingDevice, setIsConnectingDevice] = useState(false);
  const [device, setDevice] = useState<Device>();

  const isConnectedDeviceActivated = false;
  // Do connect device on desktop
  const isDevicePlugIn = true;
  const navigateNext = useCallback(() => {
    // Lookup for device USB connection
    // If connected, check if is activated
    if (isConnectedDeviceActivated) {
      // navigate to setup complete
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.SetupSuccessModal,
        },
      });
      return;
    }
    // Navigate to setup device
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateWallet,
      params: {
        screen: CreateWalletModalRoutes.SetupHardwareModal,
      },
    });
  }, [isConnectedDeviceActivated, navigation]);
  useEffect(() => {
    if (isDevicePlugIn) {
      setTimeout(() => {
        if (!Platform.isNative) {
          navigateNext();
        }
      }, 3 * 1000);
    }
  }, [isDevicePlugIn, navigateNext]);

  const handleConnectDevice = useCallback(() => {
    // TODO: await to ask bluetooth permission
    setIsSearching(true);
    setTimeout(() => {
      setDevice({ name: 'K8101', type: 'classic' });
    }, 1000);
    // Then start searching devices
    // Show device options when available
  }, []);

  // TODO: Move mobile and desktop screens into separate files
  // Mobile Connect Screen
  const renderConnectScreen = () => {
    if (!isSearching) {
      return (
        <VStack space={8} w="full" alignItems="center">
          {/* FIXME: Web no `url-loader` error */}
          <Box size="358px">
            <Image size="358px" source={KeepDeviceAroundSource} />
          </Box>
          {/* <Box size="358px" /> */}

          <VStack space={2} alignItems="center">
            <Typography.DisplayLarge>Keep Device Close</Typography.DisplayLarge>
            <Typography.Body1 color="text-subdued" textAlign="center">
              Ensure device is powered on and in range, hold it still and click
              the button below to start the connection.
            </Typography.Body1>
          </VStack>
        </VStack>
      );
    }
    return (
      <VStack space={12} w="full" alignItems="center">
        <Box w="358px" h="220px">
          <LottieViewNative
            source={require('@onekeyhq/kit/assets/wallet/lottie_connect_onekey_by_bluetooth.json')}
            autoPlay
            loop
          />
        </Box>

        <VStack space={2} alignItems="center">
          <Typography.DisplayLarge>Looking for Devices</Typography.DisplayLarge>
          <Typography.Body1 color="text-subdued" textAlign="center">
            Please make sure your Bluetooth is enabled.
          </Typography.Body1>
        </VStack>

        {!!device && (
          <VStack space={4} w="full">
            <Typography.Body2 color="text-subdued" textAlign="center">
              We found these devices
            </Typography.Body2>

            {/* Fake devices */}
            <PressableItem
              p="4"
              bg="surface-default"
              borderRadius="12px"
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              onPress={() => {
                setIsConnectingDevice(true);
                // Use setTimeout to simulate connection
                setTimeout(() => {
                  // Navigate to device status page
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.CreateWallet,
                    params: {
                      screen: CreateWalletModalRoutes.DeviceStatusCheckModal,
                    },
                  });
                }, 3000);
              }}
            >
              <HStack space={3} alignItems="center">
                {/* TODO: Different type of icon */}
                <Image
                  source={getDeviceIcon(device.type)}
                  width={6}
                  height={36}
                />
                <Typography.Body1>{device.name}</Typography.Body1>
              </HStack>

              <HStack space={3} alignItems="center">
                {isConnectingDevice && <Spinner size="sm" />}
                <Icon name="ChevronRightOutline" />
              </HStack>
            </PressableItem>
          </VStack>
        )}
      </VStack>
    );
  };

  const content = Platform.isNative ? (
    <Center>{renderConnectScreen()}</Center>
  ) : (
    <VStack space={8} alignItems="center">
      <Box borderRadius="12px" bg="surface-neutral-subdued">
        {!!LottieViewWeb && (
          <LottieViewWeb
            // eslint-disable-next-line global-require
            animationData={require('@onekeyhq/kit/assets/wallet/lottie_connect_onekey_by_usb.json')}
            autoPlay
            loop
          />
        )}
      </Box>

      <Typography.DisplayMedium>
        Connect and unlock your device
      </Typography.DisplayMedium>
    </VStack>
  );

  // const footer = <Center pt={4} pb={8}></Center>;
  return (
    <Modal
      scrollViewProps={{
        pt: 4,
        children: content,
      }}
      hidePrimaryAction={!Platform.isNative}
      footer={!Platform.isNative || isSearching ? null : undefined}
      primaryActionTranslationId="Connect Device"
      onPrimaryActionPress={handleConnectDevice}
      hideSecondaryAction
    />
  );
};

export default ConnectHardwareModal;
