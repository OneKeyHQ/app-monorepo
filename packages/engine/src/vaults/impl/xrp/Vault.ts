/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';
import * as XRPL from 'xrpl';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { InvalidAddress } from '../../../errors';
import { DBSimpleAccount } from '../../../types/account';
import {
  IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxLegacy,
  IDecodedTxStatus,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTx,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { IEncodedTxXrp } from './types';

let clientInstance: XRPL.Client | null = null;
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

  getClientCache = memoizee(
    async (rpcUrl) => {
      if (!clientInstance) {
        clientInstance = new XRPL.Client(rpcUrl);
      }
      if (!clientInstance.isConnected()) {
        await clientInstance.connect();
      }
      return clientInstance;
    },
    {
      promise: true,
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = new XRPL.Client(url);
    if (!client.isConnected()) {
      await client.connect();
    }
    const start = performance.now();
    const response = await client.request({
      command: 'ledger',
      ledger_index: 'validated',
    });
    const latestBlock = response.result.ledger_index;
    client.disconnect();
    return {
      responseTime: Math.floor(performance.now() - start),
      latestBlock,
    };
  }

  override async validateAddress(address: string): Promise<string> {
    if (XRPL.isValidClassicAddress(address)) {
      return Promise.resolve(address);
    }
    return Promise.reject(new InvalidAddress());
  }

  override async decodeTx(
    encodedTx: IEncodedTxXrp,
    payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const decodedTx: IDecodedTx = {
      txid: '',
      owner: encodedTx.Account,
      signer: encodedTx.Account,
      nonce: 0,
      actions: [
        {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          nativeTransfer: {
            tokenInfo: token,
            from: encodedTx.Account,
            to: encodedTx.Destination,
            amount: new BigNumber(encodedTx.Amount)
              .shiftedBy(-network.decimals)
              .toFixed(),
            amountValue: encodedTx.Amount,
            extraInfo: null,
          },
          direction:
            encodedTx.Destination === dbAccount.address
              ? IDecodedTxDirection.SELF
              : IDecodedTxDirection.OUT,
        },
      ],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      payload,
      extraInfo: null,
    };

    return decodedTx;
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxXrp> {
    const { to, amount } = transferInfo;
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const client = await this.getClient();
    const prepared = await client.autofill({
      TransactionType: 'Payment',
      Account: dbAccount.address,
      Amount: XRPL.xrpToDrops(amount),
      Destination: to,
    });
    return {
      ...prepared,
    };
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    return Promise.resolve(encodedTx);
  }

  override async broadcastTransaction(signedTx: ISignedTx): Promise<ISignedTx> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const client = await this.getClient();
    try {
      const result = await client.submitAndWait(signedTx.rawTx);
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

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    return Promise.all(
      txids.map(async (txid) => {
        const client = await this.getClient();
        const response = await client.request({
          command: 'tx',
          transaction: txid,
          binary: false,
        });
        const transactionResult =
          (response.result?.meta as XRPL.TransactionMetadata)
            ?.TransactionResult ?? '';
        if (transactionResult === 'tesSUCCESS') {
          return TransactionStatus.CONFIRM_AND_SUCCESS;
        }
        if (transactionResult.startsWith('tef')) {
          return TransactionStatus.CONFIRM_BUT_FAILED;
        }
        return TransactionStatus.PENDING;
      }),
    );
  }

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    return Promise.resolve(params.encodedTx);
  }

  override async fetchFeeInfo(encodedTx: IEncodedTxXrp): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    return {
      customDisabled: true,
      limit: XRPL.dropsToXrp(encodedTx.Fee ?? '0'),
      prices: ['1'],
      defaultPresetIndex: '0',
      feeSymbol: 'XRP',
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
    };
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        const client = await this.getClient();
        try {
          const response = await client.request({
            'command': 'account_info',
            'account': address,
            'ledger_index': 'validated',
          });

          return new BigNumber(response.result?.account_data?.Balance);
        } catch (error) {
          console.error(error);
          throw error;
        }
      }),
    );

    return result;
  }
}
