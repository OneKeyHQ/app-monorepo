/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { InvalidAddress } from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import {
  IDecodedTx,
  IDecodedTxActionNativeTransfer,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxLegacy,
  IDecodedTxStatus,
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
import { IAdaAmount, IEncodedTxADA } from './types';

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

  override async decodeTx(
    encodedTx: IEncodedTxADA,
    payload?: any,
  ): Promise<IDecodedTx> {
    const { inputs, outputs, transferInfo } = encodedTx;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const nativeTransfer: IDecodedTxActionNativeTransfer = {
      tokenInfo: token,
      utxoFrom: inputs.map((input) => {
        const { balance, balanceValue } = this.getInputOrOutputBalance(
          input.amount,
          network.decimals,
        );
        return {
          address: input.address,
          balance,
          balanceValue,
          symbol: network.symbol,
          isMine: true,
        };
      }),
      utxoTo: outputs.map((output) => ({
        address: output.address,
        balance: new BigNumber(output.amount)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: output.amount,
        symbol: network.symbol,
        isMine: output.address === dbAccount.address,
      })),
      from: dbAccount.address,
      to: transferInfo.to,
      amount: new BigNumber(outputs[0].amount)
        .shiftedBy(-network.decimals)
        .toFixed(),
      amountValue: outputs[0].amount,
      extraInfo: null,
    };
    return {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions: [
        {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          direction:
            outputs[0].address === dbAccount.address
              ? IDecodedTxDirection.OUT
              : IDecodedTxDirection.SELF,
          nativeTransfer,
        },
      ],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      totalFeeInNative: encodedTx.totalFeeInNative,
    };
  }

  private getInputOrOutputBalance = (
    amounts: IAdaAmount[],
    decimals: number,
    asset = 'lovelace',
  ): { balance: string; balanceValue: string } => {
    const item = amounts.filter((amount) => amount.unit === asset);
    if (!item || item.length <= 0) {
      return { balance: '0', balanceValue: '0' };
    }
    const amount = item[0]?.quantity ?? '0';
    return {
      balance: new BigNumber(amount).shiftedBy(-decimals).toFixed(),
      balanceValue: amount,
    };
  };

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxADA> {
    const { to, amount } = transferInfo;
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const { decimals, feeDecimals } = await this.engine.getNetwork(
      this.networkId,
    );
    const client = await this.getClient();
    const utxos = await client.getUTXOs(dbAccount.address);

    const amountBN = new BigNumber(amount).shiftedBy(decimals);
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

    // @ts-expect-error
    const { fee, inputs, outputs, totalSpent } = txPlan;
    const totalFeeInNative = new BigNumber(fee)
      .shiftedBy(-1 * feeDecimals)
      .toFixed();
    return {
      inputs,
      outputs,
      fee,
      totalSpent,
      totalFeeInNative,
      transferInfo,
    };
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
