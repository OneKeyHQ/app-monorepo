import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Button,
  HeightTransition,
  Image,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
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

import { ConnectionIndicator } from './ConnectYourDevice';
import { shouldRequestTrezorWebUsbPermissionBeforeListing } from './ConnectionFlowTrezorUtils';

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

// No motion graphic for Trezor yet — use the same pick-trezor image we use
// in the brand picker as a placeholder. Drop in a Video if/when a Trezor
// onboarding clip lands in assets/onboarding/.
function DevicePlaceholder() {
  return (
    <Stack
      w="100%"
      h="100%"
      alignItems="center"
      justifyContent="center"
      bg="$bgSubdued"
    >
      <Image
        source={require('@onekeyhq/kit/assets/pick-trezor.png')}
        width="60%"
        height="60%"
        resizeMode="contain"
      />
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
  const isBle = platformEnv.isNative;

  // --- Device connection state ---
  const [connectStatus, setConnectStatus] = useState(EConnectionStatus.init);
  const [searchedDevices, setSearchedDevices] = useState<SearchDevice[]>([]);
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

    const MAX_TRY_COUNT = 60;
    let pollsCompleted = 0;
    const scanStartedAt = Date.now();

    isSearchingRef.current = true;
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
          const error = convertDeviceError(response.payload);
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

        if (pollsCompleted >= MAX_TRY_COUNT) {
          isSearchingRef.current = false;
          if (sortedDevices.length === 0) {
            setConnectStatus(EConnectionStatus.init);
          }
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
      1500,
      MAX_TRY_COUNT,
      vendor,
      { resetSession: true },
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
    setConnectStatus(EConnectionStatus.listing);
    await scanDevice();
  }, [scanDevice]);

  // --- Start connection ---
  // Extension needs a click-bound user gesture for WebUSB permission. Desktop
  // keeps the lower-noise Ledger-style flow and scans already visible devices.
  const onStartConnection = useCallback(async () => {
    if (
      shouldRequestTrezorWebUsbPermissionBeforeListing({
        isExtension: !!platformEnv.isExtension,
      })
    ) {
      setIsChecking(true);
      try {
        const usbDevice = await promptWebUsbDeviceAccess(
          EHardwareVendor.trezor,
        );
        if (usbDevice) {
          setIsChecking(false);
          void listingDevice();
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        traceTrezorOnboarding('flow.webusb.permission.error', {
          message: (error as Error)?.message ?? String(error),
        });
        setIsChecking(false);
      }
    } else {
      void listingDevice();
    }
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
          <DevicePlaceholder />
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
                    <WalletAvatar wallet={undefined} img="trezor" />
                    <ListItem.Text primary={data.device?.name} flex={1} />
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
