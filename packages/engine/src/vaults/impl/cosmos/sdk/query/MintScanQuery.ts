import Axios from 'axios';
import BigNumber from 'bignumber.js';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

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
import type { AxiosInstance } from 'axios';

const NetworkIDMinScanMap: Record<string, string> = {
  [OnekeyNetwork.cryptoorgchain]: 'cryptoorg',
  [OnekeyNetwork.cosmoshub]: 'cosmos',
  [OnekeyNetwork.akash]: 'akash',
  [OnekeyNetwork.fetch]: 'fetchai',
  [OnekeyNetwork.juno]: 'juno',
  [OnekeyNetwork.osmosis]: 'osmosis',
  [OnekeyNetwork.secretnetwork]: 'secret',
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
    return Promise.resolve([] as ICw20AssetInfo[]);
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

  private async proxyFetchAssets(url: string) {
    try {
      const proxyUrl = `https://mirror.ghproxy.com/${url}`;
      const resp = await this.axios.get<{ assets: AssetInfo[] }>(proxyUrl);
      return resp.data.assets;
    } catch (proxyError) {
      try {
        const resp = await this.axios.get<{ assets: AssetInfo[] }>(url);
        return resp.data.assets;
      } catch (error) {
        return [];
      }
    }
  }

  async fetchAssertInfos(networkId: string): Promise<AssetInfo[]> {
    const chain = NetworkIDMinScanMap[networkId];
    if (!chain) return [];
    try {
      const resp = await this.proxyFetchAssets(
        `https://raw.githubusercontent.com/cosmos/chain-registry/master/${chain}/assetlist.json`,
      );
      return resp;
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
