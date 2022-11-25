/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { InvalidAddress } from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import {
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  ITransferInfo,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { validBootstrapAddress, validShelleyAddress } from './helper/addresses';
import Client from './helper/client';
import { CardanoApi } from './helper/sdk';
import { deriveAccountXpub } from './helper/shelley-address';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(rpcURL);
  }

  private getClientCache = memoizee((rpcUrl: string) => new Client(rpcUrl), {
    maxAge: 60 * 1000 * 3,
  });

  override async getClientEndpointStatus(): Promise<{
    responseTime: number;
    latestBlock: number;
  }> {
    const start = performance.now();
    const client = await this.getClient();
    const result = await client.latestBlock();
    return {
      responseTime: Math.floor(performance.now() - start),
      latestBlock: result.height,
    };
  }

  override async validateAddress(address: string): Promise<string> {
    if (validShelleyAddress(address) || validBootstrapAddress(address)) {
      return Promise.resolve(address);
    }
    return Promise.reject(new InvalidAddress());
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<any> {
    const { to, amount } = transferInfo;
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const { decimals } = await this.engine.getNetwork(this.networkId);
    const client = await this.getClient();
    const utxos = await client.getUTXOs(dbAccount.address);
    console.log('utxos: ', utxos);
    console.log('transferInfo: ', transferInfo);

    console.log(CardanoApi);

    const amountBN = new BigNumber(transferInfo.amount).shiftedBy(decimals);
    const txPlan = CardanoApi.composeTxPlan(
      transferInfo,
      dbAccount.xpub,
      utxos,
      dbAccount.address,
      [
        {
          address: to,
          amount: amountBN.toFixed(),
          assets: [],
        },
      ],
    );
    console.log(txPlan);

    // const result = await CardanoApi.buildSendADATransaction(
    //   {
    //     ...transferInfo,
    //     amount: amountBN.toFixed(),
    //   },
    //   utxos,
    // );
    // console.log(result);
    throw new Error('not implemention');
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        const balance = await client.getBalance(address);
        return balance;
      }),
    );

    return result;
  }
}
