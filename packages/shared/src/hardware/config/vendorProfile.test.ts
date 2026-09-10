import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
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
    [EHardwareVendor.keystone, { mode: 'local' }, 'walletIdentity'],
  ] as const)(
    'describes label writes and connection identity independently for %s',
    (vendor, deviceLabel, connectIdRole) => {
      expect(getVendorProfile(vendor)).toMatchObject({
        deviceLabel,
        connectIdRole,
      });
    },
  );
  it('registers Trezor as OneKey-like and Ledger as app-aware', () => {
    expect(
      getVendorProfile(EHardwareVendor.onekey).supportsHiddenWalletCreation,
    ).toBe(true);
    expect(
      getVendorProfile(EHardwareVendor.trezor).supportsHiddenWalletCreation,
    ).toBe(true);
    expect(
      getVendorProfile(EHardwareVendor.ledger).supportsHiddenWalletCreation,
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

  it('requires a seed check on connectId match only for Ledger', () => {
    // Ledger's connectId is not a stable per-device identity, so reusing a
    // connectId-matched record must be gated on a seed check. OneKey and
    // Trezor always match by deviceId and never reach that gate.
    expect(
      getVendorProfile(EHardwareVendor.onekey)
        .requiresSeedVerifyOnConnectIdMatch,
    ).toBe(false);
    expect(
      getVendorProfile(EHardwareVendor.trezor)
        .requiresSeedVerifyOnConnectIdMatch,
    ).toBe(false);
    expect(
      getVendorProfile(EHardwareVendor.ledger)
        .requiresSeedVerifyOnConnectIdMatch,
    ).toBe(true);
  });

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

    expect(trezor.hasPersistentConnectId('usb')).toBe(true);
    expect(trezor.hasPersistentConnectId('ble')).toBe(false);
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

  it('detects vendors introduced by a newer app without weakening strict lookups', () => {
    const futureVendor = 'future-vendor' as EHardwareVendor;

    expect(isHardwareVendorSupported(undefined)).toBe(true);
    expect(isHardwareVendorSupported(EHardwareVendor.onekey)).toBe(true);
    expect(isHardwareVendorSupported(futureVendor)).toBe(false);
    expect(() => getVendorProfile(futureVendor)).toThrow(
      'Unknown hardware vendor: "future-vendor"',
    );
  });
});
