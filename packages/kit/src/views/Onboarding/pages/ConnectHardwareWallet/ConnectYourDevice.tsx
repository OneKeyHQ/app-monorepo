import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useRoute } from '@react-navigation/core';
import { get } from 'lodash';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import {
  Accordion,
  Anchor,
  Button,
  Dialog,
  Divider,
  Empty,
  Heading,
  Icon,
  LottieView,
  Page,
  ScrollView,
  SegmentControl,
  SizableText,
  Spinner,
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
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import {
  OpenBleSettingsDialog,
  RequireBlePermissionDialog,
} from '@onekeyhq/kit/src/components/Hardware/HardwareDialog';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import type { ITutorialsListItem } from '@onekeyhq/kit/src/components/TutorialsList';
import { TutorialsList } from '@onekeyhq/kit/src/components/TutorialsList';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  HARDWARE_BRIDGE_DOWNLOAD_URL,
  HARDWARE_BRIDGE_INSTALL_TROUBLESHOOTING,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  BleLocationServiceError,
  BridgeTimeoutError,
  BridgeTimeoutErrorForDesktop,
  ConnectTimeoutError,
  DeviceMethodCallTimeout,
  InitIframeLoadFail,
  InitIframeTimeout,
  NeedBluetoothPermissions,
  NeedBluetoothTurnedOn,
  NeedOneKeyBridge,
  OneKeyHardwareError,
} from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import bleManagerInstance from '@onekeyhq/shared/src/hardware/bleManager';
import { checkBLEPermissions } from '@onekeyhq/shared/src/hardware/blePermissions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import {
  EOneKeyDeviceMode,
  type IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';

import { useFirmwareUpdateActions } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateActions';

import { useFirmwareVerifyDialog } from './FirmwareVerifyDialog';

import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';
import type { RouteProp } from '@react-navigation/core';
import type { ImageSourcePropType } from 'react-native';

type IConnectYourDeviceItem = {
  title: string;
  src: ImageSourcePropType;
  onPress: () => void | Promise<void>;
  opacity?: number;
  device: SearchDevice | undefined;
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
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="QuestionmarkSolid" />,
        },
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
  const { createQrWallet } = useCreateQrWallet();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const tutorials: ITutorialsListItem[] = [
    {
      title: intl.formatMessage({
        id: ETranslations.onboarding_create_qr_wallet_unlock_device_desc,
      }),
    },
    {
      title: intl.formatMessage({
        id: ETranslations.onboarding_create_qr_wallet_show_qr_code_desc,
      }),
    },
    {
      title: intl.formatMessage({
        id: ETranslations.onboarding_create_qr_wallet_scan_qr_code_desc,
      }),
    },
  ];

  return (
    <Stack flex={1} px="$5" alignItems="center" justifyContent="center">
      <SizableText textAlign="center" size="$headingMd" pb="$5">
        {intl.formatMessage({
          id: ETranslations.onboarding_create_qr_wallet_title,
        })}
      </SizableText>
      <TutorialsList tutorials={tutorials} mb="$5" w="100%" maxWidth="$96" />
      <Button
        variant="primary"
        $md={
          {
            size: 'large',
          } as any
        }
        onPress={async () => {
          try {
            // qrHiddenCreateGuideDialog.showDialog();
            // return;
            await createQrWallet({
              isOnboarding: true,
              onFinalizeWalletSetupError: () => {
                // only pop when finalizeWalletSetup pushed
                navigation.pop();
              },
            });
          } catch (error) {
            errorToastUtils.toastIfError(error);
            throw error;
          }
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_scan_to_connect })}
      </Button>
    </Stack>
  );
}

function ConnectByQrCodeComingSoon() {
  const intl = useIntl();
  const [showConnectQr, setShowConnectQr] = useState(true);
  if (showConnectQr) {
    return <ConnectByQrCode />;
  }

  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <MultipleClickStack
        onPress={() => {
          setShowConnectQr(true);
        }}
      >
        <Empty
          icon="CalendarOutline"
          title={intl.formatMessage({
            id: ETranslations.coming_soon,
          })}
          description={intl.formatMessage({
            id: ETranslations.coming_soon_desc,
          })}
        />
      </MultipleClickStack>
    </Stack>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BridgeNotInstalledDialogContent(props: { error: NeedOneKeyBridge }) {
  return (
    <Stack>
      <Dialog.RichDescription
        linkList={{
          url: {
            url: HARDWARE_BRIDGE_INSTALL_TROUBLESHOOTING,
          },
        }}
      >
        {ETranslations.onboarding_install_onekey_bridge_help_text}
      </Dialog.RichDescription>
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

  const handleSetupNewWalletPress = useCallback(
    ({ deviceType }: { deviceType: IDeviceType }) => {
      navigation.push(EOnboardingPages.ActivateDevice, {
        tutorialType: 'create',
        deviceType,
      });
    },
    [navigation],
  );

  const handleRestoreWalletPress = useCallback(
    ({ deviceType }: { deviceType: IDeviceType }) => {
      navigation.push(EOnboardingPages.ActivateDevice, {
        tutorialType: 'restore',
        deviceType,
      });
    },
    [navigation],
  );

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  const handleNotActivatedDevicePress = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ deviceType }: { deviceType: IDeviceType }) => {
      const dialog = Dialog.show({
        icon: 'WalletCryptoOutline',
        title: intl.formatMessage({
          id: ETranslations.onboarding_activate_device,
        }),
        description: intl.formatMessage({
          id: ETranslations.onboarding_activate_device_help_text,
        }),
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
                handleSetupNewWalletPress({ deviceType });
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
                  tone: 'warning',
                  icon: 'PackageDeliveryOutline',
                  title: intl.formatMessage({
                    id: ETranslations.onboarding_activate_device_by_restore_warning,
                  }),
                  dismissOnOverlayPress: false,
                  description: intl.formatMessage({
                    id: ETranslations.onboarding_activate_device_by_restore_warning_help_text,
                  }),
                  showFooter: false,
                  renderContent: (
                    <XStack gap="$2.5">
                      <Button
                        flex={1}
                        size="large"
                        $gtMd={{ size: 'medium' } as any}
                        onPress={() => Linking.openURL(requestsUrl)}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_contact_us,
                        })}
                      </Button>
                      <Button
                        flex={1}
                        variant="primary"
                        size="large"
                        $gtMd={{ size: 'medium' } as any}
                        onPress={async () => {
                          await packageAlertDialog.close();
                          handleRestoreWalletPress({ deviceType });
                        }}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_continue,
                        })}
                      </Button>
                    </XStack>
                  ),
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
    },
    [handleRestoreWalletPress, handleSetupNewWalletPress, intl, requestsUrl],
  );

  const connectDevice = useCallback(async (device: SearchDevice) => {
    try {
      return await backgroundApiProxy.serviceHardware.connect({
        device,
        awaitBonded: true,
      });
    } catch (error: any) {
      if (error instanceof OneKeyHardwareError) {
        const { code, message } = error;
        // ui prop window handler
        if (
          code === HardwareErrorCode.CallMethodNeedUpgradeFirmware ||
          code === HardwareErrorCode.BlePermissionError ||
          code === HardwareErrorCode.BleLocationError
        ) {
          return;
        }
        Toast.error({
          title: message || 'DeviceConnectError',
        });
      } else {
        console.error('connectDevice error:', get(error, 'message', ''));
      }
    }
  }, []);

  const [isSearching, setIsSearching] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);
  const [showHelper, setShowHelper] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  const deviceScanner = useMemo(
    () =>
      deviceUtils.getDeviceScanner({
        backgroundApi: backgroundApiProxy,
      }),
    [],
  );

  const scanDevice = useCallback(() => {
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
              title: intl.formatMessage({
                id: ETranslations.global_network_error,
              }),
              // error.message i18n should set InitIframeLoadFail.defaultKey, InitIframeTimeout.defaultKey
              message: error.message || 'DeviceScanError',
              // message: "Check your connection and retry",
            });
            deviceScanner.stopScan();
          }

          if (
            error instanceof BridgeTimeoutError ||
            error instanceof BridgeTimeoutErrorForDesktop
          ) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_connection_failed,
              }),
              // error.message i18n should set BridgeTimeoutError.defaultKey...
              message: error.message || 'DeviceScanError',
              // message: "Please reconnect the USB and try again", // USB only
            });
            deviceScanner.stopScan();
          }

          if (
            error instanceof ConnectTimeoutError ||
            error instanceof DeviceMethodCallTimeout
          ) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_connection_failed,
              }),
              // error.message i18n should set ConnectTimeoutError.defaultKey...
              message: error.message || 'DeviceScanError',
              // message: "Please reconnect device and try again", // USB or BLE
            });
            deviceScanner.stopScan();
          }

          if (error instanceof NeedOneKeyBridge) {
            Dialog.confirm({
              icon: 'OnekeyBrand',
              title: intl.formatMessage({
                id: ETranslations.onboarding_install_onekey_bridge,
              }),
              // error.message i18n should set NeedOneKeyBridge.defaultKey...
              renderContent: <BridgeNotInstalledDialogContent error={error} />,
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_download_and_install,
              }),
              onConfirm: () => Linking.openURL(HARDWARE_BRIDGE_DOWNLOAD_URL),
            });

            deviceScanner.stopScan();
          }

          setIsSearching(false);
          return;
        }

        const sortedDevices = response.payload.sort((a, b) =>
          natsort({ insensitive: true })(
            a.name || a.connectId || a.deviceId || a.uuid,
            b.name || b.connectId || b.deviceId || b.uuid,
          ),
        );
        setSearchedDevices(sortedDevices);
        console.log('=====>>>>> startDeviceScan>>>>>', sortedDevices);
      },
      (state) => {
        searchStateRef.current = state;
      },
    );
  }, [deviceScanner, intl]);

  const stopScan = useCallback(() => {
    console.log('=====>>>>> stopDeviceScan>>>>>');
    deviceScanner.stopScan();
    setIsSearching(false);
  }, [deviceScanner]);

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

        stopScan();

        defaultLogger.account.wallet.connectHWWallet({
          connectType: platformEnv.isNative ? 'ble' : 'usb',
          deviceType: device.deviceType,
          deviceFmVersion: features.onekey_firmware_version,
        });

        navigation.push(EOnboardingPages.FinalizeWalletSetup);

        await Promise.all([
          await actions.current.createHWWalletWithHidden({
            device,
            // device checking loading is not need for onboarding, use FinalizeWalletSetup instead
            hideCheckingDeviceLoading: true,
            features,
            isFirmwareVerified,
            defaultIsTemp: true,
          }),
        ]);
      } catch (error) {
        errorToastUtils.toastIfError(error);
        navigation.pop();
        scanDevice();
        throw error;
      } finally {
        const connectId = device.connectId || '';
        await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId,
          hardClose: true,
        });
      }
    },
    [actions, navigation, stopScan, scanDevice],
  );

  const handleHwWalletCreateFlow = useCallback(
    async ({ device }: { device: SearchDevice }) => {
      if (device.deviceType === 'unknown') {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.hardware_connect_unknown_device_error,
          }),
        });
        return;
      }

      const handleBootloaderMode = (existsFirmware: boolean) => {
        fwUpdateActions.showBootloaderMode({
          connectId: device.connectId ?? undefined,
          existsFirmware,
        });
        console.log('Device is in bootloader mode', device);
        throw new Error('Device is in bootloader mode');
      };
      if (
        await deviceUtils.isBootloaderModeFromSearchDevice({
          device: device as any,
        })
      ) {
        const existsFirmware = await deviceUtils.existsFirmwareFromSearchDevice(
          { device: device as any },
        );
        handleBootloaderMode(existsFirmware);
        return;
      }

      const features = await connectDevice(device);

      if (!features) {
        throw new Error('connect device failed, no features returned');
      }

      if (await deviceUtils.isBootloaderModeByFeatures({ features })) {
        const existsFirmware = await deviceUtils.existsFirmwareByFeatures({
          features,
        });
        handleBootloaderMode(existsFirmware);
        return;
      }

      let deviceType = await deviceUtils.getDeviceTypeFromFeatures({
        features,
      });
      if (deviceType === 'unknown') {
        deviceType = device.deviceType || deviceType;
      }

      const deviceMode = await deviceUtils.getDeviceModeFromFeatures({
        features,
      });
      // const deviceMode = EOneKeyDeviceMode.notInitialized;
      if (deviceMode === EOneKeyDeviceMode.backupMode) {
        Toast.error({
          title: 'Device is in backup mode',
        });
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
            if (deviceMode === EOneKeyDeviceMode.notInitialized) {
              handleNotActivatedDevicePress({ deviceType });
              return;
            }

            await createHwWallet({
              device,
              isFirmwareVerified: checked,
              features,
            });
          },
        });
        return;
      }

      if (deviceMode === EOneKeyDeviceMode.notInitialized) {
        handleNotActivatedDevicePress({ deviceType });
        return;
      }

      await createHwWallet({ device, features });
    },
    [
      connectDevice,
      createHwWallet,
      fwUpdateActions,
      handleNotActivatedDevicePress,
      intl,
      showFirmwareVerifyDialog,
    ],
  );

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
        device: item,
        onPress: () => handleHwWalletCreateFlow({ device: item }),
        opacity: 1,
      })),
      // ...(process.env.NODE_ENV !== 'production'
      //   ? [
      //       {
      //         title: 'OneKey Classic 1S(Activate Your Device -- ActionSheet)',
      //         src: HwWalletAvatarImages.classic1s,
      //         onPress: () =>
      //           handleNotActivatedDevicePress({ deviceType: 'classic' }),
      //         device: undefined,
      //       },
      //       {
      //         title: 'OneKey Classic 1S(Activate Your Device)',
      //         src: HwWalletAvatarImages.classic1s,
      //         onPress: () =>
      //           handleSetupNewWalletPress({ deviceType: 'classic' }),
      //         device: undefined,
      //       },
      //       {
      //         title: 'OneKey Pro(Activate Your Device -- ActionSheet)',
      //         src: HwWalletAvatarImages.pro,
      //         onPress: () =>
      //           handleNotActivatedDevicePress({ deviceType: 'pro' }),
      //         device: undefined,
      //       },
      //       {
      //         title: 'OneKey Touch(Activate Your Device -- ActionSheet)',
      //         src: HwWalletAvatarImages.touch,
      //         onPress: () =>
      //           handleNotActivatedDevicePress({ deviceType: 'touch' }),
      //         device: undefined,
      //       },
      //       {
      //         title: 'OneKey Mini(Activate Your Device -- ActionSheet)',
      //         src: HwWalletAvatarImages.mini,
      //         onPress: () =>
      //           handleNotActivatedDevicePress({ deviceType: 'mini' }),
      //         device: undefined,
      //       },
      //       {
      //         title: 'OneKey Plus(Test Unknown Device)',
      //         src: HwWalletAvatarImages.unknown,
      //         onPress: () =>
      //           handleHwWalletCreateFlow({
      //             device: {
      //               connectId: '123',
      //               uuid: '123',
      //               deviceId: '123',
      //               deviceType: 'unknown',
      //               name: 'OneKey Plus',
      //             },
      //           }),
      //         device: undefined,
      //       },
      //       {
      //         title: 'OneKey Touch2(buy)',
      //         src: HwWalletAvatarImages.touch,
      //         onPress: toOneKeyHardwareWalletPage,
      //         device: undefined,
      //       },
      //     ]
      //   : []),
    ],
    [handleHwWalletCreateFlow, searchedDevices],
  );

  const checkBLEState = useCallback(async () => {
    // hack missing getBleManager.
    await bleManagerInstance.getBleManager();
    await timerUtils.wait(100);
    const bleManager = await bleManagerInstance.getBleManager();
    const checkState = await bleManager?.checkState();
    return checkState === 'on';
  }, []);

  const listingDevice = useCallback(() => {
    setConnectStatus(EConnectionStatus.listing);
    scanDevice();
  }, [scanDevice]);

  const RequireBlePermissionDialogRender = useCallback(
    ({ ref }: { ref: any }) => <RequireBlePermissionDialog ref={ref} />,
    [],
  );
  const OpenBleSettingsDialogRender = useCallback(
    ({ ref }: { ref: any }) => <OpenBleSettingsDialog ref={ref} />,
    [],
  );

  const startBLEConnection = useCallback(async () => {
    setIsChecking(true);
    const isGranted = await checkBLEPermissions();
    if (!isGranted) {
      Dialog.show({
        dialogContainer: RequireBlePermissionDialogRender,
        onClose: () => setIsChecking(false),
      });
      return;
    }

    const checkState = await checkBLEState();
    if (!checkState) {
      Dialog.show({
        dialogContainer: OpenBleSettingsDialogRender,
        onClose: async () => setIsChecking(false),
      });
      return;
    }

    setIsChecking(false);
    listingDevice();
  }, [
    OpenBleSettingsDialogRender,
    RequireBlePermissionDialogRender,
    checkBLEState,
    listingDevice,
  ]);

  useEffect(() => {
    if (!platformEnv.isNative) {
      listingDevice();
    }
  }, [listingDevice]);

  useEffect(() => {
    const handler = () => {
      navigation.pop();
    };
    appEventBus.on(EAppEventBusNames.BeginFirmwareUpdate, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.BeginFirmwareUpdate, handler);
    };
  }, [navigation]);

  useEffect(
    () =>
      // unmount page stop scan
      () => {
        deviceScanner?.stopScan();
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (connectStatus === EConnectionStatus.listing) {
      const timer = setTimeout(() => {
        setShowHelper(true);
      }, 10_000);

      return () => clearTimeout(timer);
    }
  }, [connectStatus]);

  const handleHelperPress = useCallback(() => {
    setShowTroubleshooting(true);
    setShowHelper(false);
  }, []);

  const usbTroubleshootingSolutions = [
    [
      intl.formatMessage({
        id: ETranslations.troubleshooting_replug_usb_cable,
      }),
      intl.formatMessage({
        id: ETranslations.troubleshooting_connect_and_unlock,
      }),
    ],
    [
      intl.formatMessage({ id: ETranslations.troubleshooting_change_usb_port }),
      intl.formatMessage({
        id: ETranslations.troubleshooting_remove_usb_dongles,
      }),
      intl.formatMessage({
        id: ETranslations.troubleshooting_connect_and_unlock,
      }),
    ],
    [
      intl.formatMessage({
        id: ETranslations.troubleshooting_use_original_usb_cable,
      }),
      intl.formatMessage({
        id: ETranslations.troubleshooting_try_different_usb_cable,
      }),
      intl.formatMessage({
        id: ETranslations.troubleshooting_connect_and_unlock,
      }),
    ],
    [
      intl.formatMessage(
        { id: ETranslations.troubleshooting_check_bridge },
        {
          tag: (chunks: ReactNode[]) => (
            <Anchor
              href="https://help.onekey.so/hc/articles/360004279036"
              target="_blank"
              size="$bodyMd"
              color="$textInfo"
            >
              {chunks}
            </Anchor>
          ),
        },
      ),
      intl.formatMessage({
        id: ETranslations.troubleshooting_close_other_onekey_app,
      }),
      intl.formatMessage({
        id: ETranslations.troubleshooting_connect_and_unlock,
      }),
    ],
  ];

  const bluetoothTroubleshootingSolutions = [
    [
      intl.formatMessage({ id: ETranslations.troubleshooting_check_bluetooth }),
      intl.formatMessage({ id: ETranslations.troubleshooting_unlock_device }),
    ],
    [
      intl.formatMessage({
        id: ETranslations.troubleshooting_remove_device_from_bluetooth_list,
      }),
      intl.formatMessage({ id: ETranslations.troubleshooting_restart_app }),
      intl.formatMessage({
        id: ETranslations.troubleshooting_reconnect_and_pair,
      }),
    ],
  ];

  const troubleshootingSolutions = [
    ...(platformEnv.isNative
      ? bluetoothTroubleshootingSolutions
      : usbTroubleshootingSolutions),
    [
      intl.formatMessage(
        { id: ETranslations.troubleshooting_help_center },
        {
          tag: (chunks: ReactNode[]) => (
            <Anchor
              href="https://help.onekey.so/hc/search?utf8=%E2%9C%93&query=connect"
              target="_blank"
              size="$bodyMd"
              color="$textInfo"
            >
              {chunks}
            </Anchor>
          ),
        },
      ),
      intl.formatMessage(
        { id: ETranslations.troubleshooting_request },
        {
          tag: (chunks: ReactNode[]) => (
            <Anchor
              href="https://help.onekey.so/hc/requests/new"
              target="_blank"
              size="$bodyMd"
              color="$textInfo"
            >
              {chunks}
            </Anchor>
          ),
        },
      ),
    ],
  ];

  return (
    <>
      <Stack bg="$bgSubdued">
        {!showTroubleshooting ? (
          <LottieView
            width="100%"
            height="$56"
            source={
              platformEnv.isNative ? ConnectByBluetoothAnim : ConnectByUSBAnim
            }
          />
        ) : (
          <Accordion type="single" defaultValue="0" collapsible>
            {troubleshootingSolutions.map((list, index) => (
              <Accordion.Item value={index.toString()} key={index.toString()}>
                <Accordion.Trigger
                  unstyled
                  flexDirection="row"
                  alignItems="center"
                  borderWidth={0}
                  px="$5"
                  py="$2"
                  bg="$transparent"
                  hoverStyle={{ bg: '$bgHover' }}
                  pressStyle={{
                    bg: '$bgActive',
                  }}
                  focusVisibleStyle={{
                    outlineWidth: 2,
                    outlineStyle: 'solid',
                    outlineColor: '$focusRing',
                    outlineOffset: 0,
                  }}
                >
                  {({ open }: { open: boolean }) => (
                    <>
                      <Heading
                        flex={1}
                        size={open ? '$headingSm' : '$bodyMd'}
                        textAlign="left"
                        color={open ? '$text' : '$textSubdued'}
                      >
                        {index === troubleshootingSolutions.length - 1
                          ? intl.formatMessage({
                              id: ETranslations.troubleshooting_fallback_solution_label,
                            })
                          : intl.formatMessage(
                              { id: ETranslations.troubleshooting_solution_x },
                              {
                                number: index + 1,
                              },
                            )}
                      </Heading>
                      <Stack
                        animation="quick"
                        rotate={open ? '180deg' : '0deg'}
                      >
                        <Icon
                          name="ChevronDownSmallOutline"
                          color={open ? '$iconActive' : '$iconSubdued'}
                          size="$5"
                        />
                      </Stack>
                    </>
                  )}
                </Accordion.Trigger>
                <Accordion.HeightAnimator
                  animation="quick"
                  borderBottomWidth={StyleSheet.hairlineWidth}
                  borderBottomColor="$borderSubdued"
                >
                  <Accordion.Content
                    unstyled
                    animation="quick"
                    enterStyle={{ opacity: 0 }}
                    exitStyle={{ opacity: 0 }}
                  >
                    <Stack role="list" px="$5" pt="$1" pb="$3">
                      {list.map((item, subIndex) => (
                        <XStack role="listitem" key={subIndex} gap="$2">
                          <SizableText
                            w="$4"
                            size="$bodyMd"
                            color="$textSubdued"
                          >
                            {subIndex + 1}.
                          </SizableText>
                          <SizableText
                            $md={{
                              maxWidth: '$78',
                            }}
                            size="$bodyMd"
                          >
                            {item}
                          </SizableText>
                        </XStack>
                      ))}
                    </Stack>
                  </Accordion.Content>
                </Accordion.HeightAnimator>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
        {showHelper ? (
          <Stack
            position="absolute"
            left="$0"
            right="$0"
            bottom="$0"
            p="$2"
            bg="$gray3"
            alignItems="center"
          >
            <Button size="small" variant="tertiary" onPress={handleHelperPress}>
              {intl.formatMessage({
                id: ETranslations.troubleshooting_show_helper_cta_label,
              })}
            </Button>
          </Stack>
        ) : null}
      </Stack>

      {connectStatus === EConnectionStatus.init ? (
        <YStack pt="$8">
          <Heading size="$headingMd" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.onboarding_bluetooth_prepare_to_connect,
            })}
          </Heading>
          <SizableText
            pt="$2"
            pb="$5"
            color="$textSubdued"
            textAlign="center"
            maxWidth="$80"
            mx="auto"
          >
            {intl.formatMessage({
              id: ETranslations.onboarding_bluetooth_prepare_to_connect_help_text,
            })}
          </SizableText>
          <Button
            mx="auto"
            size="large"
            variant="primary"
            loading={isChecking}
            onPress={startBLEConnection}
          >
            {intl.formatMessage({ id: ETranslations.global_start_connection })}
          </Button>
        </YStack>
      ) : null}

      {connectStatus === EConnectionStatus.listing ? (
        <ScrollView flex={1}>
          <XStack
            gap="$2"
            alignItems="center"
            justifyContent="center"
            py="$2.5"
            px="$5"
          >
            <Spinner size="small" />
            <SizableText color="$textSubdued">
              {`${intl.formatMessage({
                id: ETranslations.onboarding_bluetooth_connect_help_text,
              })}...`}
            </SizableText>
          </XStack>
          {devicesData.map((item) => (
            <DeviceListItem
              item={item}
              key={item.device?.connectId ?? item.title}
            />
          ))}
          {/* {platformEnv.isDev ? (
            <Button
              onPress={() => {
                void fwUpdateActions.showForceUpdate({
                  connectId: undefined,
                });
              }}
            >
              ForceUpdate
            </Button>
          ) : null} */}
        </ScrollView>
      ) : null}
    </>
  );
}

export function ConnectYourDevicePage() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IOnboardingParamList, EOnboardingPages.ConnectYourDevice>
    >();
  const { channel } = route?.params ?? {};

  const [tabValue, setTabValue] = useState<EConnectDeviceChannel>(
    channel ?? EConnectDeviceChannel.usbOrBle,
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
                value: EConnectDeviceChannel.usbOrBle,
              },
              {
                label: intl.formatMessage({ id: ETranslations.global_qr_code }),
                value: EConnectDeviceChannel.qr,
              },
            ]}
          />
        </Stack>
        <Divider />

        {tabValue === EConnectDeviceChannel.usbOrBle ? (
          <ConnectByUSBOrBLE
            toOneKeyHardwareWalletPage={toOneKeyHardwareWalletPage}
          />
        ) : null}

        {tabValue === EConnectDeviceChannel.qr ? (
          <ConnectByQrCodeComingSoon />
        ) : null}

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
            href="https://bit.ly/3YsKilK"
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
