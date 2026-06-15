import type { IHardwareErrorDialogPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

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
