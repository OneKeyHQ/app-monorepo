import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIsFocused } from '@react-navigation/core';
import { isString } from 'lodash';
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
  Icon,
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
import { HARDWARE_BRIDGE_DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
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
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import bleManagerInstance from '@onekeyhq/shared/src/hardware/bleManager';
import { checkBLEPermissions } from '@onekeyhq/shared/src/hardware/blePermissions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
import { ConnectionTroubleShootingAccordion } from '../../../components/Hardware/ConnectionTroubleShootingAccordion';
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
import { useDeviceConnect } from '../hooks/useDeviceConnect';
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
  onDeviceConnect: (device: SearchDevice) => Promise<void>;
}

// Common device list and connection logic
function useDeviceConnection({
  tabValue,
}: {
  tabValue: EConnectDeviceChannel;
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

function ConnectionIndicatorCard({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      borderRadius={10}
      borderCurve="continuous"
      $platform-web={{
        boxShadow: '0 1px 1px 0 rgba(0, 0, 0, 0.20)',
      }}
      $platform-android={{ elevation: 0.5 }}
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
      {platformEnv.isWeb ? (
        <Image
          source={require('@onekeyhq/kit/assets/onboarding/radial-gradient.png')}
          position="absolute"
          left="50%"
          bottom="0"
          style={{
            transform: [{ translateX: '-50%' }, { translateY: '50%' }],
          }}
          width={520}
          height={226}
          zIndex={0}
        />
      ) : null}
      {children}
    </YStack>
  );
}

function TroubleShootingButton({ type }: { type: 'usb' | 'bluetooth' }) {
  const [showHelper, setShowHelper] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

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
        >
          <HeightTransition initialHeight={0}>
            <XStack
              animation="quick"
              animateOnly={['opacity']}
              enterStyle={{ opacity: 0 }}
              m="0"
              px="$5"
              py="$2"
              hoverStyle={{
                bg: '$bgHover',
              }}
              focusable
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
                outlineWidth: 2,
                outlineOffset: 2,
              }}
              userSelect="none"
              onPress={() => setShowTroubleshooting(!showTroubleshooting)}
            >
              <SizableText size="$bodyMd" color="$textSubdued" flex={1}>
                Having trouble connecting your device?
              </SizableText>
              <Icon
                name={
                  showTroubleshooting ? 'MinusSmallOutline' : 'PlusSmallOutline'
                }
                size="$5"
                color="$iconSubdued"
              />
            </XStack>
          </HeightTransition>
          {showTroubleshooting ? (
            <ConnectionTroubleShootingAccordion connectionType={type} />
          ) : null}
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

function BluetoothCard() {
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
          Keep your device near the computer to pair
        </ConnectionIndicator.Title>
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
  const isPro = useMemo(() => {
    return deviceTypeItems.find((deviceType) => deviceType === EDeviceType.Pro);
  }, [deviceTypeItems]);

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
  onDeviceConnect,
  deviceTypeItems,
}: IDeviceConnectionProps) {
  const themeVariant = useThemeVariant();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();

  // Use the shared device connection logic
  const deviceConnection = useDeviceConnection({
    tabValue,
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

  const isUSB = useMemo(() => {
    return hardwareTransportType === EHardwareTransportType.WEBUSB;
  }, [hardwareTransportType]);

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
      (hardwareTransportType === EHardwareTransportType.WEBUSB &&
        !platformEnv.isDesktop)
    ) {
      return;
    }
    void (async () => {
      void listingDevice();
    })();
  }, [listingDevice, hardwareTransportType, tabValue]);

  useEffect(() => {
    setTimeout(async () => {
      if (isUSB) {
        await onConnectWebDevice();
      } else {
        await startBLEConnection();
      }
    }, 2500);
    return () => {
      stopScan();
    };
  }, [isUSB, onConnectWebDevice, startBLEConnection, stopScan]);

  const deviceLabel = useMemo(() => {
    return getDeviceLabel(deviceTypeItems);
  }, [deviceTypeItems]);

  const sortedDevicesData = useMemo(() => {
    return sortDevicesData(devicesData, deviceTypeItems);
  }, [deviceTypeItems, devicesData]);

  console.log('sortedDevicesData', sortedDevicesData);
  return (
    <>
      <TroubleShootingButton type="usb" />
      <ConnectionIndicator>
        {isBLE ? (
          <BluetoothCard />
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
                Connect {deviceLabel} to your computer via USB
              </ConnectionIndicator.Title>
              {platformEnv.isExtension ? (
                <>
                  <SizableText color="$textSubdued">
                    Click the button below then select your device in the popup
                    to connect
                  </SizableText>
                  <Button variant="primary" onPress={() => {}} mt="$2">
                    Start connection
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
                Looking for your device...
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
                    onPress={() => {
                      navigation.push(EOnboardingPagesV2.CheckAndUpdate, {
                        deviceData: data,
                        tabValue,
                      });
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
    </>
  );
}

function BluetoothConnectionIndicator({
  deviceTypeItems,
  onDeviceConnect,
  tabValue,
}: IDeviceConnectionProps) {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const navigation = useAppNavigation();
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
    tabValue,
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

  const sortedDevicesData = useMemo(() => {
    return sortDevicesData(devicesData, deviceTypeItems);
  }, [deviceTypeItems, devicesData]);

  if (bluetoothStatus === 'disabledInApp') {
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
        }}
      />
    );
  }

  if (bluetoothStatus === 'noSystemPermission') {
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
        }}
      />
    );
  }

  if (bluetoothStatus === 'disabledInSystem') {
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
        }}
      />
    );
  }

  return (
    <>
      <TroubleShootingButton type="bluetooth" />
      <ConnectionIndicator>
        <BluetoothCard />
        <ConnectionIndicator.Footer>
          <YStack px="$5">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText color="$textDisabled">
                Looking for your device...
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
                    onPress={() => {
                      navigation.push(EOnboardingPagesV2.CheckAndUpdate, {
                        deviceData: device,
                        tabValue,
                      });
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
    </>
  );
}

function QRWalletConnect() {
  const { gtMd } = useMedia();
  const navigation = useAppNavigation();
  const { closePopover } = usePopoverContext();
  const handleCreateQRWallet = useCallback(async () => {
    await closePopover?.();
    await timerUtils.wait(100);
    navigation.push(EOnboardingPagesV2.ConnectQRCode);
  }, [closePopover, navigation]);
  return (
    <YStack
      p="$5"
      pt="$0"
      gap="$3"
      $gtMd={{
        p: '$3',
      }}
    >
      {gtMd ? <SizableText size="$headingSm">Advanced</SizableText> : null}
      <SizableText color="$textSubdued">
        Some crypto assets and hardware features are unavailable in QR Code
        communication mode.
      </SizableText>
      <SizableText color="$textSubdued">
        This mode is intended only for a small number of users who rarely
        operate their hardware wallet and is not compatible with other
        connection methods.
      </SizableText>
      <SizableText color="$textSubdued">
        If you wish to connect your hardware wallet via Bluetooth or USB, please
        re-add the wallet to switch the communication mode.
      </SizableText>
      <Button mt="$3" size="large" onPress={handleCreateQRWallet}>
        Continue with QR Code
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

  const intl = useIntl();
  const isSupportedQRCode = useMemo(() => {
    return deviceTypeItems.every(
      (deviceType) => deviceType === EDeviceType.Pro,
    );
  }, [deviceTypeItems]);
  const tabOptions = useMemo(() => {
    return [
      {
        label: platformEnv.isNative
          ? intl.formatMessage({ id: ETranslations.global_bluetooth })
          : 'USB',
        value: EConnectDeviceChannel.usbOrBle,
      },
      platformEnv.isSupportDesktopBle
        ? {
            label: intl.formatMessage({ id: ETranslations.global_bluetooth }),
            value: EConnectDeviceChannel.bluetooth,
          }
        : undefined,
    ].filter(Boolean);
  }, [intl]);
  const [tabValue, setTabValue] = useState(tabOptions[0]?.value);

  const { onDeviceConnect } = useDeviceConnect();

  const handleDeviceConnect = useCallback(
    async (device: SearchDevice) => {
      await onDeviceConnect(device, tabValue);
    },
    [onDeviceConnect, tabValue],
  );

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Connect your device" />
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
                    title="Advanced"
                    renderTrigger={
                      <IconButton variant="tertiary" icon="DotHorOutline" />
                    }
                    renderContent={<QRWalletConnect />}
                  />
                </YStack>
              ) : null}
            </XStack>
            {tabValue === EConnectDeviceChannel.usbOrBle ? (
              <USBOrBLEConnectionIndicator
                tabValue={tabValue}
                deviceTypeItems={deviceTypeItems}
                onDeviceConnect={handleDeviceConnect}
              />
            ) : null}
            {tabValue === EConnectDeviceChannel.bluetooth ? (
              <BluetoothConnectionIndicator
                tabValue={tabValue}
                deviceTypeItems={deviceTypeItems}
                onDeviceConnect={handleDeviceConnect}
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
