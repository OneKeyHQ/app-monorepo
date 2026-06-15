import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Button,
  HeightTransition,
  Image,
  LottieView,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import BluetoothSignalSpreading from '@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json';
import { usePromptWebDeviceAccess } from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import { ThirdPartyDevicePermissionDenied } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

enum EConnectionStatus {
  init = 'init',
  searching = 'searching',
  listing = 'listing',
}

function traceTrezorOnboarding(event: string, data?: Record<string, unknown>) {
  let dataText = '';
  if (data) {
    try {
      dataText = ` ${JSON.stringify(data)}`;
    } catch {
      dataText = ' {"stringifyError":true}';
    }
  }
  defaultLogger.hardware.sdkLog.log(
    `[TrezorOnboardingTrace][${event}]${dataText}`,
  );
}

function DevicePlaceholder({ isBle }: { isBle: boolean }) {
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
        <Image
          source={require('@onekeyhq/kit/assets/pick-trezor.png')}
          width="60%"
          height="60%"
          resizeMode="contain"
        />
      )}
    </Stack>
  );
}

function getTrezorDeviceDebugPayload(device: IConnectYourDeviceItem['device']) {
  const raw = (device as { raw?: Record<string, unknown> } | undefined)?.raw;
  const vendorRaw = raw?.vendorRaw as
    | { features?: { device_id?: unknown } }
    | undefined;
  return {
    connectId: device?.connectId,
    deviceId: device?.deviceId,
    name: device?.name,
    uuid: device?.uuid,
    deviceType: device?.deviceType,
    commType: device?.commType,
    vendorModel: (device as { vendorModel?: string } | undefined)?.vendorModel,
    vendorModelName: (device as { vendorModelName?: string } | undefined)
      ?.vendorModelName,
    rawConnectId: (raw as { connectId?: string } | undefined)?.connectId,
    rawDeviceId: (raw as { deviceId?: string } | undefined)?.deviceId,
    rawSerialNumber: (raw as { serialNumber?: string } | undefined)
      ?.serialNumber,
    rawConnectionType: (raw as { connectionType?: string } | undefined)
      ?.connectionType,
    rawVendorFeaturesDeviceId:
      typeof vendorRaw?.features?.device_id === 'string'
        ? vendorRaw.features.device_id
        : undefined,
  };
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
  const currentPollStartedAtRef = useRef<number | undefined>(undefined);
  const searchSequenceRef = useRef(0);

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
    const scanStartedAt = Date.now();
    const transportType = getTrezorSearchTransportType(forceTransportType);

    isSearchingRef.current = true;
    setScanTimedOut(false);
    searchSequenceRef.current = 0;
    deviceScanner.startDeviceScan(
      (response) => {
        pollsCompleted += 1;
        const pollDurationMs =
          typeof currentPollStartedAtRef.current === 'number'
            ? Date.now() - currentPollStartedAtRef.current
            : undefined;
        if (!response.success) {
          traceTrezorOnboarding('flow.scan.response', {
            success: false,
            poll: pollsCompleted,
            pollDurationMs,
            totalDurationMs: Date.now() - scanStartedAt,
            payload: response.payload,
          });
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
        traceTrezorOnboarding('flow.scan.response', {
          success: true,
          poll: pollsCompleted,
          pollDurationMs,
          totalDurationMs: Date.now() - scanStartedAt,
          count: sortedDevices.length,
        });
        traceTrezorOnboarding('flow.scan.sorted', {
          devices: sortedDevices.map((device) =>
            getTrezorDeviceDebugPayload(device),
          ),
        });

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
          traceTrezorOnboarding('flow.scan.timeout', {
            pollsCompleted,
            totalDurationMs: Date.now() - scanStartedAt,
          });
        } else if (pollsCompleted >= TREZOR_SCAN_MAX_TRY_COUNT) {
          isSearchingRef.current = false;
          deviceScanner.stopScan();
        }
      },
      (state) => {
        searchStateRef.current = state;
        if (state === 'start') {
          searchSequenceRef.current += 1;
          currentPollStartedAtRef.current = Date.now();
          traceTrezorOnboarding('flow.scan.poll.start', {
            poll: searchSequenceRef.current,
            vendor,
            tabValue,
            forceTransportType,
            transportType,
          });
        } else {
          traceTrezorOnboarding('flow.scan.poll.stop', {
            poll: searchSequenceRef.current,
            durationMs:
              typeof currentPollStartedAtRef.current === 'number'
                ? Date.now() - currentPollStartedAtRef.current
                : undefined,
          });
        }
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
      traceTrezorOnboarding('flow.select.route', {
        title: data.title,
        device: getTrezorDeviceDebugPayload(data.device),
        vendor: EHardwareVendor.trezor,
        tabValue,
      });

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
      } catch (error) {
        traceTrezorOnboarding('flow.webusb.permission.error', {
          message: (error as Error)?.message ?? String(error),
        });
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
                    key={data.device?.deviceId}
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
