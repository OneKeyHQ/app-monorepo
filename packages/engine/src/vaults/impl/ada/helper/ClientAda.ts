import axios from 'axios';
import BigNumber from 'bignumber.js';
import { isUndefined } from 'lodash';
import memoizee from 'memoizee';

import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { OneKeyInternalError } from '../../../../errors';

import type { Token } from '../../../../types/token';
import type {
  IAdaAccount,
  IAdaAddress,
  IAdaAddressDetail,
  IAdaAmount,
  IAdaHistory,
  IAdaTransaction,
  IAdaUTXO,
  IAsset,
} from '../types';
import type { AxiosInstance } from 'axios';

function isInvalidTokenName(text: string) {
  // eslint-disable-next-line no-control-regex
  return !/^[\x00-\x7F]+$/.test(text);
}

class ClientAda {
  readonly request: AxiosInstance;

  readonly backendRequest: AxiosInstance;

  constructor(url: string) {
    this.request = axios.create({
      baseURL: url,
      timeout: 20000,
    });

    this.backendRequest = axios.create({
      baseURL: `${getFiatEndpoint()}/cardano`,
      timeout: 20000,
    });
  }

  async latestBlock() {
    const res = await this.request
      .get<{ height: number }>('/blocks/latest')
      .then((i) => i.data);
    return {
      height: Number(res.height ?? 0),
    };
  }

  async getAddress(address: string): Promise<IAdaAddress> {
    return this.request
      .get<IAdaAddress>(`/addresses/${address}`)
      .then((i) => i.data);
  }

  async getAddressDetails(address: string): Promise<IAdaAddressDetail> {
    try {
      const { data } = await this.request.get<IAdaAddressDetail>(
        `/addresses/${address}/total`,
      );
      return data;
    } catch {
      return {
        address,
        tx_count: 0,
      };
    }
  }

  async getAccount(stakeAddress: string): Promise<IAdaAccount> {
    return this.request
      .get<IAdaAccount>(`/accounts/${stakeAddress}`)
      .then((i) => i.data);
  }

  getAssociatedAddresses = memoizee(
    async (stakeAddress: string): Promise<string[]> => {
      const res = await this.request
        .get<{ address: string }[]>(`/accounts/${stakeAddress}/addresses`)
        .then((i) => i.data);
      return res.map((i) => i.address);
    },
    {
      promise: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  async getBalance(stakeAddress: string): Promise<BigNumber> {
    const res = await this.request
      .get<IAdaAccount>(`/accounts/${stakeAddress}`)
      .then((i) => i.data);
    const balance = new BigNumber(res.controlled_amount) ?? 0;
    return balance;
  }

  async getBalanceWithLovelace(stakeAddress: string): Promise<IAdaAmount> {
    const res = await this.request
      .get<IAdaAccount>(`/accounts/${stakeAddress}`)
      .then((i) => i.data);
    return {
      unit: 'lovelace',
      quantity: res.controlled_amount ?? '0',
    };
  }

  getUTXOs = memoizee(
    async (
      xpub: string,
      path: string,
      addresses: Record<string, string>,
    ): Promise<IAdaUTXO[]> => {
      // const { xpub, addresses, path } = dbAccount;
      const stakeAddress = addresses['2/0'];
      const { data } = await this.backendRequest.get<IAdaUTXO[]>(
        `/utxos?stakeAddress=${stakeAddress}&xpub=${xpub}`,
      );
      const pathIndex = path.split('/')[3];
      return data.map((utxo) => {
        let { path: utxoPath } = utxo;
        if (utxoPath && utxoPath.length > 0) {
          const pathArray = utxoPath.split('/');
          pathArray.splice(3, 1, pathIndex);
          utxoPath = pathArray.join('/');
        }
        return { ...utxo, path: utxoPath, output_index: utxo.tx_index };
      });
    },
    {
      promise: true,
      maxAge: getTimeDurationMs({ minute: 1 }),
    },
  );

  getHistory = memoizee(
    async (stakeAddress: string, address: string): Promise<IAdaHistory[]> =>
      this.backendRequest
        .get<IAdaHistory[]>(`/history`, {
          params: {
            stakeAddress,
            address,
          },
        })
        .then((i) => i.data),
    {
      promise: true,
      maxAge: getTimeDurationMs({ seconds: 30 }),
    },
  );

  async getRawTransaction(txid: string): Promise<IAdaTransaction> {
    return this.request
      .get<IAdaTransaction>(`/txs/${txid}`)
      .then((i) => i.data);
  }

  async submitTx(data: string) {
    let tx: Buffer | null = null;
    if (typeof data === 'string') {
      tx = Buffer.from(data, 'hex');
    } else {
      tx = Buffer.from(data);
    }

    return this.request
      .post<{ data: any }>('/tx/submit', tx, {
        headers: {
          'Content-Type': 'application/cbor',
        },
      })
      .then((i) => i.data);
  }

  getAssetDetail = memoizee(
    async ({
      asset,
      networkId,
      dangerouseFallbackDecimals,
    }: {
      asset: string;
      networkId: string;
      dangerouseFallbackDecimals?: number;
    }): Promise<Token> => {
      const { data } = await this.request.get<IAsset>(`/assets/${asset}`);
      const { asset_name: assetName, metadata } = data;
      const decodeName = Buffer.from(assetName, 'hex').toString('utf8');
      const isValidTokenName = !isInvalidTokenName(decodeName);
      const name = isValidTokenName ? decodeName : assetName;

      if (
        isUndefined(metadata?.decimals) &&
        isUndefined(dangerouseFallbackDecimals)
      ) {
        throw new OneKeyInternalError(`Invalid token address: ${asset}`);
      }

      return {
        id: `${networkId}--${asset}`,
        address: asset,
        decimals: metadata?.decimals ?? (dangerouseFallbackDecimals as number),
        impl: 'ada',
        isNative: false,
        networkId,
        symbol: metadata?.ticker ?? name,
        name: metadata?.name ?? name,
        tokenIdOnNetwork: asset,
        logoURI: '',
      };
    },
    {
      promise: true,
      maxAge: getTimeDurationMs({ minute: 1 }),
      normalizer: (...args) => JSON.stringify(args),
    },
  );

  async getAssetsBalances(stakeAddress: string): Promise<IAdaAmount[]> {
    return this.request
      .get<IAdaAmount[]>(`/accounts/${stakeAddress}/addresses/assets`)
      .then((i) => i.data);
  }
}

export default ClientAda;
