import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  resolveWalletPassphraseProtection,
  shouldShowAddHiddenWalletButtonForWallet,
  shouldShowBulkCopyAddressesButtonForWallet,
  shouldShowCreateHiddenWalletSidebarButtonForWallet,
  shouldShowDeviceManagementButtonForWallet,
} from './WalletEditButtonUtils';

describe('resolveWalletPassphraseProtection', () => {
  it('优先使用 Pro2 的 DeviceState 判断 Passphrase 已开启', () => {
    expect(
      resolveWalletPassphraseProtection({
        deviceState: {
          status: { passphraseProtection: true },
        } as never,
        features: {
          passphraseProtection: false,
          passphrase_protection: false,
        } as never,
      }),
    ).toBe(true);
  });

  it('没有 DeviceState 时兼容 Pro 的旧 Features 字段', () => {
    expect(
      resolveWalletPassphraseProtection({
        features: {
          passphrase_protection: true,
        } as never,
      }),
    ).toBe(true);
  });
});

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

  it('allows Pro2 hidden wallet creation', () => {
    expect(
      shouldShowAddHiddenWalletButtonForWallet({
        isHiddenWallet: false,
        isHwOrQrWallet: true,
        vendor: EHardwareVendor.onekey,
      }),
    ).toBe(true);
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

describe('shouldShowBulkCopyAddressesButtonForWallet', () => {
  const hdWalletId = 'hd-1';
  const hwWalletId = 'hw-1';
  const qrWalletId = 'qr-1';

  it('shows the entry for backed-up HD and hardware wallets when Prime is available', () => {
    expect(
      shouldShowBulkCopyAddressesButtonForWallet({
        isPrimeAvailable: true,
        walletId: hdWalletId,
        backuped: true,
      }),
    ).toBe(true);
    expect(
      shouldShowBulkCopyAddressesButtonForWallet({
        isPrimeAvailable: true,
        walletId: hwWalletId,
        backuped: true,
      }),
    ).toBe(true);
  });

  it('hides the entry when Prime is unavailable, the wallet is not backed up, or the type is unsupported', () => {
    expect(
      shouldShowBulkCopyAddressesButtonForWallet({
        isPrimeAvailable: false,
        walletId: hdWalletId,
        backuped: true,
      }),
    ).toBe(false);
    expect(
      shouldShowBulkCopyAddressesButtonForWallet({
        isPrimeAvailable: true,
        walletId: hdWalletId,
        backuped: false,
      }),
    ).toBe(false);
    expect(
      shouldShowBulkCopyAddressesButtonForWallet({
        isPrimeAvailable: true,
        walletId: hdWalletId,
        deprecated: true,
        backuped: true,
      }),
    ).toBe(false);
    expect(
      shouldShowBulkCopyAddressesButtonForWallet({
        isPrimeAvailable: true,
        walletId: qrWalletId,
        backuped: true,
      }),
    ).toBe(false);
    expect(
      shouldShowBulkCopyAddressesButtonForWallet({
        isPrimeAvailable: true,
        walletId: undefined,
        backuped: true,
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
