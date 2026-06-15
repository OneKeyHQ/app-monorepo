import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  shouldShowAddHiddenWalletButtonForWallet,
  shouldShowCreateHiddenWalletSidebarButtonForWallet,
  shouldShowDeviceManagementButtonForWallet,
} from './WalletEditButtonUtils';

describe('shouldShowAddHiddenWalletButtonForWallet', () => {
  it('allows Trezor hidden wallet creation because Trezor supports passphrase', () => {
    expect(
      shouldShowAddHiddenWalletButtonForWallet({
        isHiddenWallet: false,
        isHwOrQrWallet: true,
        vendor: EHardwareVendor.trezor,
      }),
    ).toBe(true);
  });

  it('keeps Ledger hidden wallet creation hidden', () => {
    expect(
      shouldShowAddHiddenWalletButtonForWallet({
        isHiddenWallet: false,
        isHwOrQrWallet: true,
        vendor: EHardwareVendor.ledger,
      }),
    ).toBe(false);
  });

  it('allows the Trezor sidebar add-hidden entry when passphrase is enabled', () => {
    expect(
      shouldShowCreateHiddenWalletSidebarButtonForWallet({
        isEditableRouteParams: true,
        showAddHiddenInWalletSidebar: true,
        isDeprecated: false,
        isHiddenWallet: false,
        isHwOrQrWallet: true,
        isHwWallet: true,
        isQrWallet: false,
        hasPassphraseProtection: true,
        vendor: EHardwareVendor.trezor,
      }),
    ).toBe(true);
  });

  it('keeps the Ledger sidebar add-hidden entry hidden', () => {
    expect(
      shouldShowCreateHiddenWalletSidebarButtonForWallet({
        isEditableRouteParams: true,
        showAddHiddenInWalletSidebar: true,
        isDeprecated: false,
        isHiddenWallet: false,
        isHwOrQrWallet: true,
        isHwWallet: true,
        isQrWallet: false,
        hasPassphraseProtection: true,
        vendor: EHardwareVendor.ledger,
      }),
    ).toBe(false);
  });
});

describe('shouldShowDeviceManagementButtonForWallet', () => {
  it('allows Trezor device management because Trezor has vendor-routed settings', () => {
    expect(
      shouldShowDeviceManagementButtonForWallet({
        isHiddenWallet: false,
        isHwOrQrWallet: true,
        vendor: EHardwareVendor.trezor,
      }),
    ).toBe(true);
  });

  it('keeps Ledger device management visible when the vendor profile supports details', () => {
    expect(
      shouldShowDeviceManagementButtonForWallet({
        isHiddenWallet: false,
        isHwOrQrWallet: true,
        vendor: EHardwareVendor.ledger,
      }),
    ).toBe(true);
  });

  it('keeps hidden hardware wallets out of device management', () => {
    expect(
      shouldShowDeviceManagementButtonForWallet({
        isHiddenWallet: true,
        isHwOrQrWallet: true,
        vendor: EHardwareVendor.trezor,
      }),
    ).toBe(false);
  });
});
