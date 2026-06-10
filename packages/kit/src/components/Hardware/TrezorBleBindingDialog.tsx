import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  SizableText,
  Spinner,
  Toast,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  MacBluetoothIllustrationViews,
  WindowsBluetoothIllustrationViews,
} from './Hardware';
import {
  buildTrezorBleBindingCandidates,
  getTrezorBleBindingCandidateState,
} from './trezorBleBindingUtils';

import type { ITrezorBleBindingScannedDevice } from './trezorBleBindingUtils';

export interface ITrezorBleBindingParams {
  // USB-side identity of the already-known device (read from its IDBDevice).
  usbConnectId: string;
  featuresDeviceId: string;
  // Called with the bound bleConnectId on success (e.g. to refresh the UI).
  onBound?: (bleConnectId: string) => void;
  onClose?: () => void | Promise<void>;
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

// ---------------------------------------------------------------------------
// Trezor USB→BLE binding picker. Copies the OneKey scan→list→select shape from
// ConnectionFlowTrezor / OtherDevicesDialog, with one Trezor-specific twist:
// Trezor has NO ble_name, so the host CANNOT identify a BLE device at scan
// time. The user picks a candidate, and bindTrezorBleConnectId connects to it,
// reads device_id, and only persists bleConnectId when it matches the
// USB-known device. A mismatch (or a device that asks to pair) is rejected so
// the user can pick another. 100% Trezor-side; never touches OneKey / Ledger.
// ---------------------------------------------------------------------------
function TrezorBleBindingContent({
  usbConnectId,
  featuresDeviceId,
  onBound,
}: ITrezorBleBindingParams) {
  const intl = useIntl();
  const dialog = useDialogInstance();

  const [devices, setDevices] = useState<ITrezorBleBindingScannedDevice[]>([]);
  // BLE candidates that were probed and did not match this device_id. Keep
  // them visible but disabled so the user can continue with the next one.
  const [rejectedConnectIds, setRejectedConnectIds] = useState<
    Record<string, true>
  >({});
  // The bleConnectId currently being probed/bound (one at a time).
  const [bindingId, setBindingId] = useState<string | null>(null);
  const isSearchingRef = useRef(false);

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

    const MAX_TRY_COUNT = 60;
    let pollsCompleted = 0;

    deviceScanner.startDeviceScan(
      (response) => {
        pollsCompleted += 1;
        if (!response.success) {
          const error = convertDeviceError(response.payload);
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

        setDevices(
          buildTrezorBleBindingCandidates({
            devices: response.payload as ITrezorBleBindingScannedDevice[],
            usbConnectId,
          }),
        );

        if (pollsCompleted >= MAX_TRY_COUNT) {
          isSearchingRef.current = false;
        }
      },
      () => {},
      1,
      1500,
      MAX_TRY_COUNT,
      EHardwareVendor.trezor,
      { resetSession: true, waitForAllTransports: true },
    );
  }, [deviceScanner, intl, usbConnectId]);

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
            id: ETranslations.hardware_connect_failed,
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
        if (shouldResumeScan) {
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

  return (
    <YStack gap="$5">
      {platformEnv.isDesktopWin ? (
        <WindowsBluetoothIllustrationViews view="paring" />
      ) : (
        <MacBluetoothIllustrationViews view="paring" />
      )}
      <SizableText size="$bodyMdMedium">
        {intl.formatMessage({
          id: ETranslationsMock.trezor_ble_binding_desc,
        })}
      </SizableText>
      <YStack gap="$2">
        <PairingGuideStep
          number={1}
          text={intl.formatMessage({
            id: ETranslationsMock.trezor_ble_binding_guide_unlock,
          })}
        />
        <PairingGuideStep
          number={2}
          text={intl.formatMessage({
            id: ETranslationsMock.trezor_ble_binding_guide_pair,
          })}
        />
        <PairingGuideStep
          number={3}
          text={intl.formatMessage({
            id: ETranslationsMock.trezor_ble_binding_guide_select,
          })}
        />
      </YStack>
      <YStack mx="$-5" minHeight="$20">
        {devices.length === 0 ? (
          <XStack px="$5" py="$3" gap="$3" alignItems="center">
            <Spinner size="small" />
            <SizableText color="$textSubdued" flex={1}>
              {intl.formatMessage({
                id: ETranslationsMock.trezor_ble_binding_searching,
              })}
            </SizableText>
          </XStack>
        ) : (
          devices.map((device) => {
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
          })
        )}
      </YStack>
    </YStack>
  );
}

export function showTrezorBleBindingDialog({
  onClose,
  ...params
}: ITrezorBleBindingParams) {
  return Dialog.show({
    title: ETranslationsMock.trezor_ble_binding_title,
    showFooter: false,
    renderContent: <TrezorBleBindingContent {...params} />,
    onClose,
  });
}
