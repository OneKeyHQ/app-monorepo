/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { InvalidAddress, NotImplemented } from '../../../errors';
import {
  type IApproveInfo,
  type IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  type IDecodedTxLegacy,
  IDecodedTxStatus,
  type IFeeInfo,
  type IFeeInfoUnit,
  type ITransferInfo,
  type IUnsignedTxPro,
} from '../../types';
import { coinSelect } from '../../utils/btcForkChain/utils';
import { VaultBase } from '../../VaultBase';

import { ClientDynex } from './helper/ClientDynex';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { AccountCredentialType } from '../../../types/account';
import type {
  PartialTokenInfo,
  TransactionStatus,
} from '../../../types/provider';
import type { IHistoryTx, ISignedTxPro } from '../../types';
import type { IEncodedTxDynex, IUnspentOutput } from './types';

const DEFAULT_TX_FEE = 1000000;

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  private async getClient(url?: string): Promise<ClientDynex> {
    const rpcURL = await this.getRpcUrl();
    return this.createClientFromURL(url ?? rpcURL);
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getClient(url);
    const start = performance.now();
    const latestBlock = await client.getBlockCount();
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  override createClientFromURL = memoizee(
    (rpcURL: string) => new ClientDynex(rpcURL),
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    const balances: (BigNumber | undefined)[] = [];
    for (let i = 0; i < requests.length; i += 1) {
      const balance = await client.getBalanceOfAddress(requests[i].address);
      balances.push(balance);
    }

    return balances;
  }

  override updateEncodedTxTokenApprove(
    encodedTx: IEncodedTxDynex,
    amount: string,
  ): Promise<IEncodedTxDynex> {
    throw new Error('Method not implemented.');
  }

  override buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxDynex,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override async fetchFeeInfo(): Promise<IFeeInfo> {
    const network = await this.getNetwork();
    const minFee = DEFAULT_TX_FEE;

    const prices = [
      new BigNumber(minFee).shiftedBy(-network.feeDecimals).toFixed(),
    ];

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit: '1',
      prices,
      defaultPresetIndex: '0',
      tx: null,
    };
  }

  override getExportedCredential(
    password: string,
    credentialType: AccountCredentialType,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<(PartialTokenInfo | undefined)[]> {
    throw new Error('Method not implemented.');
  }

  override updateEncodedTx(
    encodedTx: IEncodedTxDynex,
  ): Promise<IEncodedTxDynex> {
    return Promise.resolve(encodedTx);
  }

  override async decodeTx(
    encodedTx: IEncodedTxDynex,
    payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const address = await this.getAccountAddress();
    const token = await this.engine.getNativeTokenInfo(this.networkId);

    const actions = [];

    actions.push({
      type: IDecodedTxActionType.NATIVE_TRANSFER,
      nativeTransfer: {
        tokenInfo: token,
        from: encodedTx.from,
        to: encodedTx.to,
        amount: encodedTx.amount,
        amountValue: new BigNumber(encodedTx.amount)
          .shiftedBy(network.decimals)
          .toFixed(),
        extraInfo: null,
      },
      direction:
        encodedTx.to === address
          ? IDecodedTxDirection.SELF
          : IDecodedTxDirection.OUT,
    });

    const decodedTx: IDecodedTx = {
      txid: '',
      owner: address,
      signer: encodedTx.from || address,
      nonce: 0,
      actions,
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      payload,
      extraInfo: null,
    };

    return decodedTx;
  }

  override decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTxDynex> {
    throw new NotImplemented();
  }

  override attachFeeInfoToEncodedTx({
    encodedTx,
  }: {
    encodedTx: IEncodedTxDynex;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxDynex> {
    return Promise.resolve(encodedTx);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxDynex> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const network = await this.getNetwork();

    const unspentOutputs = await this._collectUnspentOutputs();
    const { inputs, finalAmount } = this._collectInputs({
      unspentOutputs: Object.values(unspentOutputs),
      amount: new BigNumber(transferInfo.amount)
        .shiftedBy(network.decimals)
        .toFixed(),
      fee: new BigNumber(DEFAULT_TX_FEE).toFixed(),
    });

    return {
      from: transferInfo.from,
      to: transferInfo.to,
      amount: new BigNumber(finalAmount).shiftedBy(-network.decimals).toFixed(),
      paymentId: transferInfo.paymentId,
      fee: new BigNumber(DEFAULT_TX_FEE)
        .shiftedBy(-network.feeDecimals)
        .toFixed(),
      inputs,
    };
  }

  override async validateAddress(address: string): Promise<string> {
    return this._validateAddressMemo(address);
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
    options?: any,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const client = await this.getClient();
    const txid = await client.broadcastTransaction(signedTx.rawTx);
    debugLogger.engine.info('broadcastTransaction END:', {
      txid,
      rawTx: signedTx.rawTx,
    });
    return signedTx;
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const client = await this.getClient();
    const { localHistory } = options;
    const address = await this.getAccountAddress();
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const network = await this.getNetwork();
    const txs = await client.getTransactionsByAddress(address);

    const promises = txs.map(async (tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.hash,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          return null;
        }

        let direction = IDecodedTxDirection.OUT;
        if (tx.to_address.includes(address)) {
          direction =
            tx.from_address === address
              ? IDecodedTxDirection.SELF
              : IDecodedTxDirection.IN;
        }

        const amountValue = parseInt(tx.amount[0], 16);

        const decodedTx: IDecodedTx = {
          txid: tx.hash ?? '',
          owner: address,
          signer: tx.from_address,
          nonce: 0,
          actions: [
            {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                from: tx.from_address,
                to: tx.to_address[0],
                amount: new BigNumber(amountValue)
                  .shiftedBy(-network.decimals)
                  .toFixed(),
                amountValue: amountValue.toString(10),
                extraInfo: null,
              },
            },
          ],
          status: IDecodedTxStatus.Confirmed,
          totalFeeInNative: new BigNumber(tx.fee)
            .shiftedBy(-network.feeDecimals)
            .toFixed(),
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
        };
        decodedTx.updatedAt = new Date(tx.timestamp * 1000).getTime();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
        return await this.buildHistoryTx({
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

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    const client = await this.getClient();
    return Promise.all(
      txids.map(async (txid) => {
        const response = client.getTransactionStatus(txid);
        return response;
      }),
    );
  }

  _validateAddressMemo = memoizee(
    async (address: string) => {
      const client = await this.getClient();
      const isValid = await client.validateAddress(address);

      if (!isValid) {
        throw new InvalidAddress();
      }
      return Promise.resolve(address);
    },
    {
      max: 5,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  _collectInputs({
    unspentOutputs,
    amount,
    fee,
  }: {
    amount: string;
    fee: string;
    unspentOutputs: IUnspentOutput[];
  }) {
    let finalAmount = new BigNumber(amount);
    const totalUnspentOutputsAmount = unspentOutputs.reduce(
      (acc, output) => acc.plus(output.amount),
      new BigNumber(0),
    );

    if (totalUnspentOutputsAmount.lte(fee)) {
      throw new Error('Insufficient balance');
    }

    if (totalUnspentOutputsAmount.lt(new BigNumber(finalAmount).plus(fee))) {
      finalAmount = totalUnspentOutputsAmount.minus(fee);
    }

    const inputsForCoinSelect = unspentOutputs.map((output) => ({
      txId: '',
      vout: 0,
      value: output.amount,
      address: '',
      path: '',
      ...output,
    }));

    const outputsForCoinSelect = [
      {
        address: '',
        value: finalAmount.plus(fee).toNumber(),
      },
    ];

    const { inputs: inputsFromCoinSelect } = coinSelect({
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate: '0',
    });

    return {
      finalAmount: finalAmount.toFixed(),
      inputs:
        inputsFromCoinSelect?.map((input) => {
          const tempInput = input as unknown as IUnspentOutput;
          return {
            globalIndex: tempInput.globalIndex,
            prevIndex: tempInput.prevIndex,
            prevOutPubkey: tempInput.prevOutPubkey,
            txPubkey: tempInput.txPubkey,
            amount: tempInput.amount,
          };
        }) ?? [],
    };
  }

  async _collectUnspentOutputs() {
    const client = await this.getClient();
    const accountAddress = await this.getAccountAddress();
    const transactions = await client.getTransactionsByAddress(accountAddress);
    const unspentOutputs: Record<
      string,
      {
        prevIndex: number;
        globalIndex: number;
        txPubkey: string;
        prevOutPubkey: string;
        amount: number;
      }
    > = {};

    for (let i = 0; i < transactions.length; i += 1) {
      const tx = transactions[i];
      const transaction = await client.getTransaction(tx.hash);

      if (transaction.address_from === accountAddress) {
        transaction.inputs.forEach((input) => {
          const output = unspentOutputs[input.data.input.key_offsets[0]];
          if (output && output.amount === input.data.input.amount) {
            delete unspentOutputs[input.data.input.key_offsets[0]];
          }
        });
      }

      transaction.outputs_with_address?.forEach((output, index) => {
        if (output.address_to === accountAddress) {
          unspentOutputs[output.globalIndex] = {
            prevIndex: index,
            globalIndex: output.globalIndex,
            txPubkey: transaction.extra.publicKey,
            prevOutPubkey: output.output.target.data.key,
            amount: output.output.amount,
          };
        }
      });
    }

    return unspentOutputs;
  }
}
