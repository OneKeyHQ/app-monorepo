import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { OneKeyInternalError } from '../errors';

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
  /** Whether a connectId can be used to identify an existing device.
   *  BLE: persistent (MAC/UUID). USB: ephemeral, won't match anything anyway. */
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
  // BLE: DMK transport path (MAC/UUID), persistent. USB: ephemeral UUID, never matches.
  canMatchDeviceByConnectId: (connectId) => Boolean(connectId),
};

// Trezor stub — isThirdParty=true so it won't be treated as OneKey device.
// Full profile will be filled when Trezor adapter/keyrings are re-integrated.
const trezorProfileStub: IHardwareVendorProfile = {
  vendor: EHardwareVendor.trezor,
  isThirdParty: true,
  defaultDeviceName: 'Trezor',
  avatarKey: '',
  supportsSoftwarePin: false,
  requiresAppOpen: false,
  hasPersistentConnectId: () => true,
  hasPersistentDeviceId: () => true,
  supportsCloudSync: false,
  canMatchDeviceByConnectId: () => true,
};

const vendorProfiles: Record<EHardwareVendor, IHardwareVendorProfile> = {
  [EHardwareVendor.onekey]: onekeyProfile,
  [EHardwareVendor.ledger]: ledgerProfile,
  [EHardwareVendor.trezor]: trezorProfileStub,
};

export function getVendorProfile(
  vendor: EHardwareVendor | undefined | null,
): IHardwareVendorProfile {
  // No vendor field means OneKey (legacy rows + callers that don't deal with
  // third-party). Explicit `EHardwareVendor.onekey` also lands here via the
  // lookup below. Any other value must have its profile registered.
  if (!vendor) return onekeyProfile;
  const profile = vendorProfiles[vendor];
  if (!profile) {
    throw new OneKeyInternalError(
      `Unknown hardware vendor: "${vendor}". Register its profile in packages/shared/src/hardware/vendorProfile.ts`,
    );
  }
  return profile;
}
