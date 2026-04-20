import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export interface IHardwareVendorProfile {
  vendor: EHardwareVendor;
  /** Whether this is a third-party (non-OneKey) vendor */
  isThirdParty: boolean;
  /** Default device name when no label is available */
  defaultDeviceName: string;
  /** Avatar key used for wallet avatar; empty means derived from deviceType */
  avatarKey: string;
  /** Whether the device supports entering PIN via software (on-screen) */
  supportsSoftwarePin: boolean;
  /** Whether an app must be open on the device before operations */
  requiresAppOpen: boolean;
  /** Whether the connectId persists across sessions for the given transport */
  hasPersistentConnectId(transport: 'usb' | 'ble'): boolean;
  /** Whether the deviceId persists across sessions for the given transport */
  hasPersistentDeviceId(transport: 'usb' | 'ble'): boolean;
  /** Whether this vendor's wallets support cloud sync */
  supportsCloudSync: boolean;
  /**
   * Whether a given connectId can be used to identify an existing device.
   * BLE connectId (e.g. "A58F") is persistent — can match.
   * USB connectId (e.g. UUID) is ephemeral — cannot match.
   */
  canMatchDeviceByConnectId(connectId: string): boolean;
}

const onekeyProfile: IHardwareVendorProfile = {
  vendor: EHardwareVendor.onekey,
  isThirdParty: false,
  defaultDeviceName: '',
  avatarKey: '',
  supportsSoftwarePin: true,
  requiresAppOpen: false,
  hasPersistentConnectId: () => true,
  hasPersistentDeviceId: () => true,
  supportsCloudSync: true,
  // OneKey always has device_id, so this path isn't used
  canMatchDeviceByConnectId: () => true,
};

const ledgerProfile: IHardwareVendorProfile = {
  vendor: EHardwareVendor.ledger,
  isThirdParty: true,
  defaultDeviceName: 'Ledger',
  avatarKey: 'ledger',
  supportsSoftwarePin: false,
  requiresAppOpen: true,
  hasPersistentConnectId: (transport) => transport === 'ble',
  hasPersistentDeviceId: () => false,
  supportsCloudSync: false,
  // Ledger BLE connectId is a 4-digit HEX (e.g. "A58F") — persistent, can match.
  // USB connectId is a DMK UUID — ephemeral, cannot match.
  canMatchDeviceByConnectId: (connectId) => /^[0-9A-Fa-f]{4}$/.test(connectId),
};

// TODO: Trezor profile stub — re-add when Trezor UI integration is implemented

const vendorProfiles: Record<EHardwareVendor, IHardwareVendorProfile> = {
  [EHardwareVendor.onekey]: onekeyProfile,
  [EHardwareVendor.ledger]: ledgerProfile,
  // Trezor falls back to onekeyProfile via getVendorProfile() until re-implemented
  [EHardwareVendor.trezor]: onekeyProfile,
};

export function getVendorProfile(
  vendor: EHardwareVendor,
): IHardwareVendorProfile {
  return vendorProfiles[vendor] ?? onekeyProfile;
}
