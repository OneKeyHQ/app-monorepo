import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { WalletIdentity } from '@onekeyfe/hwk-adapter-core';

// Reuse SDK proof formats without coupling a verification method to a brand.
export type IDeviceBindingIdentity = {
  [T in WalletIdentity['type']]: Omit<
    Extract<WalletIdentity, { type: T }>,
    'vendor'
  >;
}[WalletIdentity['type']];

export type IVerifiedDeviceIdentity = {
  vendor: EHardwareVendor;
  identity: IDeviceBindingIdentity;
};

export function matchesVerifiedDeviceIdentity(
  record: {
    vendor?: EHardwareVendor;
    deviceId?: string;
    connectId?: string;
    chainFingerprints?: Record<string, string>;
  },
  verification: IVerifiedDeviceIdentity,
): boolean {
  const { identity, vendor } = verification;
  if (!vendor || !identity?.value || record.vendor !== vendor) return false;

  switch (identity.type) {
    case 'chainFingerprint':
      return Boolean(
        identity.chain &&
        record.chainFingerprints?.[identity.chain] === identity.value,
      );
    case 'deviceId':
      return record.deviceId === identity.value;
    case 'walletId':
      return record.connectId === identity.value;
    default:
      // A newer SDK must not silently bypass verification in an older host.
      return false;
  }
}
