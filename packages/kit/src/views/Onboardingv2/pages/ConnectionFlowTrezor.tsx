import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Button,
  EVideoResizeMode,
  HeightTransition,
  LottieView,
  SizableText,
  Stack,
  Toast,
  Video,
  XStack,
  YStack,
} from '@onekeyhq/components';
import BluetoothSignalSpreading from '@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json';
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
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { getForceTransportType, sortDevicesData } from '../utils';

import {
  TREZOR_SCAN_MAX_TRY_COUNT,
  TREZOR_SCAN_POLL_INTERVAL_MS,
  getTrezorSearchTransportType,
  shouldRequestTrezorWebUsbPermissionBeforeListing,
  shouldShowTrezorScanTimeout,
} from './ConnectionFlowTrezorUtils';
import { ConnectionIndicator } from './ConnectYourDevice';

import type { SearchDevice } from '@onekeyfe/hd-core';
import type { ReactVideoSource } from 'react-native-video';

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}

function DevicePlaceholder({ isBle }: { isBle: boolean }) {
  const themeVariant = useThemeVariant();
  const videoSource = useMemo<ReactVideoSource>(
    () =>
      themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/onboarding/Connect-Trezor-D.mp4') as ReactVideoSource)
        : (require('@onekeyhq/kit/assets/onboarding/Connect-Trezor-L.mp4') as ReactVideoSource),
    [themeVariant],
  );
  return (
    <Stack
      w="100%"
      h="100%"
      alignItems="center"
      justifyContent="center"
      bg="$bgSubdued"
    >
      {isBle ? (
        <LottieView
          source={BluetoothSignalSpreading}
          width={320}
          height={320}
          autoPlay
          loop
        />
      ) : (
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
      )}
    </Stack>
  );
}

function getTrezorDeviceTransportLabel(
  device: IConnectYourDeviceItem['device'],
) {
  const raw = (device as { raw?: Record<string, unknown> } | undefined)?.raw;
  const connectionType =
    raw?.connectionType ??
    (device as { connectionType?: unknown } | undefined)?.connectionType;
  if (connectionType === 'usb') return 'USB';
  if (connectionType === 'ble') return 'BLE';
  return undefined;
}

function TrezorDeviceTransportBadge({
  device,
}: {
  device: IConnectYourDeviceItem['device'];
}) {
  const label = getTrezorDeviceTransportLabel(device);
  if (!label) return null;
  return (
    <XStack
      px="$2"
      py="$0.5"
      borderRadius="$1"
      bg="$bgSubdued"
      alignItems="center"
      justifyContent="center"
    >
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {label}
      </SizableText>
    </XStack>
  );
}

// ---------------------------------------------------------------------------
// Trezor connection flow — mirrors LedgerConnectionFlow with three swaps:
//   1. vendor = EHardwareVendor.trezor (drives serviceHardware scan path)
//   2. promptWebUsbDeviceAccess instead of promptHidDeviceAccess (we use
//      WebUSB; Ledger uses WebHID — both need a click-bound permission
//      gesture before the picker is allowed to open)
//   3. Avatar / image / label = Trezor
// ---------------------------------------------------------------------------

export default function TrezorConnectionFlow() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useIsFocused();
  const { promptWebUsbDeviceAccess } = usePromptWebDeviceAccess();

  const vendor = EHardwareVendor.trezor;
  const tabValue = EConnectDeviceChannel.usbOrBle;
  const deviceLabel = 'Trezor';
  const isBle = !!platformEnv.isNative;
  const connectionSteps = isBle
    ? [
        ETranslations.trezor_ble_binding_guide_unlock__desc,
        ETranslations.trezor_ble_binding_guide_pair__desc,
      ]
    : [
        ETranslations.hardware_third_party_connect_step_usb,
        ETranslations.hardware_third_party_connect_step_power_on_and_unlock,
      ];

  // --- Device connection state ---
  const [connectStatus, setConnectStatus] = useState(EConnectionStatus.init);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);
  const [scanTimedOut, setScanTimedOut] = useState(false);
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

  // --- Scan logic ---
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

    let pollsCompleted = 0;
    const transportType = getTrezorSearchTransportType(forceTransportType);

    isSearchingRef.current = true;
    setScanTimedOut(false);
    deviceScanner.startDeviceScan(
      (response) => {
        pollsCompleted += 1;
        if (!response.success) {
          const error = convertDeviceError(response.payload, {
            vendor: EHardwareVendor.trezor,
          });
          if (!(error instanceof ThirdPartyDevicePermissionDenied)) {
            Toast.error({
              title:
                error.message ||
                intl.formatMessage({
                  id: ETranslations.hardware_third_party_device_scan_error,
                }),
            });
          }
          isSearchingRef.current = false;
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

        if (
          shouldShowTrezorScanTimeout({
            pollsCompleted,
            deviceCount: sortedDevices.length,
          })
        ) {
          isSearchingRef.current = false;
          setConnectStatus(EConnectionStatus.init);
          setScanTimedOut(true);
          deviceScanner.stopScan();
        } else if (pollsCompleted >= TREZOR_SCAN_MAX_TRY_COUNT) {
          isSearchingRef.current = false;
          deviceScanner.stopScan();
        }
      },
      (state) => {
        searchStateRef.current = state;
      },
      1,
      TREZOR_SCAN_POLL_INTERVAL_MS,
      TREZOR_SCAN_MAX_TRY_COUNT,
      vendor,
      { resetSession: true, transportType },
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
        src: ThirdPartyWalletAvatarImages.trezor,
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
          vendor: EHardwareVendor.trezor,
        },
        isFirmwareVerified: true,
        tabValue,
      });
    },
    [ensureStopScan, navigation, tabValue],
  );

  // --- Listing mode ---
  const listingDevice = useCallback(async () => {
    setSearchedDevices([]);
    setScanTimedOut(false);
    setConnectStatus(EConnectionStatus.listing);
    await scanDevice();
  }, [scanDevice]);

  // --- Start connection ---
  // WebUSB only lists previously authorized devices, so desktop/extension need
  // a click-bound picker before scan. Desktop keeps scanning after a picker
  // cancel so BLE-only users are not blocked by USB permission.
  const onStartConnection = useCallback(async () => {
    if (
      shouldRequestTrezorWebUsbPermissionBeforeListing({
        isDesktop: !!platformEnv.isDesktop,
        isExtension: !!platformEnv.isExtension,
      })
    ) {
      setIsChecking(true);
      try {
        await promptWebUsbDeviceAccess(EHardwareVendor.trezor);
      } catch {
        if (!platformEnv.isDesktop) {
          setIsChecking(false);
          return;
        }
      } finally {
        setIsChecking(false);
      }
    }
    void listingDevice();
  }, [promptWebUsbDeviceAccess, listingDevice]);

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

  return (
    <ConnectionIndicator>
      <ConnectionIndicator.Card>
        <ConnectionIndicator.Animation>
          <DevicePlaceholder isBle={isBle} />
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
            {connectionSteps.map((id, index) => (
              <SizableText key={id} color="$textSubdued">
                {`${index + 1}. ${intl.formatMessage({ id })}`}
              </SizableText>
            ))}
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: isBle
                  ? ETranslations.trezor_ble_binding__desc
                  : ETranslations.trezor_onboarding_unlock_after_power_on__desc,
              })}
            </SizableText>
          </YStack>
          {connectStatus === EConnectionStatus.init ? (
            <Button
              testID="trezor-start-connection"
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
          ) : null}
          {scanTimedOut ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: isBle
                  ? ETranslations.trezor_ble_binding_scan_timeout__msg
                  : ETranslations.trezor_onboarding_scan_timeout__msg,
              })}
            </SizableText>
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
                    id: isBle
                      ? ETranslations.trezor_ble_binding_searching__desc
                      : ETranslations.onboarding_bluetooth_connect_help_text,
                  })}
                  {isBle ? '' : '...'}
                </SizableText>
              </XStack>
            </YStack>
          ) : null}
          <HeightTransition initialHeight={0}>
            {sortedDevicesData.length > 0 ? (
              <>
                {sortedDevicesData.map((data) => (
                  <ListItem
                    // Desktop fused scan returns one USB row and one BLE row for
                    // the same physical Trezor, sharing the same stable deviceId
                    // (== connectId). Key on deviceId + transport so the two rows
                    // stay distinct React nodes instead of collapsing into one.
                    key={`${data.device?.deviceId ?? data.device?.connectId ?? ''}-${
                      getTrezorDeviceTransportLabel(data.device) ?? ''
                    }`}
                    drillIn
                    onPress={async () => {
                      await handleDeviceSelect(data);
                    }}
                    userSelect="none"
                  >
                    <WalletAvatar wallet={undefined} img="trezor" />
                    <ListItem.Text primary={data.device?.name} flex={1} />
                    <TrezorDeviceTransportBadge device={data.device} />
                  </ListItem>
                ))}
              </>
            ) : null}
          </HeightTransition>
        </ConnectionIndicator.Footer>
      ) : null}
    </ConnectionIndicator>
  );
}
