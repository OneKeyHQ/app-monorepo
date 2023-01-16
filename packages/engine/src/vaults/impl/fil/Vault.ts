/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import {
  CoinType,
  decode,
  encode,
  validateAddressString,
} from '@glif/filecoin-address';
import { Message } from '@glif/filecoin-message';
import LotusRpcEngine from '@glif/filecoin-rpc-client';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import BigNumber from 'bignumber.js';
import { isNil, isObject } from 'lodash';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { InvalidAddress, OneKeyInternalError } from '../../../errors';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { getDecodedTxStatus, getTxStatus } from './utils';

import type { Account, DBVariantAccount } from '../../../types/account';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { CID, IEncodedTxFil, IOnChainHistoryTx } from './types';
import type { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';

let suggestedGasPremium = '0';

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

  getClientCache = memoizee(
    async (rpcUrl: string, namespace: string) =>
      new LotusRpcEngine({
        apiAddress: rpcUrl,
        namespace,
      }),
    {
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  async getClient(url?: string) {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(url ?? rpcURL, 'Filecoin');
  }

  async getScanClient() {
    const { isTestnet } = await this.engine.getNetwork(this.networkId);
    const rpcURL = isTestnet
      ? 'https://calibration.filscan.io:8700/rpc/v1'
      : 'https://api.filscan.io:8700/rpc/v1';
    return this.getClientCache(rpcURL, 'filscan');
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxFil> {
    const { from, to, amount } = transferInfo;
    const network = await this.getNetwork();

    let amountBN = new BigNumber(amount);
    if (amountBN.isNaN()) {
      amountBN = new BigNumber('0');
    }

    const message = new Message({
      from,
      to,
      nonce: 0,
      value: amountBN.shiftedBy(network.decimals),
      method: 0,
      params: '',
    });
    return message.toLotusType();
  }

  async updateEncodedTx(
    encodedTx: IEncodedTxFil,
    payload: IEncodedTxUpdatePayloadTransfer,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    if (options.type === IEncodedTxUpdateType.transfer) {
      const network = await this.getNetwork();
      encodedTx.Value = new BigNumber(payload.amount)
        .shiftedBy(network.decimals)
        .toFixed();
    }
    return Promise.resolve(encodedTx);
  }

  override async decodeTx(
    encodedTx: IEncodedTxFil,
    payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const address = await this.getAccountAddress();
    const token = await this.engine.getNativeTokenInfo(this.networkId);

    const decodedTx: IDecodedTx = {
      txid:
        (isObject(encodedTx.CID) ? encodedTx.CID['/'] : encodedTx.CID) || '',
      owner: address,
      signer: encodedTx.From || address,
      nonce: encodedTx.Nonce || 0,
      actions: [
        {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          nativeTransfer: {
            tokenInfo: token,
            from: encodedTx.From,
            to: encodedTx.To,
            amount: new BigNumber(encodedTx.Value)
              .shiftedBy(-network.decimals)
              .toFixed(),
            amountValue: encodedTx.Value,
            extraInfo: null,
          },
          direction:
            encodedTx.To === address
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

  async fetchFeeInfo(encodedTx: IEncodedTxFil): Promise<IFeeInfo> {
    const client = await this.getClient();
    const network = await this.engine.getNetwork(this.networkId);

    const encodedTxWithFeeInfo: IEncodedTxFil = await client.request(
      'GasEstimateMessageGas',
      encodedTx,
      {},
      [],
    );

    suggestedGasPremium = encodedTxWithFeeInfo.GasPremium;

    const limit = BigNumber.max(
      encodedTx.GasLimit,
      encodedTxWithFeeInfo.GasLimit,
    );

    return {
      customDisabled: true,
      limit: new BigNumber(limit).toFixed(),
      prices: [
        new BigNumber(encodedTxWithFeeInfo.GasFeeCap)
          .shiftedBy(-network.feeDecimals)
          .toFixed(),
      ],
      defaultPresetIndex: '0',
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
    };
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxFil;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxFil> {
    const network = await this.getNetwork();
    const { encodedTx, feeInfoValue } = params;
    const { limit, price } = feeInfoValue;

    const encodedTxWithFeeInfo: IEncodedTxFil = {
      ...encodedTx,
    };

    if (!isNil(limit)) {
      encodedTxWithFeeInfo.GasLimit = new BigNumber(limit).toNumber();
    }

    if (!isNil(price)) {
      encodedTxWithFeeInfo.GasFeeCap = new BigNumber(
        (price as string) || '0.000000001',
      )
        .shiftedBy(network.feeDecimals)
        .toFixed();
    }

    if (!isNil(suggestedGasPremium)) {
      encodedTxWithFeeInfo.GasPremium = suggestedGasPremium;
    }

    return Promise.resolve(encodedTxWithFeeInfo);
  }

  async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxFil,
  ): Promise<IUnsignedTxPro> {
    const client = await this.getClient();
    const nonce = await client.request('MpoolGetNonce', encodedTx.From);

    encodedTx.Nonce = Number(nonce);

    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      const privateKey = decrypt(password, encryptedPrivateKey).toString(
        'base64',
      );
      // export lotus type private key by default
      return Buffer.from(
        JSON.stringify({
          'Type': 'secp256k1',
          'PrivateKey': privateKey,
        }),
      ).toString('hex');
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async getTransactionFeeInNative(txid: string) {
    try {
      const scanClient = await this.getScanClient();
      const token = await this.engine.getNativeTokenInfo(this.networkId);
      const tx = await scanClient.request<IOnChainHistoryTx>(
        'MessageDetails',
        txid,
      );
      return new BigNumber(tx.all_gas_fee ?? 0)
        .shiftedBy(-token.decimals)
        .toFixed();
    } catch {
      return '';
    }
  }

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    return Promise.all(
      txids.map(async (txid) => {
        const scanClient = await this.getScanClient();
        const response = await scanClient.request<IOnChainHistoryTx>(
          'MessageDetails',
          txid,
        );
        return getTxStatus(response.exit_code, response.signed_cid);
      }),
    );
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const scanClient = await this.getScanClient();
    const { localHistory } = options;

    const address = await this.getAccountAddress();
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let txs: IOnChainHistoryTx[] = [];
    try {
      const list = await scanClient.request<{ data: IOnChainHistoryTx[] }>(
        'MessageByAddress',
        {
          address,
          offset_range: { start: 0, count: 50 },
        },
      );

      txs = list.data;
    } catch (e) {
      console.error(e);
    }

    const promises = txs.map(async (tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.signed_cid,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          return null;
        }
        if (tx.method_name !== 'transfer') {
          return null;
        }

        let direction = IDecodedTxDirection.OUT;
        if (tx.to === address) {
          direction =
            tx.from === address
              ? IDecodedTxDirection.SELF
              : IDecodedTxDirection.IN;
        }
        const amountBN = new BigNumber(tx.value);

        const decodedTx: IDecodedTx = {
          txid: tx.signed_cid ?? '',
          owner: tx.from,
          signer: tx.from,
          nonce: tx.nonce ?? 0,
          actions: [
            {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                from: tx.from,
                to: tx.to,
                amount: amountBN.shiftedBy(-token.decimals).toFixed(),
                amountValue: amountBN.toFixed(),
                extraInfo: null,
              },
            },
          ],
          status: getDecodedTxStatus(tx.exit_code, tx.signed_cid),
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
        };
        decodedTx.updatedAt = new Date(tx.last_modified).getTime();
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

  override validateImportedCredential(input: string): Promise<boolean> {
    let ret = false;
    if (this.settings.importedAccountEnabled) {
      ret = /^(0x)?[0-9a-zA-Z]{64}|[0-9a-zA-Z]{160}$/.test(input);
    }
    return Promise.resolve(ret);
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = (await this.getDbAccount({
      noCache: true,
    })) as DBVariantAccount;
    const ret = {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.addresses?.[this.networkId] || '',
    };
    if (ret.address.length === 0) {
      try {
        const network = await this.getNetwork();
        const addressObj = decode(dbAccount.address);
        const address = encode(
          network.isTestnet ? CoinType.TEST : CoinType.MAIN,
          addressObj,
        );

        await this.engine.dbApi.addAccountAddress(
          dbAccount.id,
          this.networkId,
          address,
        );
        ret.address = address;
      } catch {
        // pass
      }
    }
    return ret;
  }

  override async getAccountAddress() {
    const { address } = await this.getOutputAccount();
    return address;
  }

  override async getAccountBalance(tokenIds: Array<string>, withMain = true) {
    const address = await this.getAccountAddress();
    return this.getBalances(
      (withMain ? [{ address }] : []).concat(
        tokenIds.map((tokenAddress) => ({ address, tokenAddress })),
      ),
    );
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        try {
          const balance = await client.request('WalletBalance', address);

          return new BigNumber(balance);
        } catch (error: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          if (error?.message?.includes?.('Account not found')) {
            return new BigNumber(0);
          }
          throw error;
        }
      }),
    );

    return result;
  }

  override async validateWatchingCredential(address: string): Promise<boolean> {
    const isValid = validateAddressString(address);
    const normalizedAddress = isValid ? address.toLowerCase() : undefined;

    if (!isValid || typeof normalizedAddress === 'undefined') {
      return false;
    }
    return true;
  }

  override async validateAddress(address: string): Promise<string> {
    const isValid = validateAddressString(address);
    const normalizedAddress = isValid ? address.toLowerCase() : undefined;

    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const client = await this.getClient();
    let result: CID;
    try {
      result = await client.request('MpoolPush', JSON.parse(signedTx.rawTx));
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
      txid: isObject(result) ? result['/'] : result,
      encodedTx: signedTx.encodedTx,
    };
  }

  override getPrivateKeyByCredential(credential: string) {
    let privateKey;
    if (credential.length === 160) {
      // Lotus type private key:
      try {
        const result = JSON.parse(
          Buffer.from(credential, 'hex').toString(),
        ) as { Type: string; PrivateKey: string };
        if (result.PrivateKey) {
          privateKey = Buffer.from(result.PrivateKey, 'base64');
        }
      } catch {
        // pass
      }
    } else if (credential.length === 64) {
      privateKey = Buffer.from(credential, 'hex');
    }
    return privateKey;
  }

  override async addressFromBase(baseAddress: string) {
    const { isTestnet } = await this.getNetwork();
    return encode(
      isTestnet ? CoinType.TEST : CoinType.MAIN,
      decode(baseAddress),
    );
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getClient(url);
    const start = performance.now();
    const { Height } = await client.request<{ Height: number }>('ChainHead');
    return {
      responseTime: Math.floor(performance.now() - start),
      latestBlock: Height,
    };
  }
}
