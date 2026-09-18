import { throttle } from 'lodash';

import type { IHardwareErrorDialogPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { HARDWARE_ERROR_DIALOG_TYPES } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function createHardwareErrorDialogEventHandler(
  handleHardwareErrorDialog: (payload: IHardwareErrorDialogPayload) => void,
  throttleDuration: number,
) {
  const throttledDeviceNotFound = throttle(
    handleHardwareErrorDialog,
    throttleDuration,
    {
      leading: true,
      trailing: false,
    },
  );

  return Object.assign(
    (payload: IHardwareErrorDialogPayload) => {
      if (
        payload.errorType === HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR
      ) {
        handleHardwareErrorDialog(payload);
        return;
      }

      if (payload.errorType === HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND) {
        throttledDeviceNotFound(payload);
      }
    },
    { cancel: () => throttledDeviceNotFound.cancel() },
  );
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function getVendorFromPayload(payload: IHardwareErrorDialogPayload): unknown {
  const record = getRecord(payload.payload);
  const params = getRecord(record?.params);

  return payload.vendor ?? record?.vendor ?? params?.vendor;
}

export function isTrezorHardwareErrorDialogPayload(
  payload: IHardwareErrorDialogPayload,
): boolean {
  const vendor = getVendorFromPayload(payload);

  return vendor === EHardwareVendor.trezor || vendor === 'Trezor';
}

export function shouldReplaceHardwareErrorDialog({
  currentErrorType,
  nextErrorType,
}: {
  currentErrorType: string | null;
  nextErrorType: string;
}): boolean {
  return (
    nextErrorType === HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR &&
    currentErrorType !== HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR
  );
}
