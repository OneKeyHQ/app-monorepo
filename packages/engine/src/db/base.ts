import { RevealableSeed } from '@onekeyhq/blockchain-libs/dist/secret';

import { DBAccount } from '../types/account';
import { DBNetwork, UpdateNetworkParams } from '../types/network';
import { Token } from '../types/token';
import { DBWallet } from '../types/wallet';

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
  revealHDWalletSeed(walletId: string, password: string): Promise<string>;
  confirmHDWalletBackuped(walletId: string): Promise<DBWallet>;

  addAccountToWallet(walletId: string, account: DBAccount): Promise<DBAccount>;
  getAccounts(accountIds: Array<string>): Promise<Array<DBAccount>>;
  getAccount(accountId: string): Promise<DBAccount | undefined>;
}

export type { DBAPI };
