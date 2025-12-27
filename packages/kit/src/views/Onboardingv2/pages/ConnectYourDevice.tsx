import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIsFocused } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { get, isString } from 'lodash';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import type { IPageScreenProps, IYStackProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  EVideoResizeMode,
  Empty,
  HeightTransition,
  IconButton,
  Image,
  LottieView,
  Page,
  Popover,
  SegmentControl,
  SizableText,
  Stack,
  Toast,
  Video,
  XStack,
  YStack,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HARDWARE_BRIDGE_DOWNLOAD_URL,
  HARDWARE_TROUBLESHOOTING_URL,
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
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import bleManagerInstance from '@onekeyhq/shared/src/hardware/bleManager';
import { checkBLEPermissions } from '@onekeyhq/shared/src/hardware/blePermissions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import {
  HwWalletAvatarImages,
  getDeviceAvatarImage,
} from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EAccountSelectorSceneName,
  EHardwareTransportType,
} from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import {
  OpenBleSettingsDialog,
  RequireBlePermissionDialog,
} from '../../../components/Hardware/HardwareDialog';
import { HyperlinkText } from '../../../components/HyperlinkText';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { OnboardingLayout } from '../components/OnboardingLayout';
import {
  EBluetoothStatus,
  useDesktopBluetoothStatusPolling,
} from '../hooks/useDeviceConnect';
import {
  getDeviceLabel,
  getForceTransportType,
  sortDevicesData,
} from '../utils';

import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';
import type { ReactVideoSource } from 'react-native-video';

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}

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

interface IDeviceConnectionProps {
  tabValue: EConnectDeviceChannel;
  deviceTypeItems: EDeviceType[];
  connectDevice: (
    item: IConnectYourDeviceItem,
    innerTabValue: EConnectDeviceChannel,
  ) => Promise<void> | void;
}

// Common device list and connection logic
function useDeviceConnection({
  tabValue,
  onDeviceSelect,
}: {
  tabValue: EConnectDeviceChannel;
  onDeviceSelect?: (item: IConnectYourDeviceItem) => Promise<void> | void;
}) {
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
    () =>
      searchedDevices.map((item: SearchDevice) => ({
        title: item.name,
        src: HwWalletAvatarImages[getDeviceAvatarImage(item.deviceType)],
        device: item,
      })),
    [searchedDevices],
  );

  const handleDeviceSelect = useCallback(
    async (item: IConnectYourDeviceItem) => {
      if (!item.device) {
        return;
      }
      void ensureStopScan();
      if (onDeviceSelect) {
        await onDeviceSelect(item);
      }
    },
    [ensureStopScan, onDeviceSelect],
  );

  return useMemo(
    () => ({
      connectStatus,
      setConnectStatus,
      searchedDevices,
      devicesData,
      isCheckingDeviceLoading,
      setIsChecking,
      scanDevice,
      stopScan,
      ensureStopScan,
      handleDeviceSelect,
    }),
    [
      connectStatus,
      setConnectStatus,
      searchedDevices,
      devicesData,
      isCheckingDeviceLoading,
      setIsChecking,
      scanDevice,
      stopScan,
      ensureStopScan,
      handleDeviceSelect,
    ],
  );
}

function ConnectionIndicatorCard({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      borderRadius={10}
      borderCurve="continuous"
      $platform-web={{
        boxShadow: '0 1px 1px 0 rgba(0, 0, 0, 0.20)',
      }}
      // $platform-android={{ elevation: 0.1 }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
      bg="$bg"
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorAnimation({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <YStack
      h={320}
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorContent({
  children,
  ...rest
}: {
  children: React.ReactNode;
} & IYStackProps) {
  return (
    <YStack
      px="$5"
      py="$4"
      borderWidth={0}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      $platform-web={{
        borderStyle: 'dashed',
      }}
      {...rest}
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorTitle({ children }: { children: React.ReactNode }) {
  return <SizableText size="$bodyMdMedium">{children}</SizableText>;
}

function connectionIndicatorFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <YStack
      pt="$5"
      pb="$2"
      gap="$2"
      animation="quick"
      animateOnly={['opacity']}
      enterStyle={{
        opacity: 0,
      }}
    >
      {children}
    </YStack>
  );
}

function TroubleShootingButton({ type }: { type: 'usb' | 'bluetooth' }) {
  const [showHelper, setShowHelper] = useState(false);
  const intl = useIntl();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHelper(true);
    }, 10_000);

    return () => clearTimeout(timer);
  }, [showHelper]);

  return (
    <>
      {showHelper ? (
        <YStack
          bg="$bgSubdued"
          $platform-web={{
            boxShadow:
              '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
          }}
          $theme-dark={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$neutral3',
            bg: '$neutral3',
          }}
          $platform-native={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: '$neutral3',
          }}
          borderRadius="$2.5"
          borderCurve="continuous"
          overflow="hidden"
          p="$4"
          gap="$4"
        >
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="left">
            {intl.formatMessage({
              id: ETranslations.troubleshooting_show_helper_cta_label,
            })}
          </SizableText>
          <XStack gap="$2" flexWrap="wrap">
            <Button
              flex={1}
              minWidth="$40"
              icon="OpenOutline"
              onPress={() => {
                void Linking.openURL(HARDWARE_TROUBLESHOOTING_URL);
              }}
            >
              {intl.formatMessage({ id: ETranslations.self_troubleshooting })}
            </Button>
            <Button
              flex={1}
              minWidth="$40"
              icon="HelpSupportOutline"
              onPress={() => {
                void showIntercom();
              }}
            >
              {intl.formatMessage({ id: ETranslations.settings_contact_us })}
            </Button>
          </XStack>
        </YStack>
      ) : null}
    </>
  );
}

function ConnectionIndicatorRoot({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
        bg: '$neutral4',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral4',
      }}
      overflow="hidden"
      borderRadius={10}
      borderCurve="continuous"
      bg="$bgSubdued"
      animation="quick"
      animateOnly={['opacity', 'transform']}
      enterStyle={{
        opacity: 0,
        x: 24,
      }}
    >
      {children}
    </YStack>
  );
}

export const ConnectionIndicator = Object.assign(ConnectionIndicatorRoot, {
  Animation: ConnectionIndicatorAnimation,
  Card: ConnectionIndicatorCard,
  Content: ConnectionIndicatorContent,
  Title: ConnectionIndicatorTitle,
  Footer: connectionIndicatorFooter,
});

function BluetoothCard({
  onConnect,
  connectStatus,
}: {
  onConnect?: () => Promise<void>;
  connectStatus?: EConnectionStatus;
}) {
  const intl = useIntl();
  return (
    <ConnectionIndicator.Card>
      <ConnectionIndicator.Animation>
        <YStack w="100%" h="100%" alignItems="center" justifyContent="center">
          <YStack
            position="absolute"
            w={420}
            h={420}
            left="50%"
            top="50%"
            transform={[{ translateX: '-50%' }, { translateY: '-50%' }]}
            p={60}
            flex={1}
            borderWidth={3}
            borderColor="$neutral1"
            borderRadius="$full"
          >
            <YStack
              p={50}
              flex={1}
              borderWidth={2}
              borderColor="$neutral2"
              borderRadius="$full"
            >
              <YStack
                flex={1}
                borderWidth={1}
                borderColor="$neutral3"
                borderRadius="$full"
              />
            </YStack>
          </YStack>
          <LottieView
            source={require('@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json')}
            width={320}
            height={320}
          />
        </YStack>
      </ConnectionIndicator.Animation>
      <ConnectionIndicator.Content>
        <ConnectionIndicator.Title>
          {platformEnv.isNative
            ? intl.formatMessage({
                id: ETranslations.onboarding_bluetooth_prepare_to_connect,
              })
            : intl.formatMessage({
                id: ETranslations.bluetooth_keep_near,
              })}
        </ConnectionIndicator.Title>
        {connectStatus === EConnectionStatus.init ? (
          <>
            <SizableText color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.device_select_device_popup,
              })}
            </SizableText>
            <Button variant="primary" mt="$2" onPress={onConnect}>
              {intl.formatMessage({
                id: ETranslations.global_start_connection,
              })}
            </Button>
          </>
        ) : null}
      </ConnectionIndicator.Content>
    </ConnectionIndicator.Card>
  );
}

function DeviceVideo({
  themeVariant,
  deviceTypeItems,
}: {
  themeVariant: 'light' | 'dark';
  deviceTypeItems: EDeviceType[];
}) {
  const isTouch = useMemo(() => {
    return deviceTypeItems.find(
      (deviceType) => deviceType === EDeviceType.Touch,
    );
  }, [deviceTypeItems]);

  const isClassic = useMemo(() => {
    return deviceTypeItems.find(
      (deviceType) =>
        deviceType === EDeviceType.Classic ||
        deviceType === EDeviceType.Classic1s ||
        deviceType === EDeviceType.ClassicPure,
    );
  }, [deviceTypeItems]);

  const isMini = useMemo(() => {
    return deviceTypeItems.find(
      (deviceType) => deviceType === EDeviceType.Mini,
    );
  }, [deviceTypeItems]);

  const videoSource = useMemo<ReactVideoSource>(() => {
    if (isMini) {
      return themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/onboarding/Mini-D.mp4') as ReactVideoSource)
        : (require('@onekeyhq/kit/assets/onboarding/Mini-L.mp4') as ReactVideoSource);
    }

    if (isClassic) {
      return themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/onboarding/Classic1S-D.mp4') as ReactVideoSource)
        : (require('@onekeyhq/kit/assets/onboarding/Classic1S-L.mp4') as ReactVideoSource);
    }

    if (isTouch) {
      return themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/onboarding/Touch-D.mp4') as ReactVideoSource)
        : (require('@onekeyhq/kit/assets/onboarding/Touch-L.mp4') as ReactVideoSource);
    }

    return themeVariant === 'dark'
      ? (require('@onekeyhq/kit/assets/onboarding/ProW-D.mp4') as ReactVideoSource)
      : (require('@onekeyhq/kit/assets/onboarding/ProW-L.mp4') as ReactVideoSource);
  }, [isClassic, isMini, isTouch, themeVariant]);

  return (
    <Video
      muted
      autoPlay
      w="100%"
      h="100%" // required for native
      controls={false}
      playInBackground={false}
      resizeMode={EVideoResizeMode.COVER}
      source={videoSource}
    />
  );
}

function USBOrBLEConnectionIndicator({
  tabValue,
  deviceTypeItems,
  connectDevice,
}: IDeviceConnectionProps) {
  const themeVariant = useThemeVariant();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();

  // Use the shared device connection logic
  const deviceConnection = useDeviceConnection({
    tabValue,
    onDeviceSelect: async (item) => connectDevice(item, tabValue),
  });

  const {
    connectStatus,
    setConnectStatus,
    devicesData,
    setIsChecking,
    scanDevice,
    stopScan,
    handleDeviceSelect,
  } = deviceConnection;

  const isBLE = useMemo(() => {
    return hardwareTransportType === EHardwareTransportType.BLE;
  }, [hardwareTransportType]);

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
          navigation.push(EOnboardingPagesV2.CheckAndUpdate, {
            deviceData: connectedDevice,
            tabValue,
          });
        }
      }
    } catch (error) {
      console.error('onConnectWebDevice error:', error);
      setIsChecking(false);
    }
  }, [setIsChecking, tabValue, promptWebUsbDeviceAccess, navigation]);

  useEffect(() => {
    if (
      hardwareTransportType === EHardwareTransportType.WEBUSB &&
      !platformEnv.isDesktop
    ) {
      return;
    }

    const timeoutId = setTimeout(
      () => {
        void (platformEnv.isNative ? startBLEConnection() : listingDevice());
      },
      platformEnv.isNative ? 120 : 0,
    );
    return () => clearTimeout(timeoutId);
  }, [listingDevice, hardwareTransportType, tabValue, startBLEConnection]);

  useEffect(
    () => () => {
      stopScan();
    },
    [stopScan],
  );

  const deviceLabel = useMemo(() => {
    return getDeviceLabel(deviceTypeItems);
  }, [deviceTypeItems]);

  const sortedDevicesData = useMemo(() => {
    return sortDevicesData(devicesData, deviceTypeItems);
  }, [deviceTypeItems, devicesData]);

  console.log('connectStatus', connectStatus);
  console.log('sortedDevicesData', sortedDevicesData);
  return (
    <>
      <ConnectionIndicator>
        {isBLE ? (
          <BluetoothCard
            onConnect={startBLEConnection}
            connectStatus={connectStatus}
          />
        ) : (
          <ConnectionIndicator.Card>
            <ConnectionIndicator.Animation>
              <DeviceVideo
                themeVariant={themeVariant}
                deviceTypeItems={deviceTypeItems}
              />
            </ConnectionIndicator.Animation>
            <ConnectionIndicator.Content gap="$2">
              <ConnectionIndicator.Title>
                {intl.formatMessage(
                  {
                    id: ETranslations.connect_device_to_computer_via_usb,
                  },
                  { deviceLabel },
                )}
              </ConnectionIndicator.Title>
              {connectStatus === EConnectionStatus.init ? (
                <>
                  <SizableText color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.device_select_device_popup,
                    })}
                  </SizableText>
                  <Button
                    variant="primary"
                    mt="$2"
                    onPress={onConnectWebDevice}
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_start_connection,
                    })}
                  </Button>
                </>
              ) : null}
            </ConnectionIndicator.Content>
          </ConnectionIndicator.Card>
        )}

        <ConnectionIndicator.Footer>
          <YStack px="$5">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText color="$textDisabled">
                {intl.formatMessage({
                  id: ETranslations.onboarding_bluetooth_connect_help_text,
                })}
                ...
              </SizableText>
            </XStack>
          </YStack>
          <HeightTransition initialHeight={0}>
            {sortedDevicesData.length > 0 ? (
              <>
                {sortedDevicesData.map((data) => (
                  <ListItem
                    key={data.device?.deviceId}
                    drillIn
                    onPress={async () => {
                      await handleDeviceSelect(data);
                    }}
                    userSelect="none"
                  >
                    <WalletAvatar
                      wallet={undefined}
                      img={data.device?.deviceType as IDeviceType}
                    />
                    <ListItem.Text primary={data.device?.name} flex={1} />
                  </ListItem>
                ))}
              </>
            ) : null}
          </HeightTransition>
        </ConnectionIndicator.Footer>
      </ConnectionIndicator>
      <TroubleShootingButton type="usb" />
    </>
  );
}

function BluetoothConnectionIndicator({
  deviceTypeItems,
  tabValue,
  connectDevice,
}: IDeviceConnectionProps) {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const [bluetoothStatus, setBluetoothStatus] = useState<EBluetoothStatus>(
    EBluetoothStatus.checking,
  );

  // Use shared device connection logic for Bluetooth
  const deviceConnection = useDeviceConnection({
    tabValue,
    onDeviceSelect: async (item) => connectDevice(item, tabValue),
  });

  const { devicesData, scanDevice, stopScan, handleDeviceSelect } =
    deviceConnection;

  const handleOpenPrivacySettings = useCallback(() => {
    void globalThis.desktopApiProxy.bluetooth.openPrivacySettings();
  }, []);

  const { checkBluetoothStatus, setIsConnecting: setBluetoothConnecting } =
    useDesktopBluetoothStatusPolling(tabValue, setBluetoothStatus);
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

  // Start scanning when bluetooth is enabled and focused
  useEffect(() => {
    if (isFocused && bluetoothStatus === EBluetoothStatus.enabled) {
      void scanDevice();
    } else if (!isFocused) {
      stopScan();
    }
  }, [bluetoothStatus, isFocused, scanDevice, stopScan]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      stopScan();
    },
    [stopScan],
  );

  const sortedDevicesData = useMemo(() => {
    return sortDevicesData(devicesData, deviceTypeItems);
  }, [deviceTypeItems, devicesData]);

  if (bluetoothStatus === EBluetoothStatus.disabledInApp) {
    return (
      <Empty
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

  if (bluetoothStatus === EBluetoothStatus.noSystemPermission) {
    return (
      <Empty
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

  if (bluetoothStatus === EBluetoothStatus.disabledInSystem) {
    return (
      <Empty
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
      <ConnectionIndicator>
        <BluetoothCard />
        <ConnectionIndicator.Footer>
          <YStack px="$5">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText color="$textDisabled">
                {intl.formatMessage({
                  id: ETranslations.onboarding_bluetooth_connect_help_text,
                })}
                ...
              </SizableText>
            </XStack>
          </YStack>
          <HeightTransition initialHeight={0}>
            {sortedDevicesData.length > 0 ? (
              <>
                {sortedDevicesData.map((device) => (
                  <ListItem
                    key={device.device?.connectId}
                    drillIn
                    onPress={async () => {
                      if (!device.device) {
                        return;
                      }
                      setBluetoothConnecting(true);
                      try {
                        await handleDeviceSelect(device);
                      } finally {
                        setBluetoothConnecting(false);
                      }
                    }}
                    userSelect="none"
                  >
                    <WalletAvatar
                      wallet={undefined}
                      img={device.device?.deviceType as IDeviceType}
                    />
                    <ListItem.Text primary={device.device?.name} flex={1} />
                  </ListItem>
                ))}
              </>
            ) : null}
          </HeightTransition>
        </ConnectionIndicator.Footer>
      </ConnectionIndicator>
      <TroubleShootingButton type="bluetooth" />
    </>
  );
}

function QRWalletConnect({
  navigateToCreateQRWallet,
}: {
  navigateToCreateQRWallet: () => Promise<void>;
}) {
  const { gtMd } = useMedia();
  const intl = useIntl();
  const { closePopover } = usePopoverContext();
  const handleCreateQRWallet = useCallback(async () => {
    await closePopover?.();
    await navigateToCreateQRWallet();
  }, [closePopover, navigateToCreateQRWallet]);

  return (
    <YStack
      p="$5"
      pt="$0"
      gap="$3"
      $gtMd={{
        p: '$3',
      }}
    >
      {gtMd ? (
        <SizableText size="$headingSm">
          {intl.formatMessage({
            id: ETranslations.global_advanced,
          })}
        </SizableText>
      ) : null}
      <SizableText color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.qr_connection_feature_lack,
        })}
      </SizableText>
      <SizableText color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.qr_connection_only_for_small_amount_users,
        })}
      </SizableText>
      <SizableText color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.qr_connection_re_add })}
      </SizableText>
      <Button mt="$3" size="large" onPress={handleCreateQRWallet}>
        {intl.formatMessage({ id: ETranslations.qr_connection_cta })}
      </Button>
    </YStack>
  );
}

function ConnectYourDevicePage({
  route: routeParams,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.ConnectYourDevice
>) {
  const { deviceType: deviceTypeItems } = routeParams?.params || {};
  console.log('deviceTypeItems', deviceTypeItems);
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();
  const intl = useIntl();
  const isSupportedQRCode = useMemo(() => {
    return deviceTypeItems.every(
      (deviceType) => deviceType === EDeviceType.Pro,
    );
  }, [deviceTypeItems]);
  const navigateToCreateQRWallet = useCallback(async () => {
    await timerUtils.wait(100);
    navigation.push(EOnboardingPagesV2.ConnectQRCode);
  }, [navigation]);

  const tabOptions = useMemo(() => {
    return [
      {
        label: platformEnv.isNative
          ? intl.formatMessage({ id: ETranslations.global_bluetooth })
          : 'USB',
        value: EConnectDeviceChannel.usbOrBle,
      },
      platformEnv.isSupportDesktopBle &&
      !deviceTypeItems.includes(EDeviceType.Mini)
        ? {
            label: intl.formatMessage({ id: ETranslations.global_bluetooth }),
            value: EConnectDeviceChannel.bluetooth,
          }
        : undefined,
    ].filter(Boolean);
  }, [deviceTypeItems, intl]);
  const [tabValue, setTabValue] = useState(tabOptions[0]?.value);

  useEffect(() => {
    const unsubscribe = reactNavigation.addListener('beforeRemove', () => {
      // Clean up forceTransportType when leaving this page
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
    });

    return unsubscribe;
  }, [reactNavigation]);

  const connectDevice = useCallback(
    async (
      item: IConnectYourDeviceItem,
      innerTabValue: EConnectDeviceChannel,
    ) => {
      if (!item.device) {
        return;
      }
      const connectId = item.device.connectId ?? '';
      try {
        if (
          item.device?.commType === 'electron-ble' ||
          item.device?.commType === 'ble'
        ) {
          void backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog({
            connectId,
          });
          await backgroundApiProxy.serviceHardware.getFeaturesWithoutCache({
            connectId,
            params: {
              retryCount: 0,
              onlyConnectBleDevice: true,
            },
          });
        }
        navigation.push(EOnboardingPagesV2.CheckAndUpdate, {
          deviceData: item,
          tabValue: innerTabValue,
        });
      } catch (error) {
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
      } finally {
        void backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId,
          hardClose: false,
          skipDelayClose: true,
          deviceResetToHome: false,
        });
      }
    },
    [navigation],
  );

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.onboarding_connect_your_device,
          })}
        />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent>
            <XStack alignItems="center" gap="$4">
              {tabOptions.length > 1 ? (
                <SegmentControl
                  fullWidth
                  value={tabValue}
                  onChange={(v) => setTabValue(v as EConnectDeviceChannel)}
                  options={tabOptions}
                />
              ) : null}
              {isSupportedQRCode ? (
                <YStack ml="auto">
                  <Popover
                    title={intl.formatMessage({
                      id: ETranslations.global_advanced,
                    })}
                    renderTrigger={
                      <IconButton variant="tertiary" icon="DotHorOutline" />
                    }
                    renderContent={
                      <QRWalletConnect
                        navigateToCreateQRWallet={navigateToCreateQRWallet}
                      />
                    }
                  />
                </YStack>
              ) : null}
            </XStack>
            {tabValue === EConnectDeviceChannel.usbOrBle ? (
              <USBOrBLEConnectionIndicator
                tabValue={tabValue}
                deviceTypeItems={deviceTypeItems}
                connectDevice={connectDevice}
              />
            ) : null}
            {tabValue === EConnectDeviceChannel.bluetooth ? (
              <BluetoothConnectionIndicator
                tabValue={tabValue}
                deviceTypeItems={deviceTypeItems}
                connectDevice={connectDevice}
              />
            ) : null}
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export function ConnectYourDevice({
  route,
  navigation,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.ConnectYourDevice
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home, // TODO read from router
      }}
    >
      <ConnectYourDevicePage route={route} navigation={navigation} />
    </AccountSelectorProviderMirror>
  );
}
export default ConnectYourDevice;
