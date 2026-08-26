import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIsFocused } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { get } from 'lodash';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  EVideoResizeMode,
  Empty,
  type IPageScreenProps,
  type IVideoSource,
  IconButton,
  LottieView,
  Popover,
  SegmentControl,
  SizableText,
  Toast,
  Video,
  XStack,
  YStack,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import { useOnboardingDeviceScanErrorHandler } from '@onekeyhq/kit/src/hooks/useOnboardingDeviceScanErrorHandler';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { HARDWARE_TROUBLESHOOTING_URL } from '@onekeyhq/shared/src/config/appConfig';
import { isOneKeyHardwareError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import bleManagerInstance from '@onekeyhq/shared/src/hardware/bleManager';
import { checkBLEPermissions } from '@onekeyhq/shared/src/hardware/blePermissions';
import { BLE_ONBOARDING_ENSURE_CONNECTED_TIMEOUT_MS } from '@onekeyhq/shared/src/hardware/connectionTimeouts';
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
import {
  isProtocolV2ProductType,
  supportsHardwareQrWallet,
} from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EAccountSelectorSceneName,
  EHardwareTransportType,
} from '@onekeyhq/shared/types';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import {
  OpenBleSettingsDialog,
  RequireBlePermissionDialog,
} from '../../../components/Hardware/HardwareDialog';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useDeviceStageBurst } from '../../../hooks/useDeviceStageBurst';
import { hardwareUiStateDialogLifecycle } from '../../../provider/Container/HardwareUiStateContainer/hardwareUiStateDialogLifecycle';
import { FoundDevicesFooter } from '../components/FoundDevicesFooter';
import { OnboardingPage } from '../components/Layout';
import { getDeviceLabel } from '../deviceLabel';
import {
  EBluetoothStatus,
  useDesktopBluetoothStatusPolling,
} from '../hooks/useDeviceConnect';
import { OnboardingTestIDs } from '../testIDs';
import { getForceTransportType, sortDevicesData } from '../utils';

import { ConnectionIndicator } from './ConnectionIndicator';

import type { SearchDevice } from '@onekeyfe/hd-core';
import type { HardwareConnectProtocol } from '@onekeyfe/hd-shared';

const LedgerConnectionFlow = lazy(() => import('./ConnectionFlowLedger'));
const TrezorConnectionFlow = lazy(() => import('./ConnectionFlowTrezor'));

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}

interface IDeviceConnectionProps {
  tabValue: EConnectDeviceChannel;
  deviceTypeItems: EDeviceType[];
  vendor?: EHardwareVendor;
  connectDevice: (
    item: IConnectYourDeviceItem,
    innerTabValue: EConnectDeviceChannel,
  ) => Promise<void> | void;
}

// Common device list and connection logic
function useDeviceConnection({
  tabValue,
  onDeviceSelect,
  vendor,
}: {
  tabValue: EConnectDeviceChannel;
  onDeviceSelect?: (item: IConnectYourDeviceItem) => Promise<void> | void;
  vendor?: EHardwareVendor;
}) {
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

  const stopScan = useCallback(() => {
    isSearchingRef.current = false;
    deviceScanner.stopScan();
  }, [deviceScanner]);

  const stopScanAfterError = useCallback(() => {
    setConnectStatus(EConnectionStatus.init);
    stopScan();
  }, [stopScan]);

  const { handleScanError, resetScanError } =
    useOnboardingDeviceScanErrorHandler({ stopScan: stopScanAfterError });

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
    const transportType =
      forceTransportType === EHardwareTransportType.BLE ||
      forceTransportType === EHardwareTransportType.DesktopWebBle
        ? 'ble'
        : 'usb';

    isSearchingRef.current = true;
    deviceScanner.startDeviceScan(
      (response) => {
        if (!response.success) {
          return;
        }
        resetScanError();

        const sortedDevices = response.payload.toSorted((a, b) =>
          natsort({ insensitive: true })(
            a.name || a.connectId || a.deviceId || a.uuid,
            b.name || b.connectId || b.deviceId || b.uuid,
          ),
        );

        // Only set search results if tabValue hasn't changed
        if (currentTabValueRef.current === tabValue) {
          setSearchedDevices(
            tabValue === EConnectDeviceChannel.bluetooth
              ? sortedDevices.filter(deviceUtils.isBluetoothSearchDevice)
              : sortedDevices,
          );
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
      vendor,
      { transportType, onError: handleScanError },
    );
  }, [deviceScanner, handleScanError, resetScanError, tabValue, vendor]);

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
      return true;
    } catch (error) {
      console.error('ensureStopScan: Error while stopping scan:', error);
      // 仅停止 UI 轮询不足以证明 Noble 已停止；本次不继续连接。
      deviceScanner.stopScan();
      return false;
    }
  }, [deviceScanner]);

  const devicesData = useMemo<IConnectYourDeviceItem[]>(
    () =>
      searchedDevices.map((item: SearchDevice) => ({
        title: item.name,
        src: HwWalletAvatarImages[getDeviceAvatarImage(item.deviceType)],
        device: item,
        ...(vendor ? { vendor } : {}),
      })),
    [searchedDevices, vendor],
  );

  const handleDeviceSelect = useCallback(
    async (item: IConnectYourDeviceItem) => {
      if (!item.device) {
        return;
      }
      // Noble 不能同时稳定地执行设备枚举和定向连接。必须等当前扫描及其
      // stopScanning 回调完成，再把已发现的 peripheral 交给连接流程。
      const scanStopped = await ensureStopScan();
      if (!scanStopped) {
        return;
      }
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

function TroubleShootingButton({ type: _type }: { type: 'usb' | 'bluetooth' }) {
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
          <YStack gap="$2">
            <Button
              testID={OnboardingTestIDs.connectYourDeviceTroubleshootingBtn}
              icon="OpenOutline"
              onPress={() => {
                openUrlExternal(HARDWARE_TROUBLESHOOTING_URL);
              }}
            >
              {intl.formatMessage({ id: ETranslations.self_troubleshooting })}
            </Button>
            <Button
              testID={OnboardingTestIDs.connectYourDeviceContactUsBtn}
              icon="HelpSupportOutline"
              onPress={() => {
                void showIntercom();
              }}
            >
              {intl.formatMessage({ id: ETranslations.settings_contact_us })}
            </Button>
          </YStack>
        </YStack>
      ) : null}
    </>
  );
}

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
            <Button
              testID={OnboardingTestIDs.connectYourDeviceBluetoothConnectBtn}
              variant="primary"
              mt="$2"
              onPress={onConnect}
            >
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

function DeviceVideo({ deviceTypeItems }: { deviceTypeItems: EDeviceType[] }) {
  const isProtocolV2Product = useMemo(
    () => deviceTypeItems.some(isProtocolV2ProductType),
    [deviceTypeItems],
  );

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

  // The onboarding flow is force-dark, so every device uses its dark (-D) asset
  // and no theme branching is needed.
  const videoSource = useMemo<IVideoSource>(() => {
    if (isProtocolV2Product) {
      return require('@onekeyhq/kit/assets/onboarding/ProW-D.mp4') as IVideoSource;
    }
    if (isMini) {
      return require('@onekeyhq/kit/assets/onboarding/Mini-D.mp4') as IVideoSource;
    }
    if (isClassic) {
      return require('@onekeyhq/kit/assets/onboarding/Classic1S-D.mp4') as IVideoSource;
    }
    if (isTouch) {
      return require('@onekeyhq/kit/assets/onboarding/Touch-D.mp4') as IVideoSource;
    }
    return require('@onekeyhq/kit/assets/onboarding/ProW-D.mp4') as IVideoSource;
  }, [isClassic, isMini, isProtocolV2Product, isTouch]);

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
  vendor,
}: IDeviceConnectionProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();

  // Use the shared device connection logic
  const deviceConnection = useDeviceConnection({
    tabValue,
    onDeviceSelect: async (item) => connectDevice(item, tabValue),
    vendor,
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

  const isBLE = platformEnv.isNative;

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
            deviceData: {
              ...connectedDevice,
              device: {
                ...connectedDevice.device,
                connectProtocol: undefined,
              },
            },
            tabValue,
          });
        }
      }
    } catch (error) {
      console.error('onConnectWebDevice error:', error);
      setIsChecking(false);
    }
  }, [navigation, promptWebUsbDeviceAccess, setIsChecking, tabValue]);

  useEffect(() => {
    if (
      hardwareTransportType === EHardwareTransportType.WEBUSB &&
      !platformEnv.isDesktop
    ) {
      return;
    }

    // OneKey: auto-start listing
    const timeoutId = setTimeout(
      () => {
        void (platformEnv.isNative ? startBLEConnection() : listingDevice());
      },
      platformEnv.isNative ? 120 : 0,
    );
    return () => clearTimeout(timeoutId);
  }, [
    listingDevice,
    hardwareTransportType,
    tabValue,
    startBLEConnection,
    vendor,
  ]);

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
              <DeviceVideo deviceTypeItems={deviceTypeItems} />
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
                    testID={OnboardingTestIDs.connectYourDeviceUSBConnectBtn}
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
          <FoundDevicesFooter
            devices={sortedDevicesData}
            isScanning={connectStatus === EConnectionStatus.listing}
            onConnect={handleDeviceSelect}
          />
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
  vendor,
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
    vendor,
  });

  const {
    connectStatus,
    setConnectStatus,
    devicesData,
    scanDevice,
    stopScan,
    handleDeviceSelect,
  } = deviceConnection;

  const listingDevice = useCallback(async () => {
    setConnectStatus(EConnectionStatus.listing);
    await scanDevice();
  }, [scanDevice, setConnectStatus]);

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
      void listingDevice();
    } else if (!isFocused) {
      stopScan();
    }
  }, [bluetoothStatus, isFocused, listingDevice, stopScan]);

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

  // Pause bluetooth status polling while a connection attempt is in flight.
  const handleConnectFoundDevice = useCallback(
    async (device: IConnectYourDeviceItem) => {
      if (!device.device) {
        return;
      }
      setBluetoothConnecting(true);
      try {
        await handleDeviceSelect(device);
      } finally {
        setBluetoothConnecting(false);
      }
    },
    [handleDeviceSelect, setBluetoothConnecting],
  );

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
        <BluetoothCard
          onConnect={listingDevice}
          connectStatus={connectStatus}
        />
        <ConnectionIndicator.Footer>
          <FoundDevicesFooter
            devices={sortedDevicesData}
            isScanning={connectStatus === EConnectionStatus.listing}
            onConnect={handleConnectFoundDevice}
          />
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
      <Button
        testID={OnboardingTestIDs.connectYourDeviceCreateQRWalletBtn}
        mt="$3"
        size="large"
        onPress={handleCreateQRWallet}
      >
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
  const { deviceType: deviceTypeItems, vendor } = routeParams?.params || {};
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();
  const intl = useIntl();
  const isSupportedQRCode = useMemo(() => {
    return deviceTypeItems.some(supportsHardwareQrWallet);
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

  // Page-entry event: report once per mount, carrying the initial channel, so
  // USB/Bluetooth tab switches do not inflate the funnel denominator.
  const pageReportedRef = useRef(false);
  useEffect(() => {
    if (!tabValue || pageReportedRef.current) {
      return;
    }
    pageReportedRef.current = true;
    const deviceTypeLabel =
      deviceTypeItems.length > 0
        ? deviceTypeItems.join(',')
        : (vendor ?? 'others');
    defaultLogger.onboarding.page.connectYourDevice(deviceTypeLabel, tabValue);
  }, [deviceTypeItems, tabValue, vendor]);

  useEffect(() => {
    const unsubscribe = reactNavigation.addListener('beforeRemove', () => {
      // Clean up forceTransportType when leaving this page
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
    });

    return unsubscribe;
  }, [reactNavigation]);

  const { beginBurst: beginStageBurst, endBurst: endStageBurst } =
    useDeviceStageBurst();

  const connectDevice = useCallback(
    async (
      item: IConnectYourDeviceItem,
      innerTabValue: EConnectDeviceChannel,
    ) => {
      if (!item.device) {
        return;
      }
      defaultLogger.onboarding.page.connectFoundDevice(
        item.device.deviceType ?? '',
        innerTabValue,
      );
      const connectId = item.device.connectId ?? '';
      let detectedConnectProtocol: HardwareConnectProtocol | undefined;
      let connectedDevice = item.device;
      let checkingDialogOpened = false;
      let checkingDialogClosed = false;
      const closeCheckingDeviceDialog = () =>
        backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId,
          hardClose: false,
          skipDelayClose: true,
          deviceResetToHome: false,
        });
      try {
        // For third-party devices, skip CheckAndUpdate and go directly to FinalizeWalletSetup
        if (
          item.vendor === EHardwareVendor.ledger ||
          item.vendor === EHardwareVendor.trezor
        ) {
          navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
            deviceData: {
              ...item,
              vendor: item.vendor,
            },
            isFirmwareVerified: true,
            tabValue: innerTabValue,
          });
          return;
        }

        if (deviceUtils.isBluetoothSearchDevice(item.device)) {
          const hardwareTransportType =
            item.device.commType === 'electron-ble'
              ? EHardwareTransportType.DesktopWebBle
              : EHardwareTransportType.BLE;
          const showCheckingDeviceDialog = () =>
            backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog({
              connectId,
              deviceType: item.device?.deviceType ?? undefined,
              deviceName: item.device?.name ?? undefined,
            });
          checkingDialogOpened = true;
          // One hold for the preflight: without it the stage's exit is a
          // race between the SDK's trailing progress ticks and its close
          // event, and the capsule can outlive this page (OK-59934).
          await beginStageBurst({
            connectId,
            deviceType: item.device?.deviceType ?? undefined,
            deviceName: item.device?.name ?? undefined,
          });
          if (platformEnv.isNativeIOS) {
            await hardwareUiStateDialogLifecycle.openAndWait(
              showCheckingDeviceDialog,
            );
          } else {
            void showCheckingDeviceDialog();
          }
          const features =
            await backgroundApiProxy.serviceHardware.getFeaturesWithoutCache({
              connectId,
              params: {
                forceProtocolDetection: true,
                // 首次定向扫描可能恰好落在设备广播间隔中，允许一次受控
                // 重试；不要恢复 SDK 默认的五次重试，以免 onboarding 久等。
                retryCount: 1,
                timeout: BLE_ONBOARDING_ENSURE_CONNECTED_TIMEOUT_MS,
              },
              hardwareTransportType,
            });
          detectedConnectProtocol =
            features.protocol === 'V1' || features.protocol === 'V2'
              ? features.protocol
              : undefined;
          connectedDevice = {
            ...item.device,
            connectProtocol: detectedConnectProtocol,
          };

          if (platformEnv.isNativeIOS) {
            await hardwareUiStateDialogLifecycle.closeAndWait(
              closeCheckingDeviceDialog,
            );
            checkingDialogClosed = true;
          }
        }
        navigation.push(EOnboardingPagesV2.CheckAndUpdate, {
          deviceData: {
            ...item,
            device: connectedDevice,
          },
          tabValue: innerTabValue,
          connectProtocol: detectedConnectProtocol,
        });
      } catch (error) {
        if (isOneKeyHardwareError(error)) {
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
        // The preflight is over either way — the stage leaves with it.
        void endStageBurst();
        if (!checkingDialogClosed) {
          if (platformEnv.isNativeIOS && checkingDialogOpened) {
            try {
              await hardwareUiStateDialogLifecycle.closeAndWait(
                closeCheckingDeviceDialog,
              );
            } catch (error) {
              console.error(
                'Failed to close onboarding hardware dialog:',
                error,
              );
            }
          } else {
            void closeCheckingDeviceDialog();
          }
        }
      }
    },
    [beginStageBurst, endStageBurst, navigation],
  );

  let content = (
    <>
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
                <IconButton
                  testID={OnboardingTestIDs.connectYourDeviceAdvancedMenuBtn}
                  variant="tertiary"
                  icon="DotHorOutline"
                />
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
          vendor={vendor}
        />
      ) : null}
      {tabValue === EConnectDeviceChannel.bluetooth ? (
        <BluetoothConnectionIndicator
          tabValue={tabValue}
          deviceTypeItems={deviceTypeItems}
          connectDevice={connectDevice}
          vendor={vendor}
        />
      ) : null}
    </>
  );

  if (vendor === EHardwareVendor.ledger) {
    content = <LedgerConnectionFlow />;
  }
  if (vendor === EHardwareVendor.trezor) {
    content = <TrezorConnectionFlow />;
  }

  return (
    <OnboardingPage
      headerTitle={intl.formatMessage({
        id: ETranslations.onboarding_connect_your_device,
      })}
      scrollable
      alignTop
      narrow
      contentContainerProps={{ gap: '$5' }}
    >
      {content}
    </OnboardingPage>
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
