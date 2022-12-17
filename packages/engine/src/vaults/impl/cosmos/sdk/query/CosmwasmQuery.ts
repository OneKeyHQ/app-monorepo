import BigNumber from 'bignumber.js';
import { get } from 'lodash';

import type {
  Cw20AssetInfo,
  Cw20TokenBalance,
  IQuery,
  QueryChainInfo,
} from './IQuery';
import type { AxiosInstance } from 'axios';

interface Cw20TokenInfoResponse {
  'name': string;
  'symbol': string;
  'decimals': number;
  'total_supply': string;
}

export class CosmwasmQuery implements IQuery {
  //
  //   /**
  //   * deprecated
  //   * less than wasmd_0.24
  //   */
  //   public async queryContract(
  //     contractAddress: string,
  //     query: any,
  //   ): Promise<any> {
  //     const queryHex = Buffer.from(JSON.stringify(query), 'utf-8').toString(
  //       'hex',
  //     );
  //     return this.axios
  //       .get<{ result: { smart: string } }>(
  //         `/wasm/contract/${contractAddress}/smart/${queryHex}?encoding=utf-8`,
  //       )
  //       .then((i) => Buffer.from(i.data.result.smart, 'base64').toString());
  //   }

  async queryContract(
    axios: AxiosInstance,
    contractAddress: string,
    query: any,
  ): Promise<any> {
    const queryBase64 = Buffer.from(JSON.stringify(query), 'utf-8').toString(
      'base64',
    );

    return axios
      .get<{ data: unknown }>(
        `/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${queryBase64}`,
      )
      .then((i) => i.data.data);
  }

  public async queryCw20TokenInfo(
    chainInfo: QueryChainInfo,
    contractAddressArray: string[],
  ): Promise<Cw20AssetInfo[]> {
    const { axios } = chainInfo;
    if (!axios) throw new Error('axios is not defined');

    return Promise.all(
      contractAddressArray.map((contractAddress) =>
        this.queryContract(axios, contractAddress, {
          token_info: {},
        }).then((result: Cw20TokenInfoResponse) => ({
          contractAddress,
          name: result.name,
          decimals: result.decimals,
          symbol: result.symbol,
        })),
      ),
    );
  }

  public async queryCw20TokenBalance(
    chainInfo: QueryChainInfo,
    contractAddress: string,
    address: string[],
  ): Promise<Cw20TokenBalance[]> {
    const { axios } = chainInfo;
    if (!axios) throw new Error('axios is not defined');

    return Promise.all(
      address.map((i) =>
        this.queryContract(axios, contractAddress, {
          balance: { address: i },
        }).then((result) => {
          let balance: BigNumber;
          try {
            balance = new BigNumber(get(result, 'balance', '0'));
          } catch (error) {
            balance = new BigNumber(0);
          }
          return {
            address: result,
            balance,
          };
        }),
      ),
    );
  }
}
