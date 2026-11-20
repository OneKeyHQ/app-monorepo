import { filterBackupWallets } from './walletBackupUtils';

const wallets = [
  { id: 'hd-1', name: 'Ordinary wallet' },
  { id: 'hd-keyless-parent', isKeyless: true },
  { id: 'hd-keyless-without-flag' },
  { id: 'legacy-keyless', isKeyless: true },
  { id: 'hd-bot--hd-keyless-parent--0' },
  { id: 'hd-bot--hd-keyless-parent--1' },
  { id: 'imported' },
  { id: 'watching' },
];

describe('filterBackupWallets', () => {
  it('excludes keyless and bot wallets from an unscoped backup', () => {
    const filtered = filterBackupWallets({ wallets });

    expect(filtered.map((wallet) => wallet.id)).toEqual([
      'hd-1',
      'imported',
      'watching',
    ]);
    expect(filtered[0]).toBe(wallets[0]);
    expect(wallets).toHaveLength(8);
  });

  it('treats an empty selection as an unscoped backup', () => {
    expect(filterBackupWallets({ wallets, walletIds: [] })).toEqual(
      filterBackupWallets({ wallets }),
    );
  });

  it('keeps only explicitly requested bot wallets for CLI export', () => {
    const filtered = filterBackupWallets({
      wallets,
      walletIds: ['hd-bot--hd-keyless-parent--1'],
    });

    expect(filtered.map((wallet) => wallet.id)).toEqual([
      'hd-bot--hd-keyless-parent--1',
    ]);
  });

  it('excludes keyless wallets even when explicitly requested', () => {
    const filtered = filterBackupWallets({
      wallets,
      walletIds: [
        'hd-keyless-parent',
        'hd-keyless-without-flag',
        'legacy-keyless',
        'hd-1',
      ],
    });

    expect(filtered.map((wallet) => wallet.id)).toEqual(['hd-1']);
  });
});
