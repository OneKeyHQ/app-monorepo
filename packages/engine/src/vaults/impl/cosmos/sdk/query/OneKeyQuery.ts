import Axios from 'axios';
import BigNumber from 'bignumber.js';

import { getFiatEndpoint } from '../../../../../endpoint';

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
  Transaction,
} from './mintScanTypes';
import type { AxiosInstance } from 'axios';

export class OneKeyQuery implements IQuery {
  private readonly axios: AxiosInstance;

  constructor() {
    this.axios = Axios.create({
      baseURL: `${getFiatEndpoint()}/cosmos`,
      timeout: 20000,
    });
  }

  async fetchCw20TokenInfos(networkId: string): Promise<Cw20AssetInfo[]> {
    return Promise.resolve([]);
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

  async fetchAssertInfos(networkId: string): Promise<AssetInfo[]> {
    try {
      const resp = await this.axios.get<{
        data?: AssetInfo[];
      }>(`/assets/${networkId}`);
      return resp.data.data ?? [];
    } catch (error) {
      throw new Error('Failed to obtain assets info');
    }
  }

  async fetchContractsInfo(
    networkId: string,
    contracts: string,
  ): Promise<ContractsInfo | undefined> {
    return Promise.resolve(undefined);
  }

  // https://api.mintscan.io/v1/cosmos/account/cosmos16ds6gn6rlzlz09qm9an725kp4shklyrq7hm0le/txs?limit=50&from=0
  async fetchAccountTxs(
    networkId: string,
    address: string,
    limit = 50,
    from = 0,
  ): Promise<Transaction[] | undefined> {
    return Promise.resolve(undefined);
  }
}
