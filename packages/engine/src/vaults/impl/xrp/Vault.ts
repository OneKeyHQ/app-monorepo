/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';
import * as XRPL from 'xrpl';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InvalidAddress,
  InvalidTransferValue,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { getDecodedTxStatus, getTxStatus } from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxXrp, IXrpTransaction } from './types';

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

  private getClientCache = memoizee(
    async (rpcUrl) => {
      // TODO performance
      if (
        !clientInstance ||
        clientInstance?.connection?.getUrl?.() !== rpcUrl
      ) {
        // disconnect previous connection
        if (clientInstance) {
          await this.disconnect();
        }
        // WebSocket wss ws client of xrp sdk
        // client: ws
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

  private disconnect = async () => {
    if (clientInstance && clientInstance.isConnected()) {
      try {
        await clientInstance.disconnect();
        clientInstance = null;
      } catch (error) {
        debugLogger.common.error(error);
      }
    }
  };

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    // TODO performance
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

  override async validateTokenAddress(address: string): Promise<string> {
    throw new NotImplemented();
  }

  override async validateWatchingCredential(input: string): Promise<boolean> {
    let ret = false;
    try {
      if (
        this.settings.watchingAccountEnabled &&
        XRPL.isValidClassicAddress(input)
      ) {
        ret = true;
      }
    } catch {
      // ignore
    }
    return Promise.resolve(ret);
  }

  override async validateImportedCredential(input: string): Promise<boolean> {
    return Promise.resolve(
      this.settings.importedAccountEnabled &&
        /^(00)?[0-9a-zA-Z]{64}$/.test(input),
    );
  }

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return `00${decrypt(password, encryptedPrivateKey)
        .toString('hex')
        .toUpperCase()}`;
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
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

    let destination = to;
    let destinationTag: number | undefined = transferInfo.destinationTag
      ? Number(transferInfo.destinationTag)
      : undefined;
    // Slice destination tag from swap address
    if (!XRPL.isValidAddress(to) && to.indexOf('#') > -1) {
      const [address, tag] = to.split('#');
      destination = address;
      destinationTag = tag ? Number(tag) : undefined;

      if (!XRPL.isValidAddress(address)) {
        throw new InvalidAddress();
      }
    }

    const client = await this.getClient();
    const currentLedgerIndex = await client.getLedgerIndex();
    const prepared = await client.autofill({
      TransactionType: 'Payment',
      Account: dbAccount.address,
      Amount: XRPL.xrpToDrops(amount),
      Destination: destination,
      DestinationTag: destinationTag,
      LastLedgerSequence: currentLedgerIndex + 50,
    });
    return {
      ...prepared,
    };
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxXrp,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override updateEncodedTx(
    encodedTx: IEncodedTxXrp,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    const { amount } = payload;
    if (amount) {
      const dropAmount = XRPL.xrpToDrops(amount);
      encodedTx.Amount = dropAmount;
    }
    return Promise.resolve(encodedTx);
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
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
        return getTxStatus(response.result.meta as XRPL.TransactionMetadata);
      }),
    );
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory } = options;

    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const { decimals, symbol } = await this.engine.getNetwork(this.networkId);
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const client = await this.getClient();
    let txs: IXrpTransaction[] = [];
    try {
      const response = await client.request({
        command: 'account_tx',
        account: dbAccount.address,
        ledger_index_min: -1,
        ledger_index_max: -1,
        binary: false,
        limit: 100,
        forward: false,
      });
      txs = response.result.transactions;
    } catch (e) {
      console.error(e);
    }

    const promises = txs.map((txInfo) => {
      try {
        const { tx, meta } = txInfo;
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx?.hash,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          // No need to update.
          return null;
        }
        if (tx?.TransactionType !== 'Payment') {
          return null;
        }

        let direction = IDecodedTxDirection.OUT;
        if (tx.Destination === dbAccount.address) {
          direction =
            tx.Account === dbAccount.address
              ? IDecodedTxDirection.SELF
              : IDecodedTxDirection.IN;
        }
        const amount = new BigNumber(
          typeof tx.Amount === 'string' ? tx.Amount : tx.Amount.value,
        )
          .shiftedBy(-decimals)
          .toFixed();
        const amountValue =
          typeof tx.Amount === 'string' ? tx.Amount : tx.Amount.value;

        const decodedTx: IDecodedTx = {
          txid: tx.hash ?? '',
          owner: dbAccount.address,
          signer: dbAccount.address,
          nonce: tx.Sequence ?? 0,
          actions: [
            {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                from: tx.Account,
                to: tx.Destination,
                amount,
                amountValue,
                extraInfo: null,
              },
            },
          ],
          status: getDecodedTxStatus(meta as XRPL.TransactionMetadata),
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
          totalFeeInNative: new BigNumber(tx.Fee ?? 0)
            .shiftedBy(-decimals)
            .toFixed(),
        };
        decodedTx.updatedAt =
          typeof tx.date !== 'undefined'
            ? XRPL.rippleTimeToUnixTime(tx.date)
            : Date.now();
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
        } catch (error: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          if (error?.message?.includes?.('Account not found')) {
            return new BigNumber(0);
          }
          console.error(error);
          throw error;
        }
      }),
    );

    return result;
  }

  private getAccountInfo = memoizee(
    async (address: string) => {
      const client = await this.getClient();
      try {
        const response = await client.request({
          'command': 'account_info',
          'account': address,
          'ledger_index': 'validated',
        });

        return response.result;
      } catch (error) {
        debugLogger.common.info('xrp vault getAccountInfo error: ', error);
        throw error;
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: 1000 * 30,
    },
  );

  override async validateSendAmount(
    amount: string,
    tokenBalance: string,
    to: string,
  ): Promise<boolean> {
    const amountBN = new BigNumber(amount);
    const balanceBN = new BigNumber(tokenBalance);
    try {
      await this.getAccountInfo(to);
    } catch (err: any) {
      console.log(err);
      if (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        err?.message?.includes('Account not found')
      ) {
        if (amountBN.lt(10)) {
          throw new InvalidTransferValue('form__amount_recipient_activate', {
            amount: '10',
            unit: 'XRP',
          });
        } else {
          return true;
        }
      }
      throw err;
    }

    if (balanceBN.minus(10).isLessThan(amountBN)) {
      throw new InvalidTransferValue('form__amount_above_required_reserve', {
        amount: '10',
        unit: 'XRP',
      });
    }
    return true;
  }

  override notifyChainChanged(
    currentNetworkId: string,
    previousNetworkId: string,
  ) {
    if (currentNetworkId !== this.networkId) {
      this.disconnect();
    }
  }

  override async getFrozenBalance() {
    return 10;
  }
}
