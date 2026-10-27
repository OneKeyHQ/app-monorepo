import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export type IHardwareVendorAddAccountDefaultNetworkMode =
  | 'onekeyDefault'
  | 'ledgerAppAware';

export type IHardwareAddressVerificationCapability =
  | { mode: 'manual'; confirmationEvent: 'none' }
  | {
      mode: 'device';
      confirmationEvent: 'buttonRequest' | 'confirmOnDevice';
    };

export interface IHardwareVendorProfile {
  vendor: EHardwareVendor;
  /** Whether this is a third-party (non-OneKey) vendor */
  isThirdParty: boolean;
  /** How this vendor's devices are named and pictured. */
  presentation: {
    /** Default device name when no label is available; empty means the device reports its own. */
    defaultName: string;
    /** Empty means derived from deviceType. */
    avatarKey: string;
    /** Label writes and validation are independent of settings-page visibility. */
    label: { mode: 'local' } | { mode: 'device'; asciiOnly: boolean };
  };
  /**
   * What this vendor's ids mean; `role` is load-bearing since DB writes,
   * locator normalization, and device dedup all branch on it.
   */
  identity: {
    /** Meaning of the legacy primary connectId, independent of its persistence. */
    role: 'transportLocator' | 'walletIdentity';
    /** Persistence fallback for scanned locators, not a requirement on SDK calls. */
    persistentConnectId(transport: 'usb' | 'ble'): boolean;
    /** Whether the deviceId persists across sessions for the given transport */
    persistentDeviceId(transport: 'usb' | 'ble'): boolean;
    /** Whether a connectId can be used to identify an existing device. */
    matchDeviceByConnectId(connectId: string): boolean;
    /** Additional verification required before reusing a connectId-matched record. */
    connectIdMatchVerification: 'none' | 'ledgerChainFingerprint';
  };
  /** What Device Manager may show for this vendor. */
  deviceManager: {
    /** Whether Device Manager can open the detail page */
    details: boolean;
    /** Whether Device Manager can show the About Device support section */
    about: boolean;
    /** Whether Device Manager can show vendor-routed device settings */
    settings: boolean;
  };
  firmware: {
    /** Whether firmware version should be shown in Device Manager */
    showVersion: boolean;
    /** Whether OneKey firmware authenticity verification is supported */
    verify: boolean;
    /** Whether OneKey firmware update checking is supported */
    update: boolean;
  };
  passphrase: {
    /** Whether passphrase can be enabled/disabled from Device Manager */
    setting: boolean;
    /** Whether wallet UI can expose hidden-wallet creation */
    hiddenWallet: boolean;
  };
  /** Default for the persisted inputPinOnSoftware preference, not a protocol capability. */
  supportsSoftwarePin: boolean;
  /** Whether this vendor's wallets support cloud sync */
  supportsCloudSync: boolean;
  /** Verification method and the event channel used while awaiting confirmation. */
  addressVerification: IHardwareAddressVerificationCapability;
  /** How default networks are created during add-account flows */
  addAccountDefaultNetworkMode: IHardwareVendorAddAccountDefaultNetworkMode;
}

const onekeyProfile: IHardwareVendorProfile = {
  vendor: EHardwareVendor.onekey,
  isThirdParty: false,
  presentation: {
    defaultName: '',
    avatarKey: '',
    label: { mode: 'device', asciiOnly: false },
  },
  identity: {
    role: 'transportLocator',
    persistentConnectId: () => true,
    persistentDeviceId: () => true,
    // OneKey always has device_id, so this path isn't used
    matchDeviceByConnectId: () => true,
    // OneKey always matches by deviceId, never by connectId alone.
    connectIdMatchVerification: 'none',
  },
  deviceManager: { details: true, about: true, settings: true },
  firmware: { showVersion: true, verify: true, update: true },
  passphrase: { setting: true, hiddenWallet: true },
  supportsSoftwarePin: true,
  supportsCloudSync: true,
  addressVerification: { mode: 'device', confirmationEvent: 'buttonRequest' },
  addAccountDefaultNetworkMode: 'onekeyDefault',
};

const ledgerProfile: IHardwareVendorProfile = {
  vendor: EHardwareVendor.ledger,
  isThirdParty: true,
  presentation: {
    defaultName: 'Ledger',
    avatarKey: 'ledger',
    label: { mode: 'local' },
  },
  identity: {
    role: 'transportLocator',
    persistentConnectId: (transport) => transport === 'ble',
    persistentDeviceId: () => false,
    // BLE: DMK transport path (MAC/UUID), persistent. USB: ephemeral UUID, never matches.
    matchDeviceByConnectId: (connectId) => Boolean(connectId),
    // USB connectId is ephemeral, and BLE's, while persistent, isn't proof of
    // identity by itself, so a seed check is required before reuse.
    connectIdMatchVerification: 'ledgerChainFingerprint',
  },
  deviceManager: { details: true, about: false, settings: false },
  firmware: { showVersion: false, verify: false, update: false },
  passphrase: { setting: false, hiddenWallet: false },
  supportsSoftwarePin: false,
  supportsCloudSync: false,
  addressVerification: { mode: 'device', confirmationEvent: 'confirmOnDevice' },
  addAccountDefaultNetworkMode: 'ledgerAppAware',
};

const trezorProfile: IHardwareVendorProfile = {
  vendor: EHardwareVendor.trezor,
  isThirdParty: true,
  presentation: {
    defaultName: 'Trezor',
    avatarKey: 'trezor',
    label: { mode: 'device', asciiOnly: true },
  },
  identity: {
    role: 'transportLocator',
    // USB devices normally publish a stable serial. BLE locators are only
    // discovery handles; a live connector capability overrides this fallback.
    persistentConnectId: (transport) => transport === 'usb',
    // `device_id` from Features is a stable 24-char hex, persists across
    // reconnects, only changes on full device wipe.
    persistentDeviceId: () => true,
    matchDeviceByConnectId: (connectId) => Boolean(connectId),
    // Trezor always matches by deviceId, never by connectId alone.
    connectIdMatchVerification: 'none',
  },
  deviceManager: { details: true, about: false, settings: true },
  firmware: { showVersion: true, verify: false, update: false },
  passphrase: { setting: true, hiddenWallet: true },
  // Trezor PIN entry follows SDK requests (on-device entry or host matrix).
  // This preference does not enable or disable those protocol-driven prompts.
  supportsSoftwarePin: false,
  supportsCloudSync: false,
  addressVerification: { mode: 'device', confirmationEvent: 'confirmOnDevice' },
  addAccountDefaultNetworkMode: 'onekeyDefault',
};

// deviceId is the wallet's BIP32 master fingerprint, the same over QR and USB;
// another seed or passphrase is another device. showVersion stays
// false until both channels report firmware reliably (QR may omit it, USB
// getAppConfig falls back to '0.0.0').
const keystoneProfile: IHardwareVendorProfile = {
  vendor: EHardwareVendor.keystone,
  isThirdParty: true,
  presentation: {
    defaultName: 'Keystone',
    avatarKey: 'keystone',
    label: { mode: 'local' },
  },
  identity: {
    // Identity is deviceId (the mfp). QR has no transport locator and the USB
    // serial lives in usbConnectId, so connectId stays empty.
    role: 'transportLocator',
    persistentConnectId: () => false,
    persistentDeviceId: () => true,
    matchDeviceByConnectId: () => false,
    connectIdMatchVerification: 'none',
  },
  deviceManager: { details: true, about: false, settings: false },
  firmware: { showVersion: false, verify: false, update: false },
  passphrase: { setting: false, hiddenWallet: false },
  supportsSoftwarePin: false,
  supportsCloudSync: false,
  addressVerification: { mode: 'manual', confirmationEvent: 'none' },
  addAccountDefaultNetworkMode: 'onekeyDefault',
};

const vendorProfiles: Record<EHardwareVendor, IHardwareVendorProfile> = {
  [EHardwareVendor.onekey]: onekeyProfile,
  [EHardwareVendor.ledger]: ledgerProfile,
  [EHardwareVendor.trezor]: trezorProfile,
  [EHardwareVendor.keystone]: keystoneProfile,
};

export function resolvePersistentConnectIdCapability({
  profile,
  transport,
  capabilities,
}: {
  profile: IHardwareVendorProfile;
  transport: 'usb' | 'ble';
  capabilities?: { persistentDeviceIdentity?: unknown };
}): boolean {
  const explicitCapability = capabilities?.persistentDeviceIdentity;
  return typeof explicitCapability === 'boolean'
    ? explicitCapability
    : profile.identity.persistentConnectId(transport);
}

export function isHardwareVendorSupported(vendor: unknown): boolean {
  // Missing vendor values belong to legacy OneKey device rows.
  if (!vendor) return true;
  return (
    typeof vendor === 'string' &&
    Object.prototype.hasOwnProperty.call(vendorProfiles, vendor)
  );
}

/**
 * Fallback profile for a vendor unknown to this build, e.g. after a
 * downgrade following a newer build's write. Inert rather than throwing, so wallet-listing surfaces don't crash.
 */
function buildUnknownVendorProfile(vendor: string): IHardwareVendorProfile {
  return {
    vendor: vendor as EHardwareVendor,
    isThirdParty: true,
    presentation: {
      defaultName: vendor,
      avatarKey: '',
      label: { mode: 'local' },
    },
    identity: {
      role: 'transportLocator',
      persistentConnectId: () => false,
      persistentDeviceId: () => false,
      matchDeviceByConnectId: () => false,
      connectIdMatchVerification: 'none',
    },
    deviceManager: { details: false, about: false, settings: false },
    firmware: { showVersion: false, verify: false, update: false },
    passphrase: { setting: false, hiddenWallet: false },
    supportsSoftwarePin: false,
    supportsCloudSync: false,
    addressVerification: { mode: 'manual', confirmationEvent: 'none' },
    addAccountDefaultNetworkMode: 'onekeyDefault',
  };
}

const unknownVendorProfiles = new Map<string, IHardwareVendorProfile>();

export function getVendorProfile(
  vendor: EHardwareVendor | undefined | null,
): IHardwareVendorProfile {
  // No vendor field means OneKey (legacy rows + callers that don't deal with
  // third-party). Explicit `EHardwareVendor.onekey` also lands here via the
  // lookup below.
  if (!vendor) return onekeyProfile;
  if (!isHardwareVendorSupported(vendor)) {
    let profile = unknownVendorProfiles.get(vendor);
    if (!profile) {
      profile = buildUnknownVendorProfile(vendor);
      unknownVendorProfiles.set(vendor, profile);
      console.error(
        `Unknown hardware vendor: "${vendor}". Register its profile in packages/shared/src/hardware/config/vendorProfile.ts`,
      );
    }
    return profile;
  }
  return vendorProfiles[vendor];
}

/**
 * Whether a hardware wallet of this vendor can derive the OneKey wallet xfp.
 * Trezor supplies it through its adapter; other third-party vendors stay
 * xfp-less, so asking their device for it is a no-op.
 */
export function canBuildHwWalletXfp(vendor?: EHardwareVendor): boolean {
  if (!vendor || !getVendorProfile(vendor).isThirdParty) return true;
  return vendor === EHardwareVendor.trezor;
}
