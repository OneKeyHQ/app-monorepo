import { useCallback, useState } from 'react';

import { Linking, StyleSheet } from 'react-native';

import {
  Anchor,
  Dialog,
  HeightTransition,
  ListItem,
  LottieView,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ConnectByBluetoothAnim from '../../../../../assets/animations/connect_by_bluetooth.json';
import ConnectByUSBAnim from '../../../../../assets/animations/connect_by_usb.json';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../../router/type';

const headerRight = (onPress: () => void) => (
  <HeaderIconButton icon="QuestionmarkOutline" onPress={onPress} />
);

const FirmwareAuthenticationDialogContent = ({
  firmwareState,
}: {
  firmwareState: 'unknown' | 'official' | 'unofficial' | 'failed';
}) => (
  <Stack
    borderRadius="$3"
    p="$5"
    bg="$bgSubdued"
    style={{ borderCurve: 'continuous' }}
  >
    {firmwareState === 'unknown' && <Spinner size="large" />}
    <SizableText textAlign="center" mt="$5">
      {firmwareState === 'unknown' && 'Verifying official firmware'}
    </SizableText>
  </Stack>
);

export function ConnectYourDevice() {
  const [firmwareState, setFirmwareState] = useState('unknown'); // unknown, verified, unverified, failed

  const navigation = useAppNavigation();

  const handleHeaderRightPress = () => {
    navigation.push(EOnboardingPages.OneKeyHardwareWallet);
  };

  const handleWalletItemPress = () => {
    navigation.push(EOnboardingPages.FinalizeWalletSetup);
  };

  const handleSetupNewWalletPress = useCallback(() => {
    navigation.push(EOnboardingPages.ActivateDevice);
  }, [navigation]);

  const handleNotActivatedDevicePress = useCallback(() => {
    const dialog = Dialog.show({
      icon: 'WalletCryptoOutline',
      title: 'Activate Your Device',
      description: 'Set up your hardware wallet to get started.',
      renderContent: (
        <Stack>
          <ListItem
            alignItems="flex-start"
            icon="PlusCircleOutline"
            title="Set Up New Wallet"
            subtitle="Configure your device to create a new wallet."
            drillIn
            onPress={async () => {
              await dialog.close();
              handleSetupNewWalletPress();
            }}
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            m="$0"
            py="$2.5"
            bg="$bgSubdued"
          />
          <ListItem
            alignItems="flex-start"
            icon="ArrowBottomCircleOutline"
            title="Restore Wallet"
            subtitle="Restore your wallet using an existing recovery phrase."
            drillIn
            onPress={async () => {
              await dialog.close();
              const packageAlertDialog = Dialog.show({
                icon: 'PackageDeliveryOutline',
                title: 'Package Security Check',
                description:
                  'Your package should not contain any pre-set PINs or Recovery Phrases. If such items are found, stop using the device and immediately reach out to OneKey Support for assistance.',
                onCancel: () =>
                  Linking.openURL('https://help.onekey.so/hc/requests/new'),
                onCancelText: 'Get Help',
                onConfirm: async () => {
                  await packageAlertDialog.close();
                  handleSetupNewWalletPress();
                  return true;
                },
                onConfirmText: 'Understood',
              });
            }}
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            m="$0"
            mt="$2.5"
            py="$2.5"
            bg="$bgSubdued"
          />
        </Stack>
      ),
      showFooter: false,
    });
  }, [handleSetupNewWalletPress]);

  const handleFirmwareAuthentication = () => {
    const firmwareAuthenticationDialog = Dialog.confirm({
      title: 'Firmware Authentication',
      renderContent: (
        <FirmwareAuthenticationDialogContent firmwareState={firmwareState} />
      ),
      onConfirm: () => console.log('confirm'),
      onConfirmText: 'Continue',
      confirmButtonProps: {
        disabled: true,
      },
    });

    setTimeout(() => {
      setFirmwareState('verified');
    }, 2000);
  };

  const handleCheckingDevice = () => {
    const checkingDeviceDialog = Dialog.show({
      title: 'Checking Device',
      renderContent: (
        <Stack
          borderRadius="$3"
          p="$5"
          bg="$bgSubdued"
          style={{ borderCurve: 'continuous' }}
        >
          <Spinner size="large" />
        </Stack>
      ),
      showFooter: false,
    });

    setTimeout(async () => {
      await checkingDeviceDialog.close();
      handleFirmwareAuthentication();
    }, 1000);
  };

  const DevicesData = [
    {
      title: 'OneKey Classic',
      src: require('../../../../../assets/wallet/avatar/Classic.png'),
      onPress: handleCheckingDevice,
    },
    {
      title: 'OneKey Mini',
      src: require('../../../../../assets/wallet/avatar/Mini.png'),
      onPress: handleNotActivatedDevicePress,
    },
    {
      title: 'OneKey Touch',
      src: require('../../../../../assets/wallet/avatar/Touch.png'),
    },
  ];

  return (
    <Page>
      <Page.Header
        title={
          platformEnv.isNative ? 'Looking for Devices' : 'Connect Your Device'
        }
        headerRight={() => headerRight(handleHeaderRightPress)}
      />
      <Page.Body>
        {/* animation */}
        <Stack p="$5" pt="$0" mb="$4" alignItems="center" bg="$bgSubdued">
          <LottieView
            source={
              platformEnv.isNative ? ConnectByBluetoothAnim : ConnectByUSBAnim
            }
          />
          <SizableText textAlign="center" color="$textSubdued" mt="$1.5">
            {platformEnv.isNative
              ? 'Please make sure your Bluetooth is enabled'
              : 'Connect your device via USB'}
          </SizableText>
        </Stack>

        {/* devices */}
        <HeightTransition>
          <Stack>
            {DevicesData.map((item, index) => (
              <ListItem
                avatarProps={{
                  src: item.src,
                }}
                key={index}
                title={item.title}
                drillIn
                onPress={item.onPress}
                focusable={false}
              />
            ))}
          </Stack>
        </HeightTransition>

        {/* buy link */}
        <XStack
          px="$5"
          py="$0.5"
          mt="auto"
          justifyContent="center"
          alignItems="center"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            Don't have OneKey yet?
          </SizableText>
          <Anchor
            display="flex"
            href="https://shop.onekey.so/"
            target="_blank"
            size="$bodyMdMedium"
            p="$2"
          >
            Buy One
          </Anchor>
        </XStack>
      </Page.Body>
    </Page>
  );
}
