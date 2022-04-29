import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  LottieView,
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
import isOnekeyDevice, {
  getDeviceType,
} from '@onekeyhq/kit/src/utils/ble/OnekeyHardware';
// import bleUtils, { BleDevice } from '@onekeyhq/kit/src/utils/ble/utils';
import deviceUtils, {
  ScannedDevice,
} from '@onekeyhq/kit/src/utils/device/deviceUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  IOneKeyDeviceFeatures,
  IOneKeyDeviceType,
} from '@onekeyhq/shared/types';

type NavigationProps = ModalScreenProps<RootRoutesParams> &
  ModalScreenProps<CreateWalletRoutesParams>;

export type Device = {
  type: IOneKeyDeviceType;
  name: string;
  device: ScannedDevice;
};

const getDeviceIcon = (
  type: IOneKeyDeviceType,
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

const ConnectHardwareModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const [isSearching, setIsSearching] = useState(false);
  const [isConnectingDeviceId, setIsConnectingDeviceId] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);

  const isConnectedDeviceActivated = false;
  // Do connect device on desktop
  const isDevicePlugIn = true;
  const navigateNext = useCallback(() => {
    // Lookup for device USB connection
    // If connected, check if is activated
    if (isConnectedDeviceActivated) {
      // navigate to setup complete
      // navigation.navigate(RootRoutes.Modal, {
      //   screen: ModalRoutes.CreateWallet,
      //   params: {
      //     screen: CreateWalletModalRoutes.SetupSuccessModal,
      //   },
      // });
    }
    // Navigate to setup device
    // navigation.navigate(RootRoutes.Modal, {
    //   screen: ModalRoutes.CreateWallet,
    //   params: {
    //     screen: CreateWalletModalRoutes.SetupHardwareModal,
    //   },
    // });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnectedDeviceActivated, navigation]);
  useEffect(() => {
    if (isDevicePlugIn) {
      setTimeout(() => {
        if (!platformEnv.isNative) {
          navigateNext();
        }
      }, 3 * 1000);
    }
  }, [isDevicePlugIn, navigateNext]);

  const handleStopDevice = useCallback(() => {
    if (!deviceUtils) return;

    deviceUtils.stopScan();
  }, []);

  const handleScanDevice = useCallback(() => {
    // TODO: await to ask bluetooth permission
    if (!deviceUtils) return;
    setIsSearching(true);

    const scanDevice: Device[] = [];

    deviceUtils.startDeviceScan((_device) => {
      if (_device && isOnekeyDevice(_device.name, _device.id)) {
        if (!scanDevice.find((device) => device.device.id === _device.id)) {
          scanDevice.push({
            type: getDeviceType(_device as IOneKeyDeviceFeatures),
            name: _device.name ?? '',
            device: _device,
          });

          setDevices([...scanDevice]);
        }
      }
    });

    // Then start searching devices
    // Show device options when available
  }, []);

  useEffect(() => {
    console.log('Start scanning');
    if (platformEnv.isBrowser) handleScanDevice();
    return () => {
      handleStopDevice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectDeviceWithDevice = useCallback(
    (device: Device) => {
      console.log('Connecting to device', device);

      if (!deviceUtils || !device) return;

      // bleUtils.stopScan();
      // setIsSearching(false);

      setIsConnectingDeviceId(device.device.id);
      deviceUtils.connect(device.device.id).then(() => {
        setIsConnectingDeviceId('');
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.DeviceStatusCheckModal,
            params: {
              device,
            },
          },
        });
      });
    },
    [navigation],
  );

  const renderDevices = useCallback(() => {
    if (!devices?.length) return null;
    return (
      <VStack space={4} w="full">
        <Typography.Body2 color="text-subdued" textAlign="center">
          {intl.formatMessage({ id: 'modal__looking_for_devices_result' })}
        </Typography.Body2>
        {devices.map((device) => (
          <PressableItem
            p="4"
            key={device?.device.id}
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            onPress={() => {
              handleConnectDeviceWithDevice(device);
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
              {isConnectingDeviceId === device.device.id && (
                <Spinner size="sm" />
              )}
              <Icon name="ChevronRightOutline" />
            </HStack>
          </PressableItem>
        ))}
      </VStack>
    );
  }, [devices, handleConnectDeviceWithDevice, isConnectingDeviceId, intl]);

  // Mobile Connect Screen
  const renderConnectScreen = () => {
    if (!isSearching) {
      return (
        <VStack space={8} w="full" alignItems="center">
          <Box size="358px">
            <Image size="358px" source={KeepDeviceAroundSource} />
          </Box>

          <VStack space={2} alignItems="center">
            <Typography.DisplayLarge>
              {intl.formatMessage({ id: 'modal__keep_device_close' })}
            </Typography.DisplayLarge>
            <Typography.Body1 color="text-subdued" textAlign="center">
              {intl.formatMessage({ id: 'model__keep_device_close_desc' })}
            </Typography.Body1>
          </VStack>
        </VStack>
      );
    }
    return (
      <VStack space={12} w="full" alignItems="center">
        <Box w="358px" h="220px" mb={-4}>
          <LottieView
            // eslint-disable-next-line global-require
            source={require('@onekeyhq/kit/assets/wallet/lottie_connect_onekey_by_bluetooth.json')}
            autoPlay
            loop
          />
        </Box>

        <VStack space={2} alignItems="center">
          <Typography.DisplayLarge>
            {intl.formatMessage({ id: 'modal__looking_for_devices' })}
          </Typography.DisplayLarge>
          <Typography.Body1 color="text-subdued" textAlign="center">
            {intl.formatMessage({ id: 'modal__looking_for_devices_desc' })}
          </Typography.Body1>
        </VStack>

        {renderDevices()}
      </VStack>
    );
  };

  const content = platformEnv.isNative ? (
    <Center>{renderConnectScreen()}</Center>
  ) : (
    <VStack space={8} alignItems="center">
      <Box>
        <LottieView
          // eslint-disable-next-line global-require
          source={require('@onekeyhq/kit/assets/wallet/lottie_connect_onekey_by_usb.json')}
          autoPlay
          loop
        />
      </Box>

      <Typography.DisplayMedium>
        {intl.formatMessage({ id: 'modal__connect_your_device' })}
      </Typography.DisplayMedium>
      {renderDevices()}
    </VStack>
  );

  return (
    <Modal
      scrollViewProps={{
        children: content,
        contentContainerStyle: {
          height: '100%',
          justifyContent: 'center',
          paddingBottom: 24,
        },
      }}
      hidePrimaryAction={!platformEnv.isNative}
      footer={!platformEnv.isNative || isSearching ? null : undefined}
      primaryActionTranslationId="action__connect_device"
      onPrimaryActionPress={handleScanDevice}
      hideSecondaryAction
    />
  );
};

export default ConnectHardwareModal;
