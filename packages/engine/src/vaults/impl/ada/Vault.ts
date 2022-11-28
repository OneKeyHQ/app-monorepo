/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_ADA } from '../../../constants';
import { InvalidAddress, NotImplemented } from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxActionNativeTransfer,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxLegacy,
  IDecodedTxStatus,
  IEncodedTx,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTx,
  ITransferInfo,
  IUnsignedTxPro,
  IUtxoAddressInfo,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { validBootstrapAddress, validShelleyAddress } from './helper/addresses';
import Client from './helper/client';
import { CardanoApi } from './helper/sdk';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { IAdaAmount, IAdaHistory, IEncodedTxADA } from './types';

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

  override validateWatchingCredential(input: string): Promise<boolean> {
    let ret = false;
    try {
      if (this.settings.watchingAccountEnabled && validShelleyAddress(input)) {
        ret = true;
      }
    } catch {
      // ignore
    }
    return Promise.resolve(ret);
  }

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxADA;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxADA> {
    return Promise.resolve(params.encodedTx);
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
    const stakeAddress = await this.getStakeAddress(dbAccount.address);
    const { decimals, feeDecimals } = await this.engine.getNetwork(
      this.networkId,
    );
    const client = await this.getClient();
    const utxos = await client.getUTXOs(stakeAddress);

    const amountBN = new BigNumber(amount).shiftedBy(decimals);
    const txPlan = await CardanoApi.composeTxPlan(
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
    const { fee, inputs, outputs, totalSpent, tx } = txPlan;
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
      tx,
    };
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new NotImplemented();
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  updateEncodedTx(encodedTx: IEncodedTx): Promise<IEncodedTx> {
    return Promise.resolve(encodedTx);
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxADA,
  ): Promise<IUnsignedTxPro> {
    const { inputs, outputs } = encodedTx;

    const ret = {
      inputs,
      outputs,
      payload: {},
      encodedTx,
    };

    return Promise.resolve(ret as unknown as IUnsignedTxPro);
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string | undefined;
    localHistory?: IHistoryTx[] | undefined;
  }): Promise<IHistoryTx[]> {
    const { localHistory = [] } = options;

    const client = await this.getClient();
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const stakeAddress = await this.getStakeAddress(dbAccount.address);
    const { decimals, symbol } = await this.engine.getNetwork(this.networkId);
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let txs: IAdaHistory[] = [];

    try {
      txs = (await client.getHistory(stakeAddress)) ?? [];
    } catch (e) {
      console.error(e);
    }

    const promises = txs.map((tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.tx_hash,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          // No need to update.
          return null;
        }
        const {
          utxoFrom,
          utxoTo,
          totalOut,
          totalIn,
          fee,
          block_hash: blockHash,
          tx_timestamp: txTimestamp,
        } = tx.tx;
        const totalOutBN = new BigNumber(totalOut);
        const totalInBN = new BigNumber(totalIn);

        let direction = IDecodedTxDirection.IN;
        if (totalOutBN.gt(totalInBN)) {
          direction = utxoTo.every(({ isMine }) => isMine)
            ? IDecodedTxDirection.SELF
            : IDecodedTxDirection.OUT;
        }
        let amountValue = totalOutBN.minus(totalIn).abs();
        if (
          direction === IDecodedTxDirection.OUT &&
          utxoFrom.every(({ isMine }) => isMine)
        ) {
          amountValue = amountValue.minus(fee);
        }
        const decodedTx: IDecodedTx = {
          txid: tx.tx_hash,
          owner: dbAccount.address,
          signer: dbAccount.address,
          nonce: 0,
          actions: [
            {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                utxoFrom,
                utxoTo,
                from: utxoFrom.find((utxo) => !!utxo.address)?.address ?? '',
                to: utxoTo.find((utxo) => !!utxo.address)?.address ?? '',
                amount: amountValue.shiftedBy(-decimals).toFixed(),
                amountValue: amountValue.toFixed(),
                extraInfo: null,
              },
            },
          ],
          status: blockHash
            ? IDecodedTxStatus.Confirmed
            : IDecodedTxStatus.Pending,
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
          totalFeeInNative: new BigNumber(fee).shiftedBy(-decimals).toFixed(),
        };
        decodedTx.updatedAt =
          typeof txTimestamp !== 'undefined' ? txTimestamp * 1000 : Date.now();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
        return this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        console.error(e);
        return Promise.resolve(null);
      }
    });
    return (await Promise.all(promises)).filter(Boolean);
  }

  override async broadcastTransaction(signedTx: ISignedTx): Promise<ISignedTx> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const client = await this.getClient();
    try {
      const result = await client.submitTx(signedTx.rawTx);
      console.log(result);
    } catch (err) {
      debugLogger.sendTx.info('broadcastTransaction ERROR:', err);
      throw err;
    }

    debugLogger.engine.info('broadcastTransaction END:', {
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    });

    return {
      ...signedTx,
      encodedTx: signedTx.encodedTx,
    };
  }

  override async fetchFeeInfo(encodedTx: IEncodedTxADA): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    return {
      customDisabled: true,
      limit: encodedTx.totalFeeInNative,
      prices: ['1'],
      defaultPresetIndex: '0',
      feeSymbol: network.symbol,
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
    };
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        try {
          const stakeAddress = await this.getStakeAddress(address);
          const balance = await client.getBalance(stakeAddress);
          return balance;
        } catch {
          return new BigNumber(0);
        }
      }),
    );

    return result;
  }

  private getStakeAddress = memoizee(
    async (address: string) => {
      if (validShelleyAddress(address) && address.startsWith('stake')) {
        return address;
      }
      const account = (await this.engine.dbApi.getAccountByAddress({
        address,
        coinType: COINTYPE_ADA,
      })) as DBUTXOAccount;
      return account.addresses['2/0'];
    },
    {
      maxAge: 1000 * 60 * 30,
      promise: true,
    },
  );
}
