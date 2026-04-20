/**
 * Ledger connection flow — 1:1 copy of OneKey USB connection flow.
 * Customize from here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  EVideoResizeMode,
  HeightTransition,
  SizableText,
  Toast,
  Video,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
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
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import {
  HwWalletAvatarImages,
  getDeviceAvatarImage,
} from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { getForceTransportType, sortDevicesData } from '../utils';

import { ConnectionIndicator } from './ConnectYourDevice';

import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';
import type { ReactVideoSource } from 'react-native-video';

// ---------------------------------------------------------------------------
// Copied from ConnectYourDevice.tsx — keep in sync or refactor to shared
// ---------------------------------------------------------------------------

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}

function BridgeNotInstalledDialogContent() {
  return (
    <SizableText size="$bodyLg" mt="$1.5" color="$textSubdued">
      {platformEnv.isSupportWebUSB
        ? 'Communication failed. Please check the connection and try again.'
        : 'Please install OneKey Bridge to continue.'}
    </SizableText>
  );
}

function DeviceVideo({ themeVariant }: { themeVariant: 'light' | 'dark' }) {
  // Use ProW video as default — replace with Ledger video later
  const videoSource = useMemo<ReactVideoSource>(
    () =>
      themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/onboarding/ProW-D.mp4') as ReactVideoSource)
        : (require('@onekeyhq/kit/assets/onboarding/ProW-L.mp4') as ReactVideoSource),
    [themeVariant],
  );

  return (
    <Video
      muted
      autoPlay
      w="100%"
      h="100%"
      controls={false}
      playInBackground={false}
      resizeMode={EVideoResizeMode.COVER}
      source={videoSource}
    />
  );
}

function TroubleShootingButton() {
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

// ---------------------------------------------------------------------------
// Main Ledger connection flow — same structure as USBOrBLEConnectionIndicator
// ---------------------------------------------------------------------------

export default function LedgerConnectionFlow() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const themeVariant = useThemeVariant();
  const { promptHidDeviceAccess } = usePromptWebDeviceAccess();

  const vendor = EHardwareVendor.ledger;
  const tabValue = EConnectDeviceChannel.usbOrBle;
  const deviceLabel = 'Ledger';

  // --- Device connection state (copied from useDeviceConnection) ---
  const [connectStatus, setConnectStatus] = useState(EConnectionStatus.init);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);
  const [isCheckingDeviceLoading, setIsChecking] = useState(false);
  const searchStateRef = useRef<'start' | 'stop'>('stop');
  const isSearchingRef = useRef(false);

  const deviceScanner = useMemo(
    () =>
      deviceUtils.getDeviceScanner({
        backgroundApi: backgroundApiProxy,
      }),
    [],
  );

  // --- Scan logic (copied from useDeviceConnection.scanDevice) ---
  const scanDevice = useCallback(async () => {
    if (isSearchingRef.current) {
      return;
    }

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
              renderContent: <BridgeNotInstalledDialogContent />,
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_download_and_install,
              }),
              onConfirm: () => Linking.openURL(HARDWARE_BRIDGE_DOWNLOAD_URL),
            });
            deviceScanner.stopScan();
          }
          return;
        }

        const sortedDevices = response.payload.toSorted((a, b) =>
          natsort({ insensitive: true })(
            a.name || a.connectId || a.deviceId || a.uuid,
            b.name || b.connectId || b.deviceId || b.uuid,
          ),
        );

        setSearchedDevices(sortedDevices);
      },
      (state) => {
        searchStateRef.current = state;
      },
      1, // pollIntervalRate — no backoff, fixed interval
      1500, // pollInterval — 1.5s between polls
      60, // maxTryCount — search for up to ~90s
      vendor,
    );
  }, [deviceScanner, intl, vendor, tabValue]);

  const stopScan = useCallback(() => {
    isSearchingRef.current = false;
    deviceScanner.stopScan();
  }, [deviceScanner]);

  const ensureStopScan = useCallback(async () => {
    isSearchingRef.current = false;
    try {
      await deviceScanner.stopScanAndWait();
    } catch {
      deviceScanner.stopScan();
    }
  }, [deviceScanner]);

  // --- Device list data ---
  const devicesData = useMemo<IConnectYourDeviceItem[]>(
    () =>
      searchedDevices.map((item: SearchDevice) => ({
        title: item.name,
        src: HwWalletAvatarImages[getDeviceAvatarImage(item.deviceType)],
        device: item,
      })),
    [searchedDevices],
  );

  const sortedDevicesData = useMemo(
    () => sortDevicesData(devicesData, []),
    [devicesData],
  );

  // --- Device select ---
  const handleDeviceSelect = useCallback(
    async (data: IConnectYourDeviceItem) => {
      if (!data.device) return;
      await ensureStopScan();

      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        deviceData: {
          ...data,
          vendor: EHardwareVendor.ledger,
        },
        isFirmwareVerified: true,
      });
    },
    [ensureStopScan, navigation],
  );

  // --- Listing mode ---
  const listingDevice = useCallback(async () => {
    setConnectStatus(EConnectionStatus.listing);
    await scanDevice();
  }, [scanDevice]);

  // --- Start connection ---
  // Extension: HID permission popup first, then listing
  // Desktop: directly start listing (no permission needed)
  const onStartConnection = useCallback(async () => {
    if (platformEnv.isExtension) {
      // Extension needs user gesture to call navigator.hid.requestDevice()
      setIsChecking(true);
      try {
        const hidDevice = await promptHidDeviceAccess();
        if (hidDevice) {
          setIsChecking(false);
          void listingDevice();
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        console.error('[Ledger] HID permission error:', error);
        setIsChecking(false);
      }
    } else {
      // Desktop / Web: start searching directly
      void listingDevice();
    }
  }, [promptHidDeviceAccess, listingDevice]);

  // --- Focus / unfocus ---
  useEffect(() => {
    if (isFocused) {
      if (connectStatus === EConnectionStatus.listing) {
        void listingDevice();
      }
    } else {
      stopScan();
    }
  }, [connectStatus, isFocused, listingDevice, stopScan]);

  useEffect(
    () => () => {
      stopScan();
    },
    [stopScan],
  );

  // --- Render (1:1 copy of USBOrBLEConnectionIndicator USB branch) ---
  return (
    <>
      <ConnectionIndicator>
        <ConnectionIndicator.Card>
          <ConnectionIndicator.Animation>
            <DeviceVideo themeVariant={themeVariant} />
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
            <YStack gap="$1">
              <SizableText color="$textSubdued">
                1. Connect your Ledger to computer via USB
              </SizableText>
              <SizableText color="$textSubdued">
                2. Unlock your Ledger
              </SizableText>
            </YStack>
            {connectStatus === EConnectionStatus.init ? (
              <>
                <Button
                  variant="primary"
                  mt="$2"
                  onPress={onStartConnection}
                  loading={isCheckingDeviceLoading}
                  disabled={isCheckingDeviceLoading}
                >
                  {intl.formatMessage({
                    id: ETranslations.global_start_connection,
                  })}
                </Button>
              </>
            ) : null}
          </ConnectionIndicator.Content>
        </ConnectionIndicator.Card>

        <ConnectionIndicator.Footer>
          {connectStatus === EConnectionStatus.listing ? (
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
          ) : null}
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
      <TroubleShootingButton />
    </>
  );
}
