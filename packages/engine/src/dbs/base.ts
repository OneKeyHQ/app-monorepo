import { Buffer } from 'buffer';

import { RevealableSeed } from '@onekeyhq/blockchain-libs/dist/secret';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/blockchain-libs/dist/secret/encryptors/aes256';

import { DBAccount } from '../types/account';
import { DBNetwork, UpdateNetworkParams } from '../types/network';
import { Token } from '../types/token';
import { DBWallet } from '../types/wallet';

type OneKeyContext = {
  id: string;
  nextHD: number;
  verifyString: string;
};

type StoredCredential = {
  entropy: string;
  seed: string;
};

type ExportedCredential = {
  entropy: Buffer;
  seed: Buffer;
};

const DEFAULT_VERIFY_STRING = 'OneKey';
const MAIN_CONTEXT = 'mainContext';

function checkPassword(context: OneKeyContext, password: string): boolean {
  if (typeof context === 'undefined') {
    console.error('Unable to get main context.');
    return false;
  }
  if (context.verifyString === DEFAULT_VERIFY_STRING) {
    return true;
  }
  try {
    return (
      decrypt(password, Buffer.from(context.verifyString, 'hex')).toString() ===
      DEFAULT_VERIFY_STRING
    );
  } catch {
    return false;
  }
}
interface DBAPI {
  listNetworks(): Promise<Array<DBNetwork>>;
  addNetwork(network: DBNetwork): Promise<DBNetwork>;
  getNetwork(networkId: string): Promise<DBNetwork>;
  updateNetworkList(networks: Array<[string, boolean]>): Promise<void>;
  updateNetwork(
    networkId: string,
    params: UpdateNetworkParams,
  ): Promise<DBNetwork>;
  deleteNetwork(networkId: string): Promise<void>;

  addToken(token: Token): Promise<Token>;
  getToken(tokenId: string): Promise<Token | undefined>;
  getTokens(networkId: string, accountId?: string): Promise<Array<Token>>;
  addTokenToAccount(accountId: string, tokenId: string): Promise<Token>;
  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void>;

  getWallets(): Promise<Array<DBWallet>>;
  getWallet(walletId: string): Promise<DBWallet | undefined>;
  createHDWallet(
    password: string,
    rs: RevealableSeed,
    name?: string,
  ): Promise<DBWallet>;
  removeWallet(walletId: string, password: string): Promise<void>;
  setWalletName(walletId: string, name: string): Promise<DBWallet>;
  getCredential(
    walletId: string,
    password: string,
  ): Promise<ExportedCredential>;
  confirmHDWalletBackuped(walletId: string): Promise<DBWallet>;

  addAccountToWallet(walletId: string, account: DBAccount): Promise<DBAccount>;
  getAccounts(accountIds: Array<string>): Promise<Array<DBAccount>>;
  getAccount(accountId: string): Promise<DBAccount | undefined>;
  removeAccount(
    walletId: string,
    accountId: string,
    password: string,
  ): Promise<void>;
  setAccountName(accountId: string, name: string): Promise<DBAccount>;
  addAccountAddress(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<DBAccount>;
  reset(password: string): Promise<void>;
}

export type { DBAPI, OneKeyContext, StoredCredential, ExportedCredential };
export { checkPassword, DEFAULT_VERIFY_STRING, encrypt, MAIN_CONTEXT };
