import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import {
  Anchor,
  Dialog,
  LottieView,
  Page,
  ScrollView,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import ConnectByBluetoothAnim from '@onekeyhq/kit/assets/animations/connect_by_bluetooth.json';
import ConnectByUSBAnim from '@onekeyhq/kit/assets/animations/connect_by_usb.json';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import uiDeviceUtils from '@onekeyhq/kit/src/utils/uiDeviceUtils';
import {
  BleLocationServiceError,
  InitIframeLoadFail,
  InitIframeTimeout,
  NeedBluetoothPermissions,
  NeedBluetoothTurnedOn,
} from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useFirmwareVerifyDialog } from './FirmwareVerifyDialog';

import type { KnownDevice, SearchDevice } from '@onekeyfe/hd-core';
import type { ImageSourcePropType } from 'react-native';

const headerRight = (onPress: () => void) => (
  <HeaderIconButton icon="QuestionmarkOutline" onPress={onPress} />
);

export function ConnectYourDevicePage() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSearching, setIsSearching] = useState(false);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);
  const searchStateRef = useRef<'start' | 'stop'>('stop');
  const actions = useAccountSelectorActions();

  // deviceScan
  useEffect(() => {
    uiDeviceUtils.startDeviceScan(
      (response) => {
        if (!response.success) {
          const error = convertDeviceError(response.payload);
          if (platformEnv.isNative) {
            if (
              !(error instanceof NeedBluetoothTurnedOn) &&
              !(error instanceof NeedBluetoothPermissions) &&
              !(error instanceof BleLocationServiceError)
            ) {
              Toast.error({
                title: error.message || 'DeviceScanError',
              });
            } else {
              uiDeviceUtils.stopScan();
            }
          } else if (
            error instanceof InitIframeLoadFail ||
            error instanceof InitIframeTimeout
          ) {
            Toast.error({
              title: error.message || 'DeviceScanError',
            });
            uiDeviceUtils.stopScan();
          }
          setIsSearching(false);
          return;
        }

        setSearchedDevices(response.payload);
        console.log('startDeviceScan>>>>>', response.payload);
      },
      (state) => {
        searchStateRef.current = state;
      },
    );
  }, [intl]);

  const handleHeaderRightPress = useCallback(() => {
    navigation.push(EOnboardingPages.OneKeyHardwareWallet);
  }, [navigation]);

  const handleSetupNewWalletPress = useCallback(() => {
    navigation.push(EOnboardingPages.ActivateDevice);
  }, [navigation]);

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  const handleNotActivatedDevicePress = useCallback(() => {
    const dialog = Dialog.show({
      icon: 'WalletCryptoOutline',
      title: 'Activate Your Device',
      description: 'Set up your hardware wallet to get started.',
      dismissOnOverlayPress: false,
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
                dismissOnOverlayPress: false,
                description:
                  'Your package should not contain any pre-set PINs or Recovery Phrases. If such items are found, stop using the device and immediately reach out to OneKey Support for assistance.',
                onCancel: () => Linking.openURL(requestsUrl),
                onCancelText: 'Get Help',
                onConfirm: async () => {
                  await packageAlertDialog.close();
                  handleSetupNewWalletPress();
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
  }, [handleSetupNewWalletPress, requestsUrl]);

  const createHwWallet = useCallback(
    async ({
      device,
      isFirmwareVerified,
    }: {
      device: SearchDevice;
      isFirmwareVerified?: boolean;
    }) => {
      navigation.push(EOnboardingPages.FinalizeWalletSetup);
      try {
        console.log('ConnectYourDevice -> createHwWallet', device);
        let { features } = device as KnownDevice;
        if (!features) {
          features = await backgroundApiProxy.serviceHardware.getFeatures(
            device.connectId || '',
          );
        }
        await Promise.all([
          await actions.current.createHWWalletWithHidden({
            device,
            hideCheckingDeviceLoading: true, // device checking loading is not need for onboarding
            skipDeviceCancel: true, // createHWWalletWithHidden: skip device cancel as create may call device multiple times
            features,
            isFirmwareVerified,
          }),
        ]);
      } catch (error) {
        navigation.pop();
        throw error;
      } finally {
        await backgroundApiProxy.serviceHardware.closeHardwareUiStateDialog({
          connectId: device.connectId || '',
        });
      }
    },
    [actions, navigation],
  );

  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog();

  const handleHwWalletCreateFlow = useCallback(
    async ({ device }: { device: SearchDevice }) => {
      if (
        await backgroundApiProxy.serviceHardware.shouldAuthenticateFirmware({
          device,
        })
      ) {
        await showFirmwareVerifyDialog({
          device,
          onContinue: async ({ checked }) => {
            await createHwWallet({ device, isFirmwareVerified: checked });
          },
        });
        return;
      }

      await createHwWallet({ device });
    },
    [showFirmwareVerifyDialog, createHwWallet],
  );

  const devicesData = useMemo<
    {
      title: string;
      src: ImageSourcePropType;
      onPress: () => void;
      opacity?: number;
    }[]
  >(
    () => [
      /*
      navigation.replace(RootRoutes.Onboarding, {
          screen: EOnboardingRoutes.BehindTheScene,
          params: {
            password: '',
            mnemonic: '',
            isHardwareCreating: {
              device,
              features,
            },
            entry,
          },
        });
      serviceAccount.createHWWallet
      */
      ...searchedDevices.map((item) => ({
        title: item.name,
        src: HwWalletAvatarImages[item.deviceType],
        onPress: () => handleHwWalletCreateFlow({ device: item }),
        opacity: 1,
      })),
      ...(process.env.NODE_ENV !== 'production'
        ? [
            {
              title: 'OneKey Classic 1S(Activate Your Device -- ActionSheet)',
              src: HwWalletAvatarImages.classic1s,
              onPress: handleNotActivatedDevicePress,
            },
            {
              title: 'OneKey Pro(Activate Your Device)',
              src: HwWalletAvatarImages.pro,
              onPress: handleSetupNewWalletPress,
            },
            {
              title: 'OneKey Touch2(buy)',
              src: HwWalletAvatarImages.touch,
              onPress: handleHeaderRightPress,
            },
          ]
        : []),
    ],
    [
      handleHeaderRightPress,
      handleHwWalletCreateFlow,
      handleNotActivatedDevicePress,
      handleSetupNewWalletPress,
      searchedDevices,
    ],
  );

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
        <Stack alignItems="center" bg="$bgSubdued">
          <LottieView
            width="100%"
            height="$56"
            source={
              platformEnv.isNative ? ConnectByBluetoothAnim : ConnectByUSBAnim
            }
          />
        </Stack>

        {/* devices */}
        <ScrollView flex={1}>
          <SizableText
            textAlign="center"
            color="$textSubdued"
            pt="$2.5"
            pb="$5"
          >
            {platformEnv.isNative
              ? 'Please make sure your Bluetooth is enabled'
              : 'Connect your device via USB'}
          </SizableText>
          {devicesData.map((item, index) => (
            <ListItem
              opacity={item.opacity ?? 0.5}
              avatarProps={{
                source: item.src,
              }}
              key={index}
              title={item.title}
              drillIn
              onPress={item.onPress}
              focusable={false}
            />
          ))}
        </ScrollView>

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
            color="$textInteractive"
            hoverStyle={{
              color: '$textInteractiveHover',
            }}
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

export function ConnectYourDevice() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home, // TODO read from router
      }}
    >
      <ConnectYourDevicePage />
    </AccountSelectorProviderMirror>
  );
}
export default ConnectYourDevice;
