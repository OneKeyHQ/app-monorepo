import Axios from 'axios';
import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import type { AxiosInstance } from 'axios';
import type {
  Cw20TokenBalance,
  Cw20AssetInfo as ICw20AssetInfo,
  IQuery,
  QueryChainInfo,
} from './IQuery';
import type {
  AssetInfo,
  ContractsInfo,
  Cw20AssetInfo,
  RelayerPaths,
  Transaction,
} from './mintScanTypes';

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

  async fetchCw20TokenInfos(networkId: string): Promise<Cw20AssetInfo[]> {
    const chain = NetworkIDMinScanMap[networkId];
    if (!chain) return [];
    try {
      const resp = await this.axios.get<{ assets: Cw20AssetInfo[] }>(
        `/v2/assets/${chain}/cw20`,
      );
      return resp.data.assets;
    } catch (error) {
      return [];
    }
  }

  async queryCw20TokenInfo(
    chainInfo: QueryChainInfo,
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
    chainInfo: QueryChainInfo,
    contractAddress: string,
    address: string[],
  ): Promise<Cw20TokenBalance[]> {
    const balance = address.reduce((acc, cur) => {
      acc.push({
        address: cur,
        balance: new BigNumber('0'),
      });
      return acc;
    }, [] as Cw20TokenBalance[]);
    return Promise.resolve(balance);
  }

  async fetchAssertInfos(networkId: string): Promise<AssetInfo[]> {
    const chain = NetworkIDMinScanMap[networkId];
    if (!chain) return [];
    try {
      const resp = await this.axios.get<{ assets: AssetInfo[] }>(
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
  ): Promise<ContractsInfo | undefined> {
    try {
      const chain = NetworkIDMinScanMap[networkId];
      if (!chain) return;

      const resp = await this.axios.get<{ contract: ContractsInfo }>(
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

      const resp = await this.axios.get<{ sendable: RelayerPaths[] }>(
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

      const resp = await this.axios.get<Transaction[]>(
        `/v1/${chain}/account/${address}/txs?limit=${limit}&from=${from}`,
      );
      return resp.data;
    } catch (error) {
      // ignore
    }
  }
}
