import { DBWallet, Wallet } from '../types/wallet';

function fromDBWalletToWallet(dbWallet: DBWallet): Wallet {
  return {
    id: dbWallet.id,
    name: dbWallet.name,
    type: dbWallet.type,
    backuped: dbWallet.backuped,
    accounts: new Set(dbWallet.accounts),
    nextAccountId: new Map(Object.entries(dbWallet.nextAccountId)),
  };
}

function walletIsHD(walletId: string): boolean {
  return walletId.startsWith('hd');
}

function walletCanBeRemoved(walletId: string): boolean {
  return walletIsHD(walletId) || walletId.startsWith('hw');
}

function walletNameCanBeUpdated(walletId: string): boolean {
  return walletCanBeRemoved(walletId);
}

export {
  fromDBWalletToWallet,
  walletIsHD,
  walletCanBeRemoved,
  walletNameCanBeUpdated,
};
