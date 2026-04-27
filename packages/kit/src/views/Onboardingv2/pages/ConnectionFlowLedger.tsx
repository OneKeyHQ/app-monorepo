import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

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
import { ThirdPartyDevicePermissionDenied } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { ThirdPartyWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EConnectDeviceChannel } from '@onekeyhq/shared/types/connectDevice';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { RequireBlePermissionDialog } from '../../../components/Hardware/HardwareDialog';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { getForceTransportType, sortDevicesData } from '../utils';

import { ConnectionIndicator } from './ConnectYourDevice';

import type { SearchDevice } from '@onekeyfe/hd-core';
import type { ReactVideoSource } from 'react-native-video';

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}

function RequireBlePermissionDialogRender({ ref }: { ref: any }) {
  return <RequireBlePermissionDialog ref={ref} />;
}

function DeviceVideo({ themeVariant }: { themeVariant: 'light' | 'dark' }) {
  const videoSource = useMemo<ReactVideoSource>(
    () =>
      themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/onboarding/Connect-Ledger-D.mp4') as ReactVideoSource)
        : (require('@onekeyhq/kit/assets/onboarding/Connect-Ledger-L.mp4') as ReactVideoSource),
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
  // Mobile (iOS/Android) uses BLE; extension and desktop use USB.
  const isBle = platformEnv.isNative;

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

    const MAX_TRY_COUNT = 60;
    let pollsCompleted = 0;

    isSearchingRef.current = true;
    deviceScanner.startDeviceScan(
      (response) => {
        pollsCompleted += 1;
        if (!response.success) {
          const error = convertDeviceError(response.payload);
          // BLE permission denied → show system-settings dialog instead of toast
          // (shares RequireBlePermissionDialog with OneKey native BLE flow).
          if (error instanceof ThirdPartyDevicePermissionDenied) {
            Dialog.show({
              dialogContainer: RequireBlePermissionDialogRender,
            });
          } else {
            Toast.error({
              title:
                error.message ||
                intl.formatMessage({
                  id: ETranslations.hardware_third_party_device_scan_error,
                }),
            });
          }
          // Reset the searching flag so a subsequent scanDevice() call can re-enter.
          isSearchingRef.current = false;
          // Return to init so the Start Connection button reappears.
          setConnectStatus(EConnectionStatus.init);
          deviceScanner.stopScan();
          return;
        }

        const sortedDevices = response.payload.toSorted((a, b) =>
          natsort({ insensitive: true })(
            a.name || a.connectId || a.deviceId || a.uuid,
            b.name || b.connectId || b.deviceId || b.uuid,
          ),
        );

        setSearchedDevices(sortedDevices);

        // Scanner internally calls stopScan() once tryCount exceeds maxTryCount
        // on the next poll iteration, but doesn't notify the caller. Reset the
        // searching flag here so a subsequent scanDevice() call can re-enter.
        if (pollsCompleted >= MAX_TRY_COUNT) {
          isSearchingRef.current = false;
          // If no device was found after the full window, return to init so
          // the Start Connection button reappears. If devices were found, keep
          // the listing state so the user can still pick from what's on screen.
          if (sortedDevices.length === 0) {
            setConnectStatus(EConnectionStatus.init);
          }
        }
      },
      (state) => {
        searchStateRef.current = state;
      },
      1, // pollIntervalRate — no backoff, fixed interval
      1500, // pollInterval — 1.5s between polls
      MAX_TRY_COUNT, // maxTryCount — search for up to ~90s
      vendor,
    );
  }, [deviceScanner, vendor, tabValue, intl]);

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
        src: ThirdPartyWalletAvatarImages.ledger,
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
              {isBle
                ? intl.formatMessage({
                    id: ETranslations.onboarding_bluetooth_prepare_to_connect,
                  })
                : intl.formatMessage(
                    {
                      id: ETranslations.connect_device_to_computer_via_usb,
                    },
                    { deviceLabel },
                  )}
            </ConnectionIndicator.Title>
            <YStack gap="$1">
              <SizableText color="$textSubdued">
                {`1. ${intl.formatMessage({
                  id: isBle
                    ? ETranslations.hardware_third_party_connect_step_ble
                    : ETranslations.hardware_third_party_connect_step_usb,
                })}`}
              </SizableText>
              <SizableText color="$textSubdued">
                {`2. ${intl.formatMessage({
                  id: ETranslations.hardware_third_party_connect_step_power_on_and_unlock,
                })}`}
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

        {connectStatus === EConnectionStatus.listing ||
        sortedDevicesData.length > 0 ? (
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
                      <WalletAvatar wallet={undefined} img="ledger" />
                      <ListItem.Text primary={data.device?.name} flex={1} />
                    </ListItem>
                  ))}
                </>
              ) : null}
            </HeightTransition>
          </ConnectionIndicator.Footer>
        ) : null}
      </ConnectionIndicator>
    </>
  );
}
