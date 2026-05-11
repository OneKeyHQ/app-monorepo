import {
  getBotWalletNameBadges,
  shouldBlockBotWalletBeReceiver,
  shouldBlockBotWalletCopyAddress,
  shouldBlockBotWalletReceive,
  shouldBlockBotWalletReferralAddressDisplay,
  shouldHideBotWalletExport,
  shouldHideBotWalletMnemonicBackupEntry,
  shouldShowMnemonicBackupEntryForWallet,
  shouldWarnBotWalletInteract,
} from './botWalletStatusUtils';

describe('botWalletStatusUtils', () => {
  it('returns no badges for non-Bot wallets', () => {
    expect(
      getBotWalletNameBadges({
        isBotWallet: false,
        isBotWalletDeactivated: false,
      }),
    ).toEqual([]);
  });

  it('returns only deactivated name badge for deactivated Bot wallets', () => {
    expect(
      getBotWalletNameBadges({
        isBotWallet: true,
        isBotWalletDeactivated: true,
      }),
    ).toEqual([
      {
        key: 'deactivated',
        label: '已停用',
        tone: 'caution',
      },
    ]);
  });

  it('returns no name badge for active Bot wallets', () => {
    expect(
      getBotWalletNameBadges({
        isBotWallet: true,
        isBotWalletDeactivated: false,
      }),
    ).toEqual([]);
  });

  it('blocks receive and hides export only for deactivated Bot wallets', () => {
    expect(
      shouldBlockBotWalletReceive({
        isBotWallet: true,
        isBotWalletDeactivated: true,
      }),
    ).toBe(true);
    expect(
      shouldHideBotWalletExport({
        isBotWallet: true,
        isBotWalletDeactivated: true,
      }),
    ).toBe(true);

    expect(
      shouldBlockBotWalletReceive({
        isBotWallet: true,
        isBotWalletDeactivated: false,
      }),
    ).toBe(false);
    expect(
      shouldHideBotWalletExport({
        isBotWallet: false,
        isBotWalletDeactivated: true,
      }),
    ).toBe(false);
  });

  it('hides mnemonic backup entry for Bot wallets in main UI', () => {
    expect(
      shouldHideBotWalletMnemonicBackupEntry({
        isBotWallet: true,
      }),
    ).toBe(true);

    expect(
      shouldHideBotWalletMnemonicBackupEntry({
        isBotWallet: false,
      }),
    ).toBe(false);
  });

  it('blocks copy / receiver / referral display / dapp warning only for deactivated Bot wallets', () => {
    const deactivated = { isBotWallet: true, isBotWalletDeactivated: true };
    const active = { isBotWallet: true, isBotWalletDeactivated: false };
    const nonBot = { isBotWallet: false, isBotWalletDeactivated: true };

    for (const fn of [
      shouldBlockBotWalletCopyAddress,
      shouldBlockBotWalletBeReceiver,
      shouldBlockBotWalletReferralAddressDisplay,
      shouldWarnBotWalletInteract,
    ]) {
      expect(fn(deactivated)).toBe(true);
      expect(fn(active)).toBe(false);
      expect(fn(nonBot)).toBe(false);
    }
  });

  it('only shows mnemonic backup entry for standard HD wallets', () => {
    expect(
      shouldShowMnemonicBackupEntryForWallet({
        walletId: 'hd-1',
      }),
    ).toBe(true);

    expect(
      shouldShowMnemonicBackupEntryForWallet({
        walletId: 'hd-bot--hd-keyless-test-parent--0',
      }),
    ).toBe(false);

    expect(
      shouldShowMnemonicBackupEntryForWallet({
        walletId: 'hd-keyless-test-parent',
        isKeylessWallet: true,
      }),
    ).toBe(false);

    expect(
      shouldShowMnemonicBackupEntryForWallet({
        walletId: 'hw-test-device',
      }),
    ).toBe(false);
  });
});
