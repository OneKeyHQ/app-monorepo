import { deriveDeviceFingerprint } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function getInitialBleTestIdentity(
  vendor: EHardwareVendor,
  deviceId: string,
): string {
  // Ledger discovery returns a transport ID, not an expected wallet fingerprint.
  return vendor === EHardwareVendor.ledger ? '' : deviceId;
}

export function getBleTestAddressIdentity(
  vendor: EHardwareVendor,
  deviceId: string,
  address: string,
): string {
  return vendor === EHardwareVendor.ledger
    ? deriveDeviceFingerprint(address.toLowerCase())
    : deviceId;
}
