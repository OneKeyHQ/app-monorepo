import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIsFocused, useRoute } from '@react-navigation/core';
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
} from '@onekeyhq/components';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import type { IDBCreateHwWalletParamsBase } from '@onekeyhq/kit-bg/src/dbs/local/types';
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
  OneKeyHardwareError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import bleManagerInstance from '@onekeyhq/shared/src/hardware/bleManager';
import { checkBLEPermissions } from '@onekeyhq/shared/src/hardware/blePermissions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes/onboarding';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
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
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

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
import { useHelpLink } from '../../../hooks/useHelpLink';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { useUserWalletProfile } from '../../../hooks/useUserWalletProfile';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import { useFirmwareUpdateActions } from '../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareVerifyDialog } from '../../Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import { useSelectAddWalletTypeDialog } from '../../Onboarding/pages/ConnectHardwareWallet/SelectAddWalletTypeDialog';
import { OnboardingLayout } from '../components/OnboardingLayout';

import type { Features, IDeviceType, SearchDevice } from '@onekeyfe/hd-core';
import type { ImageSourcePropType } from 'react-native';

type IConnectYourDeviceItem = {
  title: string;
  src: ImageSourcePropType;
  onPress: () => void | Promise<void>;
  opacity?: number;
  device: SearchDevice | undefined;
};
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
      if (platformEnv.isNative) return EHardwareTransportType.BLE;
      if (platformEnv.isDesktop) {
        const dev = await backgroundApiProxy.serviceDevSetting.getDevSetting();
        const usbCommunicationMode = dev?.settings?.usbCommunicationMode;
        if (usbCommunicationMode === 'bridge')
          return EHardwareTransportType.Bridge;
        return EHardwareTransportType.WEBUSB;
      }
      // For web/extension, use system setting transport type
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

// Common device list and connection logic
function useDeviceConnection({
  tabValue,
  onDeviceConnect,
}: {
  tabValue: EConnectDeviceChannel;
  onDeviceConnect: (device: SearchDevice) => Promise<void>;
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
      searchedDevices.map((item) => ({
        title: item.name,
        src: HwWalletAvatarImages[getDeviceAvatarImage(item.deviceType)],
        device: item,
        onPress: async () => {
          // Ensure device scanning is completely stopped before connecting
          await ensureStopScan();
          await onDeviceConnect(item);
        },
      })),
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

function USBConnectionIndicator({
  tabValue,
  onDeviceConnect,
}: {
  tabValue: EConnectDeviceChannel;
  onDeviceConnect: (device: SearchDevice) => Promise<void>;
}) {
  const themeVariant = useThemeVariant();
  const intl = useIntl();
  const navigation = useAppNavigation();
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
      (hardwareTransportType === EHardwareTransportType.WEBUSB &&
        !platformEnv.isDesktop)
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
      <TroubleShootingButton type="usb" />
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <Video
              muted
              autoPlay
              w="100%"
              h="100%" // required for native
              controls={false}
              playInBackground={false}
              resizeMode={EVideoResizeMode.COVER}
              source={
                themeVariant === 'dark'
                  ? require('@onekeyhq/kit/assets/onboarding/ProW-D.mp4')
                  : require('@onekeyhq/kit/assets/onboarding/ProW-L.mp4')
              }
            />
          </ConnectionIndicator.Animation>
          <ConnectionIndicator.Content gap="$2">
            <ConnectionIndicator.Title>
              Connect OneKey Pro to your computer via USB
            </ConnectionIndicator.Title>
            {platformEnv.isExtension ? (
              <>
                <SizableText color="$textSubdued">
                  Click the button below then select your device in the popup to
                  connect
                </SizableText>
                <Button variant="primary" onPress={() => {}} mt="$2">
                  Start connection
                </Button>
              </>
            ) : null}
          </ConnectionIndicator.Content>
        </ConnectionIndicator.Card>

        <ConnectionIndicator.Footer>
          <YStack px="$5">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText color="$textDisabled">
                Looking for your device...
              </SizableText>
            </XStack>
          </YStack>
          <HeightTransition initialHeight={0}>
            {devicesData.length > 0 ? (
              <>
                {devicesData.map((data) => (
                  <ListItem
                    key={data.device?.deviceId}
                    drillIn
                    onPress={() => {
                      navigation.push(EOnboardingPagesV2.CheckAndUpdate, {
                        deviceData: data,
                      });
                    }}
                    userSelect="none"
                  >
                    <WalletAvatar
                      wallet={undefined}
                      img={data.device?.deviceType as any}
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

function BluetoothConnectionIndicator() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [bluetoothStatus, _setBluetoothStatus] = useState<
    | 'enabled'
    | 'disabledInSystem'
    | 'disabledInApp'
    | 'checking'
    | 'noSystemPermission'
  >('enabled');
  const [devices, setDevices] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);

  // Simulate loading devices after a delay
  const handleToggleDevices = useCallback(() => {
    if (devices.length > 0) {
      setDevices([]);
    } else {
      setDevices([
        { id: '1', name: 'Pro 062B', type: EDeviceType.Pro },
        { id: '2', name: 'Classic 1A3F', type: EDeviceType.Classic },
      ]);
    }
  }, [devices.length]);

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
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <YStack
              w="100%"
              h="100%"
              alignItems="center"
              justifyContent="center"
            >
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
        <ConnectionIndicator.Footer>
          <YStack px="$5">
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText color="$textDisabled">
                Looking for your device...
              </SizableText>
              <Button
                size="small"
                variant="tertiary"
                onPress={handleToggleDevices}
              >
                {devices.length > 0 ? 'Delete data' : 'Mock data'}
              </Button>
            </XStack>
          </YStack>
          <HeightTransition initialHeight={0}>
            {devices.length > 0 ? (
              <>
                {devices.map((device) => (
                  <ListItem
                    key={device.id}
                    drillIn
                    onPress={() => {
                      navigation.push(EOnboardingPagesV2.CheckAndUpdate);
                    }}
                    userSelect="none"
                  >
                    <WalletAvatar wallet={undefined} img={device.type as any} />
                    <ListItem.Text primary={device.name} flex={1} />
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

const isSupportedDevice = (deviceType: string) => {
  return (
    deviceType === EDeviceType.Pro ||
    deviceType === EDeviceType.Touch ||
    deviceType === EDeviceType.Unknown
  );
};

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
    return deviceTypeItems.every(isSupportedDevice);
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

  const { gtMd } = useMedia();
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog();
  const { showSelectAddWalletTypeDialog } = useSelectAddWalletTypeDialog();
  const fwUpdateActions = useFirmwareUpdateActions();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const [{ hardwareTransportType }] = useSettingsPersistAtom();
  const [isCheckingDeviceLoading, setIsChecking] = useState(false);

  const handleRestoreWalletPress = useCallback(
    ({ deviceType }: { deviceType: IDeviceType }) => {
      navigation.push(EOnboardingPages.ActivateDevice, {
        tutorialType: 'restore',
        deviceType,
      });
    },
    [navigation],
  );

  const handleSetupNewWalletPress = useCallback(
    ({ deviceType }: { deviceType: IDeviceType }) => {
      navigation.push(EOnboardingPages.ActivateDevice, {
        tutorialType: 'create',
        deviceType,
      });
    },
    [navigation],
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
      <OnboardingLayout>
        <OnboardingLayout.Header title="Connect your device" />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent>
            <XStack alignItems="center" gap="$4">
              {tabOptions.length > 1 ? (
                <YStack flex={1}>
                  <SegmentControl
                    fullWidth
                    value={tabValue}
                    onChange={(v) => setTabValue(v as EConnectDeviceChannel)}
                    options={tabOptions}
                  />
                </YStack>
              ) : null}
              {isSupportedQRCode ? (
                <YStack ml="auto">
                  <Popover
                    title="Advanced"
                    renderTrigger={
                      <IconButton variant="tertiary" icon="DotHorOutline" />
                    }
                    renderContent={({ closePopover }) => (
                      <YStack
                        p="$5"
                        pt="$0"
                        gap="$3"
                        $gtMd={{
                          p: '$3',
                        }}
                      >
                        {gtMd ? (
                          <SizableText size="$headingSm">Advanced</SizableText>
                        ) : null}
                        <SizableText color="$textSubdued">
                          Some crypto assets and hardware features are
                          unavailable in QR Code communication mode.
                        </SizableText>
                        <SizableText color="$textSubdued">
                          This mode is intended only for a small number of users
                          who rarely operate their hardware wallet and is not
                          compatible with other connection methods.
                        </SizableText>
                        <SizableText color="$textSubdued">
                          If you wish to connect your hardware wallet via
                          Bluetooth or USB, please re-add the wallet to switch
                          the communication mode.
                        </SizableText>
                        <Button
                          mt="$3"
                          size="large"
                          onPress={() => {
                            void (
                              closePopover() as unknown as Promise<void>
                            ).then(() => {
                              navigation.push(EOnboardingPagesV2.ConnectQRCode);
                            });
                          }}
                        >
                          Continue with QR Code
                        </Button>
                      </YStack>
                    )}
                  />
                </YStack>
              ) : null}
            </XStack>
            {tabValue === EConnectDeviceChannel.usbOrBle ? (
              <USBConnectionIndicator
                tabValue={tabValue}
                onDeviceConnect={handleDeviceConnect}
              />
            ) : null}
            {tabValue === EConnectDeviceChannel.bluetooth ? (
              <BluetoothConnectionIndicator />
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
