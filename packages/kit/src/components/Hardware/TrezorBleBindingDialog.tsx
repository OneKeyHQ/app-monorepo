import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  LottieView,
  SizableText,
  Spinner,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import BluetoothSignalSpreading from '@onekeyhq/kit/assets/animations/bluetooth_signal_spreading.json';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  MacBluetoothIllustrationViews,
  WindowsBluetoothIllustrationViews,
} from './Hardware';
import {
  buildTrezorBleBindingCandidates,
  findTrezorAutoFallbackConnectId,
  getTrezorBleBindingCandidateState,
  getTrezorBleBindingScanOptions,
} from './trezorBleBindingUtils';
import {
  TREZOR_SCAN_MAX_TRY_COUNT,
  TREZOR_SCAN_POLL_INTERVAL_MS,
  shouldShowTrezorScanTimeout,
} from './trezorScanUtils';

import type {
  ITrezorBleBindingMode,
  ITrezorBleBindingScannedDevice,
} from './trezorBleBindingUtils';
import type { IntlShape } from 'react-intl';

export interface ITrezorBleBindingParams {
  // USB-side identity of the already-known device (read from its IDBDevice).
  usbConnectId: string;
  featuresDeviceId: string;
  // Called with the connectId that should be used after this dialog settles.
  onBound?: (connectId: string) => void;
  onClose?: () => void | Promise<void>;
  mode?: ITrezorBleBindingMode;
}

function PairingGuideStep({ number, text }: { number: number; text: string }) {
  return (
    <XStack gap="$2" alignItems="flex-start">
      <YStack w="$5" alignItems="center" justifyContent="center">
        <SizableText color="$textDisabled">{number}.</SizableText>
      </YStack>
      <SizableText flex={1}>{text}</SizableText>
    </XStack>
  );
}

function TrezorBleBindingIllustration() {
  if (platformEnv.isNative) {
    return (
      <YStack
        h={178}
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        <LottieView
          source={BluetoothSignalSpreading}
          width={280}
          height={280}
          autoPlay
          loop
        />
      </YStack>
    );
  }

  return platformEnv.isDesktopWin ? (
    <WindowsBluetoothIllustrationViews view="paring" />
  ) : (
    <MacBluetoothIllustrationViews view="paring" />
  );
}

// Trezor scan cannot identify BLE candidates up front; selected BLE devices are
// probed and matched by features device_id before their connectId is persisted.
function TrezorBleBindingContent({
  usbConnectId,
  featuresDeviceId,
  onBound,
  mode = 'manual-binding',
}: ITrezorBleBindingParams) {
  const intl = useIntl();
  const dialog = useDialogInstance();

  const [devices, setDevices] = useState<ITrezorBleBindingScannedDevice[]>([]);
  const [scanTimedOut, setScanTimedOut] = useState(false);
  // BLE candidates that were probed and did not match this device_id. Keep
  // them visible but disabled so the user can continue with the next one.
  const [rejectedConnectIds, setRejectedConnectIds] = useState<
    Record<string, true>
  >({});
  // The bleConnectId currently being probed/bound (one at a time).
  const [bindingId, setBindingId] = useState<string | null>(null);
  const isSearchingRef = useRef(false);
  // Tracks mount state so an in-flight bind that resolves after the dialog is
  // closed doesn't restart a scan nothing will stop (leaked scanner).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const deviceScanner = useMemo(
    () =>
      deviceUtils.getDeviceScanner({
        backgroundApi: backgroundApiProxy,
      }),
    [],
  );

  const stopScan = useCallback(async () => {
    isSearchingRef.current = false;
    try {
      await deviceScanner.stopScanAndWait();
    } catch {
      deviceScanner.stopScan();
    }
  }, [deviceScanner]);

  const scanDevice = useCallback(() => {
    if (isSearchingRef.current) {
      return;
    }
    isSearchingRef.current = true;
    setScanTimedOut(false);

    let pollsCompleted = 0;

    deviceScanner.startDeviceScan(
      (response) => {
        pollsCompleted += 1;
        if (!response.success) {
          const error = convertDeviceError(response.payload, {
            silentMode: true,
            vendor: EHardwareVendor.trezor,
          });
          Toast.error({
            title:
              error.message ||
              intl.formatMessage({
                id: ETranslations.hardware_third_party_device_scan_error,
              }),
          });
          isSearchingRef.current = false;
          deviceScanner.stopScan();
          return;
        }

        const scannedDevices =
          response.payload as ITrezorBleBindingScannedDevice[];
        const autoFallbackConnectId = findTrezorAutoFallbackConnectId({
          mode,
          devices: scannedDevices,
          usbConnectId,
        });
        if (autoFallbackConnectId) {
          isSearchingRef.current = false;
          deviceScanner.stopScan();
          onBound?.(autoFallbackConnectId);
          void dialog.close();
          return;
        }

        const candidates = buildTrezorBleBindingCandidates({
          devices: scannedDevices,
          usbConnectId,
        });
        setDevices(candidates);

        if (
          shouldShowTrezorScanTimeout({
            pollsCompleted,
            deviceCount: candidates.length,
          })
        ) {
          isSearchingRef.current = false;
          deviceScanner.stopScan();
          setScanTimedOut(true);
        } else if (pollsCompleted >= TREZOR_SCAN_MAX_TRY_COUNT) {
          isSearchingRef.current = false;
          deviceScanner.stopScan();
        }
      },
      () => {},
      1,
      TREZOR_SCAN_POLL_INTERVAL_MS,
      TREZOR_SCAN_MAX_TRY_COUNT,
      EHardwareVendor.trezor,
      getTrezorBleBindingScanOptions(mode),
    );
  }, [deviceScanner, dialog, intl, mode, onBound, usbConnectId]);

  const handleRetryScan = useCallback(() => {
    setDevices([]);
    setScanTimedOut(false);
    scanDevice();
  }, [scanDevice]);

  const handlePick = useCallback(
    async (device: ITrezorBleBindingScannedDevice) => {
      const bleConnectId = device.connectId;
      if (!bleConnectId || bindingId || rejectedConnectIds[bleConnectId]) {
        return;
      }

      setBindingId(bleConnectId);
      // Free the BLE transport before the bind probe connects to the candidate.
      await stopScan();
      let shouldResumeScan = true;

      try {
        const bound =
          await backgroundApiProxy.serviceThirdPartyHardware.bindTrezorBleConnectId(
            {
              usbConnectId,
              featuresDeviceId,
              bleConnectId,
            },
          );

        if (bound) {
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
          shouldResumeScan = false;
          onBound?.(bound);
          await dialog.close();
          return;
        }

        // device_id mismatch / candidate asked to pair → not this one.
        setRejectedConnectIds((prev) => ({ ...prev, [bleConnectId]: true }));
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.hardware_third_party_device_mismatch,
          }),
        });
      } catch (error) {
        Toast.error({
          title:
            (error as Error)?.message ||
            intl.formatMessage({
              id: ETranslations.hardware_connect_failed,
            }),
        });
      } finally {
        setBindingId(null);
        // Skip the resume if the dialog was closed mid-bind — the unmount
        // cleanup already stopped scanning and nothing would stop a new scan.
        if (shouldResumeScan && isMountedRef.current) {
          // Resume scanning so the user can pick again.
          scanDevice();
        }
      }
    },
    [
      bindingId,
      stopScan,
      rejectedConnectIds,
      usbConnectId,
      featuresDeviceId,
      onBound,
      dialog,
      intl,
      scanDevice,
    ],
  );

  useEffect(() => {
    scanDevice();
    return () => {
      void stopScan();
    };
  }, [scanDevice, stopScan]);

  const emptyStateContent = scanTimedOut ? (
    <YStack px="$5" py="$3" gap="$3">
      <SizableText color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.trezor_ble_binding_scan_timeout__msg,
        })}
      </SizableText>
      <Button
        testID="trezor-ble-binding-retry"
        variant="primary"
        onPress={handleRetryScan}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </YStack>
  ) : (
    <XStack px="$5" py="$3" gap="$3" alignItems="center">
      <Spinner size="small" />
      <SizableText color="$textSubdued" flex={1}>
        {intl.formatMessage({
          id: ETranslations.trezor_ble_binding_searching__desc,
        })}
      </SizableText>
    </XStack>
  );

  return (
    <YStack gap="$5">
      <TrezorBleBindingIllustration />
      <SizableText size="$bodyMdMedium">
        {intl.formatMessage({
          id: ETranslations.trezor_ble_binding__desc,
        })}
      </SizableText>
      <YStack gap="$2">
        <PairingGuideStep
          number={1}
          text={intl.formatMessage({
            id: ETranslations.trezor_ble_binding_guide_unlock__desc,
          })}
        />
        <PairingGuideStep
          number={2}
          text={intl.formatMessage({
            id: ETranslations.trezor_ble_binding_guide_pair__desc,
          })}
        />
        {platformEnv.isNative ? null : (
          <PairingGuideStep
            number={3}
            text={intl.formatMessage({
              id: ETranslations.trezor_ble_binding_guide_select__desc,
            })}
          />
        )}
      </YStack>
      <YStack mx="$-5" minHeight="$20">
        {devices.length === 0
          ? emptyStateContent
          : devices.map((device) => {
              const { isBinding, isRejected, disabled, drillIn, opacity } =
                getTrezorBleBindingCandidateState({
                  connectId: device.connectId,
                  bindingId,
                  rejectedConnectIds,
                });
              return (
                <ListItem
                  key={device.connectId}
                  drillIn={drillIn}
                  disabled={disabled}
                  opacity={opacity}
                  onPress={async () => {
                    await handlePick(device);
                  }}
                  userSelect="none"
                >
                  <WalletAvatar wallet={undefined} img="trezor" />
                  <ListItem.Text
                    primary={device.name}
                    secondary={
                      isRejected
                        ? intl.formatMessage({
                            id: ETranslations.hardware_connect_failed,
                          })
                        : undefined
                    }
                    flex={1}
                  />
                  {isBinding ? <Spinner size="small" /> : null}
                </ListItem>
              );
            })}
      </YStack>
    </YStack>
  );
}

export function showTrezorBleBindingDialog({
  onClose,
  intl,
  ...params
}: ITrezorBleBindingParams & { intl: IntlShape }) {
  return Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.trezor_ble_binding__title,
    }),
    showFooter: false,
    renderContent: <TrezorBleBindingContent {...params} />,
    onClose,
  });
}
