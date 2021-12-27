import { DBWallet, Wallet } from './types/wallet';

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

export { fromDBWalletToWallet };
