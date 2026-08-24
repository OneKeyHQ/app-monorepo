import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { getVendorProfile } from './vendorProfile';

describe('hardware vendor profile', () => {
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
    // Only Ledger matches by connectId, so only it needs the seed gate.
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
});
