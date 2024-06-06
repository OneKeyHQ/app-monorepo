import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';
import { openSettings } from 'react-native-permissions';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Anchor,
  Button,
  Dialog,
  Divider,
  LottieView,
  Page,
  ScrollView,
  SegmentControl,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import ConnectByBluetoothAnim from '@onekeyhq/kit/assets/animations/connect_by_bluetooth.json';
import ConnectByUSBAnim from '@onekeyhq/kit/assets/animations/connect_by_usb.json';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { DeviceAvatar } from '@onekeyhq/kit/src/components/DeviceAvatar';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  PERMISSIONS,
  PermissionStatus,
  RESULTS,
  check,
  checkMultiple,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-permissions';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

import { useFirmwareUpdateActions } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import useScanQrCode from '../../../ScanQrCode/hooks/useScanQrCode';

import { useFirmwareVerifyDialog } from './FirmwareVerifyDialog';

import type { SearchDevice } from '@onekeyfe/hd-core';
import type { ImageSourcePropType } from 'react-native';

type IConnectYourDeviceItem = {
  title: string;
  src: ImageSourcePropType;
  onPress: () => void | Promise<void>;
  opacity?: number;
};

const headerRight = (onPress: () => void) => (
  <HeaderIconButton icon="QuestionmarkOutline" onPress={onPress} />
);

function DeviceListItem({ item }: { item: IConnectYourDeviceItem }) {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <ListItem
      opacity={item.opacity ?? 0.5}
      avatarProps={{
        source: item.src,
      }}
      title={item.title}
      drillIn
      isLoading={isLoading}
      // TODO add loading for onPress
      onPress={async () => {
        try {
          setIsLoading(true);
          await item.onPress();
        } finally {
          setIsLoading(false);
        }
      }}
    />
  );
}

function ConnectByQrCode() {
  const {
    start: startScan,
    // close,
  } = useScanQrCode();
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const { createQrWallet } = useCreateQrWallet();
  const intl = useIntl();

  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <DeviceAvatar deviceType="pro" size={40} />
      <SizableText textAlign="center" size="$bodyLgMedium" pt="$5" pb="$2">
        {intl.formatMessage({
          id: ETranslations.onboarding_create_qr_wallet_title,
        })}
      </SizableText>
      <SizableText
        textAlign="center"
        color="$textSubdued"
        maxWidth="$80"
        pb="$5"
      >
        {intl.formatMessage({
          id: ETranslations.onboarding_create_qr_wallet_desc,
        })}
      </SizableText>
      <Button
        variant="primary"
        $md={
          {
            size: 'large',
          } as IButtonProps
        }
        onPress={async () => {
          try {
            await createQrWallet({ isOnboarding: true });
          } catch (error) {
            navigation.pop();
            throw error;
          }
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_scan_to_connect })}
      </Button>
    </Stack>
  );
}

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}
function ConnectByUSBOrBLE({
  toOneKeyHardwareWalletPage,
}: {
  toOneKeyHardwareWalletPage: () => void;
}) {
  const intl = useIntl();
  const searchStateRef = useRef<'start' | 'stop'>('stop');
  const [connectStatus, setConnectStatus] = useState(EConnectionStatus.init);

  const actions = useAccountSelectorActions();

  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog();
  const fwUpdateActions = useFirmwareUpdateActions();
  const navigation = useAppNavigation();

  const createHwWallet = useCallback(
    async ({
      device,
      isFirmwareVerified,
      features,
    }: {
      device: SearchDevice;
      isFirmwareVerified?: boolean;
      features: IOneKeyDeviceFeatures;
    }) => {
      try {
        console.log('ConnectYourDevice -> createHwWallet', device);

        navigation.push(EOnboardingPages.FinalizeWalletSetup);

        await Promise.all([
          await actions.current.createHWWalletWithHidden({
            device,
            // device checking loading is not need for onboarding, use FinalizeWalletSetup instead
            hideCheckingDeviceLoading: true,
            skipDeviceCancel: true, // createHWWalletWithHidden: skip device cancel as create may call device multiple times
            features,
            isFirmwareVerified,
          }),
        ]);
      } catch (error) {
        navigation.pop();
        throw error;
      } finally {
        await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId: device.connectId || '',
        });
      }
    },
    [actions, navigation],
  );

  const handleSetupNewWalletPress = useCallback(() => {
    navigation.push(EOnboardingPages.ActivateDevice);
  }, [navigation]);

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  const handleNotActivatedDevicePress = useCallback(() => {
    const dialog = Dialog.show({
      icon: 'WalletCryptoOutline',
      title: ETranslations.onboarding_activate_device,
      description: ETranslations.onboarding_activate_device_help_text,
      dismissOnOverlayPress: false,
      renderContent: (
        <Stack>
          <ListItem
            alignItems="flex-start"
            icon="PlusCircleOutline"
            title={intl.formatMessage({
              id: ETranslations.onboarding_activate_device_by_set_up_new_wallet,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.onboarding_activate_device_by_set_up_new_wallet_help_text,
            })}
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
            title={intl.formatMessage({
              id: ETranslations.onboarding_activate_device_by_restore,
            })}
            subtitle={intl.formatMessage({
              id: ETranslations.onboarding_activate_device_by_restore_help_text,
            })}
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
  }, [handleSetupNewWalletPress, intl, requestsUrl]);

  const handleHwWalletCreateFlow = useCallback(
    async ({ device }: { device: SearchDevice }) => {
      const handleBootloaderMode = () => {
        Toast.error({
          title: 'Device is in bootloader mode',
        });
        fwUpdateActions.showBootloaderMode({
          connectId: device.connectId ?? undefined,
        });
        console.log('Device is in bootloader mode', device);
        throw new Error('Device is in bootloader mode');
      };
      if (
        await deviceUtils.isBootloaderModeFromSearchDevice({
          device: device as any,
        })
      ) {
        handleBootloaderMode();
        return;
      }

      const features = await backgroundApiProxy.serviceHardware.connect({
        device,
      });
      if (!features) {
        throw new Error('connect device failed, no features returned');
      }

      if (await deviceUtils.isBootloaderModeByFeatures({ features })) {
        handleBootloaderMode();
        return;
      }

      if (
        await backgroundApiProxy.serviceHardware.shouldAuthenticateFirmware({
          device,
        })
      ) {
        await showFirmwareVerifyDialog({
          device,
          onContinue: async ({ checked }) => {
            await createHwWallet({
              device,
              isFirmwareVerified: checked,
              features,
            });
          },
        });
        return;
      }

      await createHwWallet({ device, features });
    },
    [createHwWallet, fwUpdateActions, showFirmwareVerifyDialog],
  );

  const checkBLEPermission = useCallback(async () => {
    if (platformEnv.isNativeIOS) {
      const status = await check(PERMISSIONS.IOS.BLUETOOTH);
      return status === RESULTS.GRANTED;
    }

    if (platformEnv.isNativeAndroid) {
      const statuses = checkMultiple([
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      ]);
      console.log('---statuses', statuses);
      return true;
    }
  }, []);

  const [isSearching, setIsSearching] = useState(false);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);

  const devicesData = useMemo<IConnectYourDeviceItem[]>(
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
              onPress: toOneKeyHardwareWalletPage,
            },
          ]
        : []),
    ],
    [
      handleHwWalletCreateFlow,
      handleNotActivatedDevicePress,
      handleSetupNewWalletPress,
      searchedDevices,
      toOneKeyHardwareWalletPage,
    ],
  );

  const scanDevice = useCallback(() => {
    const deviceScanner = deviceUtils.getDeviceScanner({
      backgroundApi: backgroundApiProxy,
    });
    deviceScanner.startDeviceScan(
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
              deviceScanner.stopScan();
            }
          } else if (
            error instanceof InitIframeLoadFail ||
            error instanceof InitIframeTimeout
          ) {
            Toast.error({
              title: error.message || 'DeviceScanError',
            });
            deviceScanner.stopScan();
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
  }, []);

  const checkBLEState = useCallback(async () => {
    const bleManager = await uiDeviceUtils.getBleManager();
    const checkState = await bleManager?.checkState();
    return checkState === 'on';
  }, []);

  const startBLEConnection = useCallback(async () => {
    const isGranted = await checkBLEPermission();
    if (!isGranted) {
      Dialog.confirm({
        title: 'Bluetooth permission needed',
        description:
          'To connect via Bluetooth, please enable access in Settings.',
        onConfirmText: 'Go to Settings',
        onConfirm: openSettings,
      });
      return;
    }

    const checkState = await checkBLEState();
    if (!checkState) {
      Dialog.confirm({
        title: 'Turn on Bluetooth Switch',
        description: 'To connect via Bluetooth, please Turn on Bluetooth.',
      });
    }
  }, [checkBLEPermission, checkBLEState]);

  useEffect(() => {
    if (!platformEnv.isNative) {
      setConnectStatus(EConnectionStatus.listing);
      scanDevice();
    }
  }, [checkBLEPermission, scanDevice]);

  switch (connectStatus) {
    case EConnectionStatus.init:
      return (
        <>
          {/* connecting animation */}
          <Stack alignItems="center" bg="$bgSubdued">
            <LottieView
              width="100%"
              height="$56"
              source={
                platformEnv.isNative ? ConnectByBluetoothAnim : ConnectByUSBAnim
              }
            />
          </Stack>

          <YStack>
            <SizableText>Keep the device nearby</SizableText>
            <SizableText>
              Ensure the device is powered on and within range, then press
              "Connect device" below to start the connection
            </SizableText>
            <Button onPress={startBLEConnection}>Start connection</Button>
          </YStack>
        </>
      );
    case EConnectionStatus.listing:
      return (
        <>
          {/* connecting animation */}
          <Stack alignItems="center" bg="$bgSubdued">
            <LottieView
              width="100%"
              height="$56"
              source={
                platformEnv.isNative ? ConnectByBluetoothAnim : ConnectByUSBAnim
              }
            />
          </Stack>

          {/* list devices */}
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
              <DeviceListItem item={item} key={index} />
            ))}
            {platformEnv.isDev ? (
              <Button
                onPress={() => {
                  void fwUpdateActions.showForceUpdate({
                    connectId: undefined,
                  });
                }}
              >
                ForceUpdate
              </Button>
            ) : null}
          </ScrollView>
        </>
      );

    default:
      return null;
  }
}
enum EConnectDeviceTab {
  usbOrBle = 'usbOrBle',
  qr = 'qr',
}
export function ConnectYourDevicePage() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const [tabValue, setTabValue] = useState<EConnectDeviceTab>(
    EConnectDeviceTab.usbOrBle,
  );

  const toOneKeyHardwareWalletPage = useCallback(() => {
    navigation.push(EOnboardingPages.OneKeyHardwareWallet);
  }, [navigation]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.onboarding_connect_your_device,
        })}
        headerRight={() => headerRight(toOneKeyHardwareWalletPage)}
      />
      <Page.Body>
        <Stack px="$5" pt="$2" pb="$4">
          <SegmentControl
            fullWidth
            value={tabValue}
            onChange={(v) => setTabValue(v as any)}
            options={[
              {
                label: platformEnv.isNative
                  ? intl.formatMessage({ id: ETranslations.global_bluetooth })
                  : 'USB',
                value: EConnectDeviceTab.usbOrBle,
              },
              {
                label: intl.formatMessage({ id: ETranslations.global_qr_code }),
                value: EConnectDeviceTab.qr,
              },
            ]}
          />
        </Stack>
        <Divider />

        {tabValue === EConnectDeviceTab.usbOrBle ? (
          <ConnectByUSBOrBLE
            toOneKeyHardwareWalletPage={toOneKeyHardwareWalletPage}
          />
        ) : null}

        {tabValue === EConnectDeviceTab.qr ? <ConnectByQrCode /> : null}

        {/* buy link */}
        <XStack
          px="$5"
          py="$0.5"
          mt="auto"
          justifyContent="center"
          alignItems="center"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              // eslint-disable-next-line spellcheck/spell-checker
              id: ETranslations.global_onekey_prompt_dont_have_yet,
            })}
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
            {intl.formatMessage({ id: ETranslations.global_buy_one })}
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
