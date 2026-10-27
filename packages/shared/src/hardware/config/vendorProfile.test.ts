import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  canBuildHwWalletXfp,
  getVendorProfile,
  isHardwareVendorSupported,
  resolvePersistentConnectIdCapability,
} from './vendorProfile';

describe('hardware vendor profile', () => {
  it.each([
    [
      EHardwareVendor.onekey,
      { mode: 'device', asciiOnly: false },
      'transportLocator',
    ],
    [
      EHardwareVendor.trezor,
      { mode: 'device', asciiOnly: true },
      'transportLocator',
    ],
    [EHardwareVendor.ledger, { mode: 'local' }, 'transportLocator'],
    [EHardwareVendor.keystone, { mode: 'local' }, 'transportLocator'],
  ] as const)(
    'describes label writes and connection identity independently for %s',
    (vendor, label, role) => {
      expect(getVendorProfile(vendor)).toMatchObject({
        presentation: { label },
        identity: { role },
      });
    },
  );
  it('registers Trezor as OneKey-like and Ledger as app-aware', () => {
    expect(
      getVendorProfile(EHardwareVendor.onekey).passphrase.hiddenWallet,
    ).toBe(true);
    expect(
      getVendorProfile(EHardwareVendor.trezor).passphrase.hiddenWallet,
    ).toBe(true);
    expect(
      getVendorProfile(EHardwareVendor.ledger).passphrase.hiddenWallet,
    ).toBe(false);

    expect(
      getVendorProfile(EHardwareVendor.onekey).addAccountDefaultNetworkMode,
    ).toBe('onekeyDefault');
    expect(
      getVendorProfile(EHardwareVendor.trezor).addAccountDefaultNetworkMode,
    ).toBe('onekeyDefault');
    expect(
      getVendorProfile(EHardwareVendor.ledger).addAccountDefaultNetworkMode,
    ).toBe('ledgerAppAware');
  });

  it.each([
    [EHardwareVendor.onekey, 'none'],
    [EHardwareVendor.trezor, 'none'],
    [EHardwareVendor.keystone, 'none'],
    [EHardwareVendor.ledger, 'ledgerChainFingerprint'],
  ] as const)(
    'uses the expected connection identity check for %s',
    (vendor, strategy) => {
      expect(getVendorProfile(vendor).identity.connectIdMatchVerification).toBe(
        strategy,
      );
    },
  );

  it.each([
    [EHardwareVendor.onekey, 'device', 'buttonRequest'],
    [EHardwareVendor.ledger, 'device', 'confirmOnDevice'],
    [EHardwareVendor.trezor, 'device', 'confirmOnDevice'],
    [EHardwareVendor.keystone, 'manual', 'none'],
    [undefined, 'device', 'buttonRequest'],
  ] as const)(
    'defines address verification capabilities for %s',
    (vendor, mode, confirmationEvent) => {
      expect(getVendorProfile(vendor).addressVerification).toEqual({
        mode,
        confirmationEvent,
      });
    },
  );

  it('lets per-device identity capability override the vendor transport fallback', () => {
    const trezor = getVendorProfile(EHardwareVendor.trezor);

    expect(trezor.identity.persistentConnectId('usb')).toBe(true);
    expect(trezor.identity.persistentConnectId('ble')).toBe(false);
    expect(
      resolvePersistentConnectIdCapability({
        profile: trezor,
        transport: 'usb',
        capabilities: { persistentDeviceIdentity: false },
      }),
    ).toBe(false);
    expect(
      resolvePersistentConnectIdCapability({
        profile: trezor,
        transport: 'usb',
        capabilities: { persistentDeviceIdentity: true },
      }),
    ).toBe(true);
  });

  it('degrades an unknown vendor to an inert profile instead of throwing', () => {
    const futureVendor = 'future-vendor' as EHardwareVendor;

    expect(isHardwareVendorSupported(undefined)).toBe(true);
    expect(isHardwareVendorSupported(EHardwareVendor.onekey)).toBe(true);
    expect(isHardwareVendorSupported(futureVendor)).toBe(false);

    // Downgrading past the build that introduced a vendor leaves its device
    // rows behind. Reading one must not take down every screen that touches it.
    const profile = getVendorProfile(futureVendor);
    expect(profile.vendor).toBe(futureVendor);
    expect(profile.isThirdParty).toBe(true);
    expect(profile.deviceManager.details).toBe(false);
    expect(profile.supportsCloudSync).toBe(false);
    expect(profile.passphrase.hiddenWallet).toBe(false);
    // Locator semantics are unknown, so never claim a device match.
    expect(profile.identity.matchDeviceByConnectId('anything')).toBe(false);
    expect(profile.identity.persistentConnectId('usb')).toBe(false);
    expect(profile.identity.persistentDeviceId('ble')).toBe(false);
    expect(profile.identity.connectIdMatchVerification).toBe('none');
    // Same instance on repeat so callers can compare profiles by identity.
    expect(getVendorProfile(futureVendor)).toBe(profile);
  });
});

describe('canBuildHwWalletXfp', () => {
  it.each([
    [undefined, true],
    [EHardwareVendor.onekey, true],
    [EHardwareVendor.trezor, true],
    [EHardwareVendor.ledger, false],
    [EHardwareVendor.keystone, false],
  ] as const)('%s -> %s', (vendor, expected) => {
    expect(canBuildHwWalletXfp(vendor)).toBe(expected);
  });
});
