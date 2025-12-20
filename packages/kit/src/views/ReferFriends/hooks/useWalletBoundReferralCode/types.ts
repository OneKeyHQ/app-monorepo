import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

export type IReferralCodeWalletInfo = {
  address: string;
  networkId: string;
  pubkey?: string;
  isBtcOnlyWallet: boolean;
  accountId: string;
  walletId: string;
  wallet: IDBWallet;
};
