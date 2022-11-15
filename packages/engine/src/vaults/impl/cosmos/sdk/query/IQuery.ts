import { AxiosInstance } from 'axios';
import BigNumber from 'bignumber.js';

import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';

import { CosmwasmQuery } from './CosmwasmQuery';
import { MintScanQuery } from './MintScanQuery';
import { SecretwasmQuery } from './SecretwasmQuery';

export interface Cw20AssetInfo {
  contractAddress: string;
  name: string;
  decimals: number;
  symbol: string;
}

export interface Cw20TokenBalance {
  address: string;
  balance: BigNumber;
}

export interface QueryChainInfo {
  networkId: string;
  axios?: AxiosInstance;
}

export interface IQuery {
  queryCw20TokenInfo: (
    chainInfo: QueryChainInfo,
    contractAddressArray: string[],
  ) => Promise<Cw20AssetInfo[]>;

  queryCw20TokenBalance: (
    chainInfo: QueryChainInfo,
    contractAddress: string,
    address: string[],
  ) => Promise<Cw20TokenBalance[]>;
}

class QueryRegistry {
  private readonly registryMap: Map<string, IQuery> = new Map();

  public get(chainId: string): IQuery | undefined {
    return this.registryMap.get(chainId);
  }

  public register(chainId: string, query: IQuery): void {
    this.registryMap.set(chainId, query);
  }
}

export const queryRegistry = new QueryRegistry();
const cosmwasmQuery = new CosmwasmQuery();
queryRegistry.register(OnekeyNetwork.juno, cosmwasmQuery);
queryRegistry.register(OnekeyNetwork.terra, cosmwasmQuery); // terra2
queryRegistry.register(OnekeyNetwork.osmosis, cosmwasmQuery);
queryRegistry.register(OnekeyNetwork.secretnetwork, new SecretwasmQuery());

const mintScanQuery = new MintScanQuery();
queryRegistry.register(OnekeyNetwork.cosmoshub, mintScanQuery);
queryRegistry.register(OnekeyNetwork.akash, mintScanQuery);
queryRegistry.register(OnekeyNetwork.fetch, mintScanQuery);
