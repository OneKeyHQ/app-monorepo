import Axios from 'axios';
import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import type {
  ICosmosCw20TokenBalance,
  ICosmosQueryChainInfo,
  ICosmosCw20AssetInfo as ICw20AssetInfo,
  IQuery,
} from './IQuery';
import type {
  ICosmosAssetInfo,
  ICosmosContractsInfo,
  ICosmosCw20AssetInfo,
  ICosmosRelayerPaths,
  ICosmosTransaction,
} from './mintScanTypes';
import type { AxiosInstance } from 'axios';

const NetworkIDMinScanMap: Record<string, string> = {
  [getNetworkIdsMap().cryptoorgchain]: 'cryptoorg',
  [getNetworkIdsMap().cosmoshub]: 'cosmos',
  [getNetworkIdsMap().akash]: 'akash',
  [getNetworkIdsMap().fetch]: 'fetchai',
  [getNetworkIdsMap().juno]: 'juno',
  [getNetworkIdsMap().osmosis]: 'osmosis',
  [getNetworkIdsMap().secretnetwork]: 'secret',
  // [getNetworkIdsMap().injective]: 'injective',
};

export class MintScanQuery implements IQuery {
  private readonly axios: AxiosInstance;

  constructor() {
    this.axios = Axios.create({
      baseURL: 'https://api.mintscan.io',
      timeout: 30 * 1000,
    });
  }

  async fetchCw20TokenInfos(
    networkId: string,
  ): Promise<ICosmosCw20AssetInfo[]> {
    const chain = NetworkIDMinScanMap[networkId];
    if (!chain) return [];
    try {
      const resp = await this.axios.get<{ assets: ICosmosCw20AssetInfo[] }>(
        `/v2/assets/${chain}/cw20`,
      );
      return resp.data.assets;
    } catch (error) {
      return [];
    }
  }

  async queryCw20TokenInfo(
    chainInfo: ICosmosQueryChainInfo,
    contractAddressArray: string[],
  ): Promise<ICw20AssetInfo[]> {
    const { networkId } = chainInfo;
    const cw20Tokens = await this.fetchCw20TokenInfos(networkId);

    const contractsSet = contractAddressArray.reduce((acc, cur) => {
      if (acc.has(cur)) return acc;
      return acc.add(cur);
    }, new Set<string>());

    const tokens = cw20Tokens.reduce((acc, cur) => {
      if (contractsSet.has(cur.contract_address)) {
        acc.push({
          contractAddress: cur.contract_address,
          name: cur.denom,
          decimals: cur.decimal,
          symbol: cur.denom,
        });
      }
      return acc;
    }, [] as ICw20AssetInfo[]);
    return tokens;
  }

  async queryCw20TokenBalance(
    chainInfo: ICosmosQueryChainInfo,
    contractAddress: string,
    address: string[],
  ): Promise<ICosmosCw20TokenBalance[]> {
    const balance = address.reduce((acc, cur) => {
      acc.push({
        address: cur,
        balance: new BigNumber('0'),
      });
      return acc;
    }, [] as ICosmosCw20TokenBalance[]);
    return Promise.resolve(balance);
  }

  async fetchAssertInfos(networkId: string): Promise<ICosmosAssetInfo[]> {
    const chain = NetworkIDMinScanMap[networkId];
    if (!chain) return [];
    try {
      const resp = await this.axios.get<{ assets: ICosmosAssetInfo[] }>(
        `/v2/assets/${chain}`,
      );
      return resp.data.assets;
    } catch (error) {
      return [];
    }
  }

  async fetchContractsInfo(
    networkId: string,
    contracts: string,
  ): Promise<ICosmosContractsInfo | undefined> {
    try {
      const chain = NetworkIDMinScanMap[networkId];
      if (!chain) return;

      const resp = await this.axios.get<{ contract: ICosmosContractsInfo }>(
        `/v1/${chain}/wasm/contracts/${contracts}`,
      );
      return resp.data.contract;
    } catch (error) {
      // ignore
    }
  }

  async fetchRelayerPaths(networkId: string) {
    try {
      const chain = NetworkIDMinScanMap[networkId];
      if (!chain) return;

      const resp = await this.axios.get<{ sendable: ICosmosRelayerPaths[] }>(
        `/v1/relayer/${chain}/paths`,
      );
      return resp.data.sendable;
    } catch (error) {
      // ignore
    }
  }

  // https://api.mintscan.io/v1/cosmos/account/cosmos16ds6gn6rlzlz09qm9an725kp4shklyrq7hm0le/txs?limit=50&from=0
  async fetchAccountTxs(
    networkId: string,
    address: string,
    limit = 50,
    from = 0,
  ) {
    try {
      const chain = NetworkIDMinScanMap[networkId];
      if (!chain) return;

      const resp = await this.axios.get<ICosmosTransaction[]>(
        `/v1/${chain}/account/${address}/txs?limit=${limit}&from=${from}`,
      );
      return resp.data;
    } catch (error) {
      // ignore
    }
  }
}
