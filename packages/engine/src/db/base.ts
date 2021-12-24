import { DBNetwork, UpdateNetworkParams } from '../types/network';
import { Token } from '../types/token';

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
  getToken(tokenId: string): Promise<Token | null>;
  getTokens(networkId: string, accountId?: string): Promise<Array<Token>>;
  addTokenToAccount(accountId: string, tokenId: string): Promise<Token>;
  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void>;
}

export type { DBAPI };
