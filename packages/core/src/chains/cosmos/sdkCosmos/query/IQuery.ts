import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { CosmwasmQuery } from './CosmwasmQuery';
import { MintScanQuery } from './MintScanQuery';
import { SecretwasmQuery } from './SecretwasmQuery';

import type { AxiosInstance } from 'axios';
import type BigNumber from 'bignumber.js';

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
queryRegistry.register(getNetworkIdsMap().juno, cosmwasmQuery);
// queryRegistry.register(getNetworkIdsMap().terra, cosmwasmQuery); // terra2
queryRegistry.register(getNetworkIdsMap().osmosis, cosmwasmQuery);
queryRegistry.register(getNetworkIdsMap().secretnetwork, new SecretwasmQuery());

const mintScanQuery = new MintScanQuery();
queryRegistry.register(getNetworkIdsMap().cosmoshub, mintScanQuery);
queryRegistry.register(getNetworkIdsMap().akash, mintScanQuery);
queryRegistry.register(getNetworkIdsMap().fetch, mintScanQuery);
