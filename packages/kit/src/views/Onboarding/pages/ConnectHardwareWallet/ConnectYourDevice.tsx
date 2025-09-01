/* eslint-disable react/no-unstable-nested-components */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { type RouteProp, useRoute } from '@react-navigation/core';
import { get, isString } from 'lodash';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import type { ILottieViewProps } from '@onekeyhq/components';
import {
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
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import BluetoothSignalSpreading from '@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json';
import ConnectByBluetoothAnim from '@onekeyhq/kit/assets/animations/connect_by_bluetooth.json';
import ConnectByUSBAnim from '@onekeyhq/kit/assets/animations/connect_by_usb.json';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useCreateQrWallet } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useCreateQrWallet';
import { ConnectionTroubleShootingAccordion } from '@onekeyhq/kit/src/components/Hardware/ConnectionTroubleShootingAccordion';
import {
  OpenBleSettingsDialog,
  RequireBlePermissionDialog,
} from '@onekeyhq/kit/src/components/Hardware/HardwareDialog';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import type { ITutorialsListItem } from '@onekeyhq/kit/src/components/TutorialsList';
import { TutorialsList } from '@onekeyhq/kit/src/components/TutorialsList';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBCreateHwWalletParamsBase } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { HARDWARE_BRIDGE_DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
import bleManagerInstance from '@onekeyhq/shared/src/hardware/bleManager';
import { checkBLEPermissions } from '@onekeyhq/shared/src/hardware/blePermissions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import {
  HwWalletAvatarImages,
  getDeviceAvatarImage,
} from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import {
  EAccountSelectorSceneName,
  EHardwareTransportType,
} from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import {
  EOneKeyDeviceMode,
  type IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';

import { useBuyOneKeyHeaderRightButton } from '../../../DeviceManagement/hooks/useBuyOneKeyHeaderRightButton';
import { useFirmwareUpdateActions } from '../../../FirmwareUpdate/hooks/useFirmwareUpdateActions';

import { useFirmwareVerifyDialog } from './FirmwareVerifyDialog';
import { useSelectAddWalletTypeDialog } from './SelectAddWalletTypeDialog';

import type { Features, IDeviceType, SearchDevice } from '@onekeyfe/hd-core';
import type { ImageSourcePropType } from 'react-native';

// Helper function to convert transport type enum to analytics string
type IHardwareCommunicationType = 'Bluetooth' | 'WebUSB' | 'USB' | 'QRCode';
// TODO: update this function to use the new transport type
function getHardwareCommunicationTypeString(
  hardwareTransportType: EHardwareTransportType | undefined | 'QRCode',
): IHardwareCommunicationType {
  if (
    hardwareTransportType === EHardwareTransportType.BLE ||
    hardwareTransportType === EHardwareTransportType.DesktopWebBle
  ) {
    return 'Bluetooth';
  }
  if (hardwareTransportType === EHardwareTransportType.WEBUSB) {
    return 'WebUSB';
  }
  if (hardwareTransportType === 'QRCode') {
    return 'QRCode';
  }
  return platformEnv.isNative ? 'Bluetooth' : 'USB';
}

// Helper function to map user-selected channel to forced transport type
async function getForceTransportType(
  channel: EConnectDeviceChannel,
): Promise<EHardwareTransportType | undefined> {
  switch (channel) {
    case EConnectDeviceChannel.bluetooth:
      return platformEnv.isSupportDesktopBle
        ? EHardwareTransportType.DesktopWebBle
        : EHardwareTransportType.BLE;
    case EConnectDeviceChannel.usbOrBle: {
      // For usbOrBle, constrain based on platform
      if (platformEnv.isNative) {
        return EHardwareTransportType.BLE;
      }
      // For desktop/web/extension, use system setting transport type
      if (platformEnv.isDesktop) {
        return EHardwareTransportType.Bridge;
      }
      // For web/extension, get the current transport type setting
      const currentTransportType =
        await backgroundApiProxy.serviceSetting.getHardwareTransportType();
      return currentTransportType;
    }
    case EConnectDeviceChannel.qr:
      // QR code doesn't use hardware transport
      return undefined;
    default:
      return undefined;
  }
}

const trackHardwareWalletConnection = async ({
  status,
  deviceType,
  isSoftwareWalletOnlyUser,
  features,
  hardwareTransportType,
}: {
  status: 'success' | 'failure';
  deviceType: IDeviceType;
  isSoftwareWalletOnlyUser: boolean;
  features?: Features;
  hardwareTransportType: EHardwareTransportType | undefined | 'QRCode';
}) => {
  const connectionType: IHardwareCommunicationType =
    getHardwareCommunicationTypeString(hardwareTransportType);

  const firmwareVersions = features
    ? await deviceUtils.getDeviceVersion({
        device: undefined,
        features,
      })
    : undefined;

  defaultLogger.account.wallet.walletAdded({
    status,
    addMethod: 'ConnectHWWallet',
    details: {
      hardwareWalletType: 'Standard',
      communication: connectionType,
      deviceType,
      ...(firmwareVersions && { firmwareVersions }),
    },
    isSoftwareWalletOnlyUser,
  });
};

type IConnectYourDeviceItem = {
  title: string;
  src: ImageSourcePropType;
  onPress: () => void | Promise<void>;
  opacity?: number;
  device: SearchDevice | undefined;
};

function DeviceListItem({ item }: { item: IConnectYourDeviceItem }) {
  const [isLoading, setIsLoading] = useState(false);

  const onPress = useCallback(async () => {
    if (isLoading) return;
    try {
      setIsLoading(true);
      await item.onPress();
    } finally {
      setIsLoading(false);
    }
  }, [item, isLoading]);

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
      onPress={onPress}
    />
  );
}

function ConnectByQrCode() {
  const { createQrWallet } = useCreateQrWallet();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
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
            defaultLogger.account.wallet.addWalletStarted({
              addMethod: 'ConnectHWWallet',
              details: {
                hardwareWalletType: 'Standard',
                communication: 'QRCode',
              },
              isSoftwareWalletOnlyUser,
            });
            await createQrWallet({
              isOnboarding: true,
              onFinalizeWalletSetupError: () => {
                // only pop when finalizeWalletSetup pushed
                navigation.pop();
              },
            });

            void trackHardwareWalletConnection({
              status: 'success',
              deviceType: EDeviceType.Pro,
              isSoftwareWalletOnlyUser,
              hardwareTransportType: 'QRCode',
            });
          } catch (error) {
            // Clear force transport type on QR wallet creation error
            void backgroundApiProxy.serviceHardware.clearForceTransportType();
            errorToastUtils.toastIfError(error);
            void trackHardwareWalletConnection({
              status: 'failure',
              deviceType: EDeviceType.Pro,
              isSoftwareWalletOnlyUser,
              hardwareTransportType: 'QRCode',
            });
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
function BridgeNotInstalledDialogContent(_props: { error: NeedOneKeyBridge }) {
  return (
    <Stack>
      <HyperlinkText
        size="$bodyLg"
        mt="$1.5"
        translationId={
          platformEnv.isSupportWebUSB
            ? ETranslations.device_communication_failed
            : ETranslations.onboarding_install_onekey_bridge_help_text
        }
      />
    </Stack>
  );
}

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}

// Common device connection logic
interface IDeviceConnectionProps {
  tabValue: EConnectDeviceChannel;
  onDeviceConnect: (device: SearchDevice) => Promise<void>;
}

// Common device list and connection logic
function useDeviceConnection({
  tabValue,
  onDeviceConnect,
}: IDeviceConnectionProps) {
  const intl = useIntl();
  const [connectStatus, setConnectStatus] = useState(EConnectionStatus.init);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);
  const [isCheckingDeviceLoading, setIsChecking] = useState(false);

  const searchStateRef = useRef<'start' | 'stop'>('stop');
  const isSearchingRef = useRef(false);
  const currentTabValueRef = useRef(tabValue);

  const deviceScanner = useMemo(
    () =>
      deviceUtils.getDeviceScanner({
        backgroundApi: backgroundApiProxy,
      }),
    [],
  );

  // Handle tabValue changes - clear search results and stop scanning
  useEffect(() => {
    const previousTabValue = currentTabValueRef.current;

    if (previousTabValue !== tabValue) {
      console.log(
        '🔍 Tab changed from',
        previousTabValue,
        'to',
        tabValue,
        '- clearing search state',
      );

      // Stop current scanning
      if (isSearchingRef.current) {
        isSearchingRef.current = false;
        deviceScanner.stopScan();
      }

      // Clear search results and reset state
      setSearchedDevices([]);
      setConnectStatus(EConnectionStatus.init);

      // Wait for any ongoing search to complete (don't block render)
      deviceScanner
        .waitForCurrentSearchToComplete()
        .then(() => {
          console.log('🔍 Previous search completed, results ignored');
        })
        .catch(() => {
          // Ignore errors
        });
    }

    currentTabValueRef.current = tabValue;
  }, [tabValue, deviceScanner]);

  const scanDevice = useCallback(async () => {
    if (isSearchingRef.current) {
      return;
    }

    // Set global transport type based on tab value before scanning
    const forceTransportType = await getForceTransportType(tabValue);
    if (forceTransportType) {
      await backgroundApiProxy.serviceHardware.setForceTransportType({
        forceTransportType,
      });
    }

    isSearchingRef.current = true;
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
              message: error.message || 'DeviceScanError',
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
              message: error.message || 'DeviceScanError',
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
              message: error.message || 'DeviceScanError',
            });
            deviceScanner.stopScan();
          }

          if (error instanceof NeedOneKeyBridge) {
            Dialog.confirm({
              icon: 'OnekeyBrand',
              title: intl.formatMessage({
                id: ETranslations.onboarding_install_onekey_bridge,
              }),
              renderContent: <BridgeNotInstalledDialogContent error={error} />,
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_download_and_install,
              }),
              onConfirm: () => Linking.openURL(HARDWARE_BRIDGE_DOWNLOAD_URL),
            });

            deviceScanner.stopScan();
          }
          return;
        }

        const sortedDevices = response.payload.sort((a, b) =>
          natsort({ insensitive: true })(
            a.name || a.connectId || a.deviceId || a.uuid,
            b.name || b.connectId || b.deviceId || b.uuid,
          ),
        );

        // Only set search results if tabValue hasn't changed
        if (currentTabValueRef.current === tabValue) {
          if (tabValue === EConnectDeviceChannel.bluetooth) {
            const isUsbData = sortedDevices.some((device) =>
              // @ts-expect-error
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              isString(device.features?.device_id),
            );
            if (isUsbData) {
              setSearchedDevices([]);
              return;
            }
          }
          setSearchedDevices(sortedDevices);
        } else {
          console.log('🔍 Ignoring search results - tab changed during search');
        }
      },
      (state) => {
        searchStateRef.current = state;
      },
      undefined, // pollIntervalRate
      undefined, // pollInterval
      undefined, // maxTryCount
    );
  }, [deviceScanner, intl, tabValue]);

  const stopScan = useCallback(() => {
    isSearchingRef.current = false;
    deviceScanner.stopScan();
  }, [deviceScanner]);

  const ensureStopScan = useCallback(async () => {
    // Force stop scanning and wait for any ongoing search to complete
    console.log(
      'ensureStopScan: Stopping device scan and waiting for completion',
    );
    isSearchingRef.current = false;

    try {
      // Use the new stopScanAndWait method that properly waits for ongoing searches
      await deviceScanner.stopScanAndWait();
      console.log(
        'ensureStopScan: Device scan stopped and all ongoing searches completed',
      );
    } catch (error) {
      console.error('ensureStopScan: Error while stopping scan:', error);
      // Fallback: just stop scan without waiting
      deviceScanner.stopScan();
    }
  }, [deviceScanner]);

  const devicesData = useMemo<IConnectYourDeviceItem[]>(
    () => [
      ...searchedDevices.map((item) => ({
        title: item.name,
        src: HwWalletAvatarImages[getDeviceAvatarImage(item.deviceType)],
        device: item,
        onPress: async () => {
          // Ensure device scanning is completely stopped before connecting
          await ensureStopScan();
          await onDeviceConnect(item);
        },
        opacity: 1,
      })),
    ],
    [searchedDevices, onDeviceConnect, ensureStopScan],
  );

  return {
    connectStatus,
    setConnectStatus,
    searchedDevices,
    devicesData,
    isCheckingDeviceLoading,
    setIsChecking,
    scanDevice,
    stopScan,
    ensureStopScan,
    deviceScanner,
  };
}

function AnimationView({
  lottieSource,
  connectStatus,
  connectionType,
}: {
  lottieSource: ILottieViewProps['source'];
  connectStatus: EConnectionStatus;
  connectionType: 'usb' | 'bluetooth';
}) {
  const intl = useIntl();
  const [showHelper, setShowHelper] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

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

  return (
    <Stack bg="$bgSubdued">
      {!showTroubleshooting && lottieSource ? (
        <LottieView width="100%" height="$56" source={lottieSource} />
      ) : (
        <ConnectionTroubleShootingAccordion connectionType={connectionType} />
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
  );
}

function DeviceListView({
  title,
  description,
  devicesData,
}: {
  title?: string;
  description?: string;
  devicesData: IConnectYourDeviceItem[];
}) {
  const intl = useIntl();

  return (
    <ScrollView flex={1}>
      <YStack gap="$1" py="$2.5" px="$5">
        {title ? (
          <SizableText size="$headingMd" textAlign="center">
            {title}
          </SizableText>
        ) : (
          <SizableText size="$headingMd" textAlign="center">
            {`${intl.formatMessage({
              id: ETranslations.onboarding_bluetooth_connect_help_text,
            })}...`}
          </SizableText>
        )}

        <SizableText size="$bodyMd" textAlign="center" color="$textSubdued">
          {description}
        </SizableText>
      </YStack>
      {devicesData.map((item) => (
        <DeviceListItem
          item={item}
          key={item.device?.connectId ?? item.title}
        />
      ))}
    </ScrollView>
  );
}

function ConnectByUSBOrBLE({
  tabValue,
  onDeviceConnect,
}: {
  tabValue: EConnectDeviceChannel;
  onDeviceConnect: (device: SearchDevice) => Promise<void>;
}) {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();

  // Use the shared device connection logic
  const deviceConnection = useDeviceConnection({
    tabValue,
    onDeviceConnect,
  });

  const {
    connectStatus,
    setConnectStatus,
    devicesData,
    isCheckingDeviceLoading,
    setIsChecking,
    scanDevice,
    stopScan,
  } = deviceConnection;

  // USB/BLE specific logic only
  const checkBLEState = useCallback(async () => {
    const checkState = await bleManagerInstance.checkState();
    return checkState === 'on';
  }, []);

  const listingDevice = useCallback(async () => {
    setConnectStatus(EConnectionStatus.listing);
    await scanDevice();
  }, [scanDevice, setConnectStatus]);

  useEffect(() => {
    if (isFocused) {
      if (connectStatus === EConnectionStatus.listing) {
        void listingDevice();
      }
    } else if (!isFocused) {
      stopScan();
    }
  }, [connectStatus, isFocused, listingDevice, stopScan]);

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
    void listingDevice();
  }, [
    OpenBleSettingsDialogRender,
    RequireBlePermissionDialogRender,
    checkBLEState,
    listingDevice,
    setIsChecking,
  ]);

  // web-usb connect
  const { promptWebUsbDeviceAccess } = usePromptWebDeviceAccess();
  const onConnectWebDevice = useCallback(async () => {
    setIsChecking(true);
    try {
      // Set global transport type before device access
      const targetTransportType = await getForceTransportType(tabValue);
      if (targetTransportType) {
        await backgroundApiProxy.serviceHardware.setForceTransportType({
          forceTransportType: targetTransportType,
        });
      }

      const device = await promptWebUsbDeviceAccess();
      if (device?.serialNumber) {
        const connectedDevice =
          await backgroundApiProxy.serviceHardware.promptWebDeviceAccess({
            deviceSerialNumberFromUI: device.serialNumber,
          });
        if (connectedDevice.device) {
          void onDeviceConnect(connectedDevice.device as SearchDevice);
        }
      }
    } catch (error) {
      console.error('onConnectWebDevice error:', error);
      setIsChecking(false);
    }
  }, [onDeviceConnect, promptWebUsbDeviceAccess, tabValue, setIsChecking]);

  useEffect(() => {
    if (
      platformEnv.isNative ||
      hardwareTransportType === EHardwareTransportType.WEBUSB
    ) {
      return;
    }
    void (async () => {
      void listingDevice();
    })();
  }, [listingDevice, hardwareTransportType, tabValue]);

  useEffect(
    () =>
      // unmount page stop scan
      () => {
        stopScan();
      },
    [stopScan],
  );

  return (
    <>
      <AnimationView
        lottieSource={
          platformEnv.isNative ? ConnectByBluetoothAnim : ConnectByUSBAnim
        }
        connectStatus={connectStatus}
        connectionType={platformEnv.isNative ? 'bluetooth' : 'usb'}
      />

      {connectStatus === EConnectionStatus.init ? (
        <YStack pt="$8">
          <Heading size="$headingMd" textAlign="center">
            {intl.formatMessage({
              id:
                hardwareTransportType === EHardwareTransportType.WEBUSB
                  ? ETranslations.device_connect_via_usb
                  : ETranslations.onboarding_bluetooth_prepare_to_connect,
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
              id:
                hardwareTransportType === EHardwareTransportType.WEBUSB
                  ? ETranslations.device_select_device_popup
                  : ETranslations.onboarding_bluetooth_prepare_to_connect_help_text,
            })}
          </SizableText>
          <Button
            mx="auto"
            size="large"
            variant="primary"
            loading={isCheckingDeviceLoading}
            onPress={
              hardwareTransportType === EHardwareTransportType.WEBUSB
                ? onConnectWebDevice
                : startBLEConnection
            }
          >
            {intl.formatMessage({ id: ETranslations.global_start_connection })}
          </Button>
        </YStack>
      ) : null}

      {connectStatus === EConnectionStatus.listing ? (
        <DeviceListView devicesData={devicesData} />
      ) : null}
    </>
  );
}

function ConnectByBluetooth({
  onDeviceConnect,
}: {
  onDeviceConnect: (device: SearchDevice) => Promise<void>;
}) {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const [bluetoothStatus, setBluetoothStatus] = useState<
    | 'enabled'
    | 'disabledInSystem'
    | 'disabledInApp'
    | 'checking'
    | 'noSystemPermission'
  >('checking');

  const nobleInitializedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkBluetoothStatus = useCallback(async () => {
    try {
      // Ensure Noble is initialized before checking status
      if (!nobleInitializedRef.current) {
        try {
          console.log(
            'onboarding checkBluetoothStatus: noble pre-initialization',
          );
          await globalThis?.desktopApi?.nobleBle?.checkAvailability();
        } catch (error) {
          console.log(
            'Noble pre-initialization completed with expected error:',
            error,
          );
        }
        nobleInitializedRef.current = true;
      }

      // Desktop platform: check desktop bluetooth availability
      const enableDesktopBluetoothInApp =
        await backgroundApiProxy.serviceSetting.getEnableDesktopBluetooth();
      if (!enableDesktopBluetoothInApp) {
        console.log('onboarding checkBluetoothStatus: disabledInApp');
        setBluetoothStatus('disabledInApp');
        return;
      }

      const available =
        await globalThis?.desktopApi?.nobleBle?.checkAvailability();
      if (available.state === 'unknown') {
        return;
      }
      if (available.state === 'unauthorized') {
        console.log('onboarding checkBluetoothStatus: noSystemPermission');
        setBluetoothStatus('noSystemPermission');
        return;
      }
      if (!available?.available) {
        console.log('onboarding checkBluetoothStatus: disabledInSystem');
        setBluetoothStatus('disabledInSystem');
        return;
      }

      console.log('onboarding checkBluetoothStatus: enabled');
      await backgroundApiProxy.serviceSetting.setDesktopBluetoothAtom({
        isRequestedPermission: true,
      });
      // All checks passed
      setBluetoothStatus('enabled');
    } catch (error) {
      console.error('Desktop bluetooth check failed:', error);
      setBluetoothStatus('disabledInSystem');
    }
  }, []);

  const startBluetoothStatusPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    pollingTimerRef.current = setInterval(() => {
      // Don't poll if connecting to a device
      if (!isConnectingRef.current) {
        void checkBluetoothStatus();
      }
    }, 1500);
  }, [checkBluetoothStatus]);

  const stopBluetoothStatusPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Enhanced device connection wrapper for Bluetooth
  const handleBluetoothDeviceConnect = useCallback(
    async (device: SearchDevice) => {
      // Immediately stop bluetooth polling and scanning when connecting
      isConnectingRef.current = true;
      stopBluetoothStatusPolling();

      try {
        await onDeviceConnect(device);
      } catch (error) {
        // Resume polling on error only if still focused
        if (isFocused) {
          startBluetoothStatusPolling();
        }
        throw error;
      } finally {
        isConnectingRef.current = false;
      }
    },
    [
      onDeviceConnect,
      stopBluetoothStatusPolling,
      startBluetoothStatusPolling,
      isFocused,
    ],
  );

  // Use shared device connection logic for Bluetooth
  const deviceConnection = useDeviceConnection({
    tabValue: EConnectDeviceChannel.bluetooth,
    onDeviceConnect: handleBluetoothDeviceConnect,
  });

  const { devicesData, scanDevice, stopScan } = deviceConnection;

  const handleOpenPrivacySettings = useCallback(() => {
    void globalThis.desktopApiProxy.bluetooth.openPrivacySettings();
  }, []);

  const handleAppEnableDesktopBluetooth = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceSetting.setEnableDesktopBluetooth(true);
      // Re-check bluetooth status after enabling
      void checkBluetoothStatus();
    } catch (error) {
      console.error('Failed to enable desktop bluetooth:', error);
    }
  }, [checkBluetoothStatus]);

  const handleOpenBleSettings = useCallback(() => {
    void globalThis.desktopApiProxy.bluetooth.openBluetoothSettings();
  }, []);

  // Check bluetooth status on mount and when focused, start polling
  useEffect(() => {
    if (isFocused) {
      void checkBluetoothStatus();
      startBluetoothStatusPolling();
    } else {
      stopBluetoothStatusPolling();
    }

    return () => {
      stopBluetoothStatusPolling();
    };
  }, [
    checkBluetoothStatus,
    isFocused,
    startBluetoothStatusPolling,
    stopBluetoothStatusPolling,
  ]);

  // Start scanning when bluetooth is enabled and focused
  useEffect(() => {
    if (isFocused && bluetoothStatus === 'enabled') {
      void scanDevice();
    } else if (!isFocused) {
      stopScan();
    }
  }, [bluetoothStatus, isFocused, scanDevice, stopScan]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      stopScan();
      stopBluetoothStatusPolling();
    },
    [stopScan, stopBluetoothStatusPolling],
  );

  if (bluetoothStatus === 'disabledInApp') {
    return (
      <Empty
        flex={1}
        icon="BluetoothOutline"
        title={intl.formatMessage({ id: ETranslations.bluetooth_disabled })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_enable_in_app_settings,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.onboarding_enable_bluetooth,
          }),
          onPress: handleAppEnableDesktopBluetooth,
        }}
      />
    );
  }

  if (bluetoothStatus === 'noSystemPermission') {
    return (
      <Empty
        flex={1}
        icon="BluetoothOutline"
        title={intl.formatMessage({
          id: ETranslations.onboarding_bluetooth_permission_needed,
        })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_permission_prompt,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.global_go_to_settings,
          }),
          onPress: handleOpenPrivacySettings,
        }}
      />
    );
  }

  if (bluetoothStatus === 'disabledInSystem') {
    return (
      <Empty
        flex={1}
        icon="BluetoothOutline"
        title={intl.formatMessage({ id: ETranslations.bluetooth_disabled })}
        description={intl.formatMessage({
          id: ETranslations.bluetooth_enable_in_system_settings,
        })}
        buttonProps={{
          variant: 'primary',
          children: intl.formatMessage({
            id: ETranslations.onboarding_enable_bluetooth,
          }),
          onPress: handleOpenBleSettings,
        }}
      />
    );
  }

  return (
    <>
      <AnimationView
        lottieSource={BluetoothSignalSpreading}
        connectStatus={EConnectionStatus.listing}
        connectionType="bluetooth"
      />
      <DeviceListView
        description={intl.formatMessage({
          id: ETranslations.bluetooth_keep_near,
        })}
        devicesData={devicesData}
      />
    </>
  );
}

export function ConnectYourDevicePage() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IOnboardingParamList, EOnboardingPages.ConnectYourDevice>
    >();
  const { channel } = route?.params ?? {};

  const [tabValue, setTabValue] = useState<EConnectDeviceChannel>(
    channel ?? EConnectDeviceChannel.usbOrBle,
  );

  const { headerRight } = useBuyOneKeyHeaderRightButton();

  // Shared connection logic - extract from ConnectByUSBOrBLE
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog();
  const { showSelectAddWalletTypeDialog } = useSelectAddWalletTypeDialog();
  const fwUpdateActions = useFirmwareUpdateActions();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();
  const [isCheckingDeviceLoading, setIsChecking] = useState(false);

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
      });
    } catch (error: any) {
      if (error instanceof OneKeyHardwareError) {
        const { code, message } = error;
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

  const extractDeviceState = useCallback(
    (features: IOneKeyDeviceFeatures) => ({
      unlockedAttachPin: features.unlocked_attach_pin,
      unlocked: features.unlocked,
      passphraseEnabled: Boolean(features.passphrase_protection),
      deviceId: features.device_id,
    }),
    [],
  );

  const closeDialogAndReturn = useCallback(
    async (device: SearchDevice, options: { skipDelayClose?: boolean }) => {
      setIsChecking(false);
      void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: device.connectId ?? '',
        hardClose: true,
        skipDelayClose: options.skipDelayClose,
      });
    },
    [],
  );

  type IWalletCreationStrategy = {
    createHiddenWalletOnly: boolean;
    createStandardWalletOnly: boolean;
  };

  const determineWalletCreationStrategy = useCallback(
    async (
      deviceState: ReturnType<typeof extractDeviceState>,
      device: SearchDevice,
    ): Promise<IWalletCreationStrategy | null> => {
      if (!deviceState.unlocked) {
        return {
          createHiddenWalletOnly: false,
          createStandardWalletOnly: true,
        };
      }

      if (deviceState.unlockedAttachPin) {
        return {
          createHiddenWalletOnly: deviceState.passphraseEnabled,
          createStandardWalletOnly: !deviceState.passphraseEnabled,
        };
      }

      const existsStandardWallet =
        await backgroundApiProxy.serviceAccount.existsHwStandardWallet({
          connectId: device.connectId ?? '',
          deviceId: deviceState.deviceId ?? '',
        });

      if (existsStandardWallet) {
        return {
          createHiddenWalletOnly: deviceState.passphraseEnabled,
          createStandardWalletOnly: !deviceState.passphraseEnabled,
        };
      }

      if (!deviceState.passphraseEnabled) {
        return {
          createHiddenWalletOnly: false,
          createStandardWalletOnly: true,
        };
      }

      const walletType = await showSelectAddWalletTypeDialog();
      if (walletType === 'Standard') {
        return {
          createHiddenWalletOnly: false,
          createStandardWalletOnly: true,
        };
      }
      if (walletType === 'Hidden') {
        return {
          createHiddenWalletOnly: true,
          createStandardWalletOnly: false,
        };
      }

      return null;
    },
    [showSelectAddWalletTypeDialog],
  );

  const createHwWallet = useCallback(
    async (
      device: SearchDevice,
      strategy: IWalletCreationStrategy,
      features: IOneKeyDeviceFeatures,
      isFirmwareVerified?: boolean,
      deviceState?: ReturnType<typeof extractDeviceState>,
    ) => {
      try {
        navigation.push(EOnboardingPages.FinalizeWalletSetup);

        const params: IDBCreateHwWalletParamsBase = {
          device,
          hideCheckingDeviceLoading: true,
          features,
          isFirmwareVerified,
          defaultIsTemp: true,
          isAttachPinMode: deviceState?.unlockedAttachPin,
        };
        if (strategy.createStandardWalletOnly) {
          await actions.current.createHWWalletWithoutHidden(params);
        } else {
          await actions.current.createHWWalletWithHidden(params);
        }

        await trackHardwareWalletConnection({
          status: 'success',
          deviceType: device.deviceType,
          features,
          hardwareTransportType,
          isSoftwareWalletOnlyUser,
        });

        await actions.current.updateHwWalletsDeprecatedStatus({
          connectId: device.connectId ?? '',
          deviceId: features.device_id || device.deviceId || '',
        });
      } catch (error) {
        errorToastUtils.toastIfError(error);
        navigation.pop();
        await trackHardwareWalletConnection({
          status: 'failure',
          deviceType: device.deviceType,
          features,
          hardwareTransportType,
          isSoftwareWalletOnlyUser,
        });
        throw error;
      } finally {
        await closeDialogAndReturn(device, { skipDelayClose: false });
      }
    },
    [
      actions,
      closeDialogAndReturn,
      hardwareTransportType,
      isSoftwareWalletOnlyUser,
      navigation,
    ],
  );

  const selectAddWalletType = useCallback(
    async ({
      device,
      isFirmwareVerified,
    }: {
      device: SearchDevice;
      features: IOneKeyDeviceFeatures;
      isFirmwareVerified?: boolean;
    }) => {
      setIsChecking(true);

      void backgroundApiProxy.serviceHardwareUI.showDeviceProcessLoadingDialog({
        connectId: device.connectId ?? '',
      });

      let features: IOneKeyDeviceFeatures | undefined;

      try {
        features =
          await backgroundApiProxy.serviceHardware.getFeaturesWithUnlock({
            connectId: device.connectId ?? '',
          });
      } catch (error) {
        await closeDialogAndReturn(device, { skipDelayClose: true });
        return;
      }

      const deviceState = extractDeviceState(features);
      const strategy = await determineWalletCreationStrategy(
        deviceState,
        device,
      );

      console.log('Current hardware wallet State', deviceState, strategy);
      if (!strategy) {
        await closeDialogAndReturn(device, { skipDelayClose: true });
        return;
      }

      await createHwWallet(
        device,
        strategy,
        features,
        isFirmwareVerified,
        deviceState,
      );
    },
    [
      extractDeviceState,
      determineWalletCreationStrategy,
      createHwWallet,
      closeDialogAndReturn,
    ],
  );

  // Shared device connection handler
  const handleDeviceConnect = useCallback(
    async (device: SearchDevice) => {
      // Ensure all scanning and polling activities are stopped before connecting
      console.log('handleDeviceConnect: Starting device connection process');

      defaultLogger.account.wallet.addWalletStarted({
        addMethod: 'ConnectHWWallet',
        details: {
          hardwareWalletType: 'Standard',
          communication: getHardwareCommunicationTypeString(
            hardwareTransportType,
          ),
        },
        isSoftwareWalletOnlyUser,
      });

      if (device.deviceType === 'unknown') {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.hardware_connect_unknown_device_error,
          }),
        });
        return;
      }

      try {
        void backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog({
          connectId: device.connectId ?? '',
        });

        const handleBootloaderMode = (existsFirmware: boolean) => {
          fwUpdateActions.showBootloaderMode({
            connectId: device.connectId ?? undefined,
            existsFirmware,
          });
          console.log('Device is in bootloader mode', device);
          throw new OneKeyLocalError('Device is in bootloader mode');
        };

        if (
          await deviceUtils.isBootloaderModeFromSearchDevice({
            device: device as any,
          })
        ) {
          const existsFirmware =
            await deviceUtils.existsFirmwareFromSearchDevice({
              device: device as any,
            });
          handleBootloaderMode(existsFirmware);
          return;
        }

        // Set global transport type based on selected channel before connecting
        let forceTransportType: EHardwareTransportType | undefined;
        if (tabValue === EConnectDeviceChannel.bluetooth) {
          forceTransportType = EHardwareTransportType.DesktopWebBle;
        } else {
          forceTransportType = await getForceTransportType(tabValue);
        }
        if (forceTransportType) {
          await backgroundApiProxy.serviceHardware.setForceTransportType({
            forceTransportType,
          });
        }

        const features = await connectDevice(device);

        if (!features) {
          await trackHardwareWalletConnection({
            status: 'failure',
            isSoftwareWalletOnlyUser,
            deviceType: device.deviceType,
            features,
            hardwareTransportType: forceTransportType || hardwareTransportType,
          });
          throw new OneKeyHardwareError(
            'connect device failed, no features returned',
          );
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

        if (deviceMode === EOneKeyDeviceMode.backupMode) {
          await trackHardwareWalletConnection({
            status: 'failure',
            deviceType,
            isSoftwareWalletOnlyUser,
            features,
            hardwareTransportType: forceTransportType || hardwareTransportType,
          });
          Toast.error({
            title: 'Device is in backup mode',
          });
          return;
        }

        const shouldAuthenticateFirmware =
          await backgroundApiProxy.serviceHardware.shouldAuthenticateFirmware({
            device: {
              ...device,
              deviceId: device.deviceId || features.device_id,
            },
          });

        if (shouldAuthenticateFirmware) {
          void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
            connectId: device.connectId ?? '',
            hardClose: false,
            skipDelayClose: true,
            deviceResetToHome: false,
          });
          await showFirmwareVerifyDialog({
            device,
            features,
            onContinue: async ({ checked }: { checked: boolean }) => {
              setIsChecking(false);
              if (deviceMode === EOneKeyDeviceMode.notInitialized) {
                handleNotActivatedDevicePress({ deviceType });
                return;
              }

              await selectAddWalletType({
                device,
                isFirmwareVerified: checked,
                features,
              });
            },
            onClose: () => {
              setIsChecking(false);
            },
          });
          return;
        }

        if (deviceMode === EOneKeyDeviceMode.notInitialized) {
          handleNotActivatedDevicePress({ deviceType });
          return;
        }

        await selectAddWalletType({ device, features });
      } catch (error) {
        // Clear force transport type on device connection error
        void backgroundApiProxy.serviceHardware.clearForceTransportType();
        void backgroundApiProxy.serviceHardwareUI.cleanHardwareUiState();
        console.error('handleDeviceConnect error:', error);
        throw error;
      }
    },
    [
      tabValue,
      hardwareTransportType,
      isSoftwareWalletOnlyUser,
      intl,
      fwUpdateActions,
      connectDevice,
      showFirmwareVerifyDialog,
      handleNotActivatedDevicePress,
      selectAddWalletType,
    ],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.onboarding_connect_your_device,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <Stack px="$5" pt="$2" pb="$4">
          <SegmentControl
            fullWidth
            value={tabValue}
            onChange={(v) => {
              console.log('🔍 Tab selected:', v);
              setTabValue(v as any);
            }}
            options={[
              {
                label: platformEnv.isNative
                  ? intl.formatMessage({ id: ETranslations.global_bluetooth })
                  : 'USB',
                value: EConnectDeviceChannel.usbOrBle,
              },
              ...(platformEnv.isSupportDesktopBle
                ? [
                    {
                      label: intl.formatMessage({
                        id: ETranslations.global_bluetooth,
                      }),
                      value: EConnectDeviceChannel.bluetooth,
                    },
                  ]
                : []),
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
            tabValue={tabValue}
            onDeviceConnect={handleDeviceConnect}
          />
        ) : null}

        {tabValue === EConnectDeviceChannel.bluetooth &&
        platformEnv.isSupportDesktopBle ? (
          <ConnectByBluetooth onDeviceConnect={handleDeviceConnect} />
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
