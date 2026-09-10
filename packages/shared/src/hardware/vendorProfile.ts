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
  /** Whether the app arbitrates USB/BLE for this vendor via the global
   *  force-transport atom (`setForceTransportType`). Vendors whose SDK routes
   *  transports itself, or whose connector is fixed per platform, must never
   *  write that atom — it only steers OneKey/Trezor calls, so a stray write
   *  pins OTHER vendors' sessions to the wrong channel. */
  appManagesTransportSwitching: boolean;
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
  /** Whether the app can ask the device to display and verify an address */
  supportsOnDeviceAddressVerification: boolean;
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
  /**
   * Whether a connectId-based match must be confirmed by an independent seed
   * check before the record is reused — a connectId that isn't a stable
   * per-device identity (see `hasPersistentConnectId`) can coincide across
   * different physical devices/seeds.
   */
  requiresSeedVerifyOnConnectIdMatch: boolean;
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
  appManagesTransportSwitching: true,
  supportsCloudSync: true,
  supportsDeviceManagementDetails: true,
  supportsDeviceAbout: true,
  supportsFirmwareVersionDisplay: true,
  supportsFirmwareVerify: true,
  supportsOnDeviceAddressVerification: true,
  supportsFirmwareUpdate: true,
  supportsOneKeyDeviceSettings: true,
  supportsDeviceSettings: true,
  supportsPassphraseSetting: true,
  supportsHiddenWalletCreation: true,
  addAccountDefaultNetworkMode: 'onekeyDefault',
  // OneKey always has device_id, so this path isn't used
  canMatchDeviceByConnectId: () => true,
  // OneKey always matches by deviceId, never by connectId alone.
  requiresSeedVerifyOnConnectIdMatch: false,
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
  // Connector is fixed per platform (webhid on desktop/web, ble on native)
  // and DMK routes sessions internally — nothing for the app to switch.
  appManagesTransportSwitching: false,
  supportsCloudSync: false,
  supportsDeviceManagementDetails: true,
  supportsDeviceAbout: false,
  supportsFirmwareVersionDisplay: false,
  supportsFirmwareVerify: false,
  supportsOnDeviceAddressVerification: true,
  supportsFirmwareUpdate: false,
  supportsOneKeyDeviceSettings: false,
  supportsDeviceSettings: false,
  supportsPassphraseSetting: false,
  supportsHiddenWalletCreation: false,
  addAccountDefaultNetworkMode: 'ledgerAppAware',
  // BLE: DMK transport path (MAC/UUID), persistent. USB: ephemeral UUID, never matches.
  canMatchDeviceByConnectId: (connectId) => Boolean(connectId),
  // USB connectId is ephemeral and BLE's, while persistent, isn't a proof of
  // identity by itself — require a seed check before reusing the record.
  requiresSeedVerifyOnConnectIdMatch: true,
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
  // Desktop runs USB and BLE side by side; the app-side fallback ladder
  // (callTrezorWithBleFallback + force-transport atom) arbitrates.
  appManagesTransportSwitching: true,
  supportsCloudSync: false,
  supportsDeviceManagementDetails: true,
  supportsDeviceAbout: false,
  supportsFirmwareVersionDisplay: true,
  supportsFirmwareVerify: false,
  supportsOnDeviceAddressVerification: true,
  supportsFirmwareUpdate: false,
  supportsOneKeyDeviceSettings: false,
  supportsDeviceSettings: true,
  supportsPassphraseSetting: true,
  supportsHiddenWalletCreation: true,
  addAccountDefaultNetworkMode: 'onekeyDefault',
  canMatchDeviceByConnectId: (connectId) => Boolean(connectId),
  // Trezor always matches by deviceId, never by connectId alone.
  requiresSeedVerifyOnConnectIdMatch: false,
};

// Keystone identifies a *wallet* (seed), not a physical unit: `deviceId` is
// a SHA-256 wallet id derived from one fixed account-level public key. It is
// identical across QR and USB, while the 32-bit BIP32 master fingerprint is
// kept only as protocol metadata. A different mnemonic or passphrase becomes
// a different logical device. No PIN matrix, no Ledger-style "app",
// no host-side passphrase toggle — the device handles all of that on its own
// screen. `supportsFirmwareVersionDisplay`/`supportsDeviceSettings` are left
// `false` for now: the SDK surfaces a `deviceVersion` string, but no App UI
// consumes it yet — flip these once that lands, not preemptively.
const keystoneProfile: IHardwareVendorProfile = {
  vendor: EHardwareVendor.keystone,
  isThirdParty: true,
  defaultDeviceName: 'Keystone',
  avatarKey: 'keystone',
  supportsSoftwarePin: false,
  requiresAppOpen: false,
  hasPersistentConnectId: () => true,
  hasPersistentDeviceId: () => true,
  // QR/USB routing happens per call inside the SDK adapter (`_resolveUr`).
  appManagesTransportSwitching: false,
  supportsCloudSync: false,
  supportsDeviceManagementDetails: true,
  supportsDeviceAbout: false,
  supportsFirmwareVersionDisplay: false,
  supportsFirmwareVerify: false,
  supportsOnDeviceAddressVerification: false,
  supportsFirmwareUpdate: false,
  supportsOneKeyDeviceSettings: false,
  supportsDeviceSettings: false,
  supportsPassphraseSetting: false,
  supportsHiddenWalletCreation: false,
  addAccountDefaultNetworkMode: 'onekeyDefault',
  // The wallet-id-derived connectId is stable across QR and USB, unlike
  // Ledger's ephemeral session handles.
  canMatchDeviceByConnectId: (connectId) => Boolean(connectId),
  requiresSeedVerifyOnConnectIdMatch: false,
};

const vendorProfiles: Record<EHardwareVendor, IHardwareVendorProfile> = {
  [EHardwareVendor.onekey]: onekeyProfile,
  [EHardwareVendor.ledger]: ledgerProfile,
  [EHardwareVendor.trezor]: trezorProfile,
  [EHardwareVendor.keystone]: keystoneProfile,
};

export function isHardwareVendorSupported(vendor: unknown): boolean {
  // Missing vendor values belong to legacy OneKey device rows.
  if (!vendor) return true;
  return (
    typeof vendor === 'string' &&
    Object.prototype.hasOwnProperty.call(vendorProfiles, vendor)
  );
}

export function getVendorProfile(
  vendor: EHardwareVendor | undefined | null,
): IHardwareVendorProfile {
  // No vendor field means OneKey (legacy rows + callers that don't deal with
  // third-party). Explicit `EHardwareVendor.onekey` also lands here via the
  // lookup below. Any other value must have its profile registered.
  if (!vendor) return onekeyProfile;
  if (!isHardwareVendorSupported(vendor)) {
    throw new OneKeyInternalError(
      `Unknown hardware vendor: "${vendor}". Register its profile in packages/shared/src/hardware/vendorProfile.ts`,
    );
  }
  return vendorProfiles[vendor];
}
