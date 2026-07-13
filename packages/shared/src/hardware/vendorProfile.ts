import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { OneKeyInternalError } from '../errors';

export type IHardwareVendorAddAccountDefaultNetworkMode =
  | 'onekeyDefault'
  | 'ledgerAppAware';

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
  /** Whether Device Manager can open the detail page */
  supportsDeviceManagementDetails: boolean;
  /** Whether Device Manager can show the About Device support section */
  supportsDeviceAbout: boolean;
  /** Whether firmware version should be shown in Device Manager */
  supportsFirmwareVersionDisplay: boolean;
  /** Whether OneKey firmware authenticity verification is supported */
  supportsFirmwareVerify: boolean;
  /** Whether OneKey firmware update checking is supported */
  supportsFirmwareUpdate: boolean;
  /** Whether OneKey device settings sections are supported */
  supportsOneKeyDeviceSettings: boolean;
  /** Whether Device Manager can show vendor-routed device settings */
  supportsDeviceSettings: boolean;
  /** Whether passphrase can be enabled/disabled from Device Manager */
  supportsPassphraseSetting: boolean;
  /** Whether wallet UI can expose hidden-wallet creation */
  supportsHiddenWalletCreation: boolean;
  /** How default networks are created during add-account flows */
  addAccountDefaultNetworkMode: IHardwareVendorAddAccountDefaultNetworkMode;
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
  supportsDeviceManagementDetails: true,
  supportsDeviceAbout: true,
  supportsFirmwareVersionDisplay: true,
  supportsFirmwareVerify: true,
  supportsFirmwareUpdate: true,
  supportsOneKeyDeviceSettings: true,
  supportsDeviceSettings: true,
  supportsPassphraseSetting: true,
  supportsHiddenWalletCreation: true,
  addAccountDefaultNetworkMode: 'onekeyDefault',
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
  supportsDeviceManagementDetails: true,
  supportsDeviceAbout: false,
  supportsFirmwareVersionDisplay: false,
  supportsFirmwareVerify: false,
  supportsFirmwareUpdate: false,
  supportsOneKeyDeviceSettings: false,
  supportsDeviceSettings: false,
  supportsPassphraseSetting: false,
  supportsHiddenWalletCreation: false,
  addAccountDefaultNetworkMode: 'ledgerAppAware',
  // BLE: DMK transport path (MAC/UUID), persistent. USB: ephemeral UUID, never matches.
  canMatchDeviceByConnectId: (connectId) => Boolean(connectId),
};

// Trezor THP (Safe 7) — the only Trezor firmware we currently support. PIN
// is entered on-device during pairing; the host never sees a PIN matrix.
// USB serial number is sticky on Trezor (unlike Ledger's DMK ephemeral
// UUID), so connectId persists for both transports.
const trezorProfile: IHardwareVendorProfile = {
  vendor: EHardwareVendor.trezor,
  isThirdParty: true,
  defaultDeviceName: 'Trezor',
  avatarKey: 'trezor',
  // THP firmware reads PIN on its own touchscreen during handshake. The host
  // SDK never holds a PIN matrix — different from Trezor T1 (legacy) where
  // PIN was entered host-side. We don't ship the T1 path, so always false.
  supportsSoftwarePin: false,
  // Trezor has no Ledger-style per-chain "app" concept.
  requiresAppOpen: false,
  // USB: Trezor uses the device serial number as connectId — sticky across
  // sessions. BLE: MAC, also sticky.
  hasPersistentConnectId: () => true,
  // `device_id` from Features is a stable 24-char hex, persists across
  // reconnects, only changes on full device wipe.
  hasPersistentDeviceId: () => true,
  supportsCloudSync: false,
  supportsDeviceManagementDetails: true,
  supportsDeviceAbout: false,
  supportsFirmwareVersionDisplay: true,
  supportsFirmwareVerify: false,
  supportsFirmwareUpdate: false,
  supportsOneKeyDeviceSettings: false,
  supportsDeviceSettings: true,
  supportsPassphraseSetting: true,
  supportsHiddenWalletCreation: true,
  addAccountDefaultNetworkMode: 'onekeyDefault',
  canMatchDeviceByConnectId: (connectId) => Boolean(connectId),
};

const vendorProfiles: Record<EHardwareVendor, IHardwareVendorProfile> = {
  [EHardwareVendor.onekey]: onekeyProfile,
  [EHardwareVendor.ledger]: ledgerProfile,
  [EHardwareVendor.trezor]: trezorProfile,
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
