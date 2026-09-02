import testIDValues from './testIDValues.json';

const {
  accountEditButtonPrefix,
  accountItemPrefix,
  exportMnemonicKeyPrefix,
  exportPrivateKeyPrefix,
  exportPublicKeyPrefix,
  walletEditButtonPrefix,
  walletPrefix,
  ...staticTestIDs
} = testIDValues;

export const AccountManagerTestIDs = {
  ...staticTestIDs,
  accountItem: (index: number) => `${accountItemPrefix}${index}`,
  wallet: (walletId: string) => `${walletPrefix}${walletId}`,
  walletEditButton: (name: string) => `${walletEditButtonPrefix}${name}`,
  accountEditButton: (name: string) => `${accountEditButtonPrefix}${name}`,
  exportPrivateKey: (name: string) => `${exportPrivateKeyPrefix}${name}`,
  exportPublicKey: (name: string) => `${exportPublicKeyPrefix}${name}`,
  exportMnemonicKey: (name: string) => `${exportMnemonicKeyPrefix}${name}`,
} as const;
