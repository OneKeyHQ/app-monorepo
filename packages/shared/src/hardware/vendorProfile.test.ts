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
});
