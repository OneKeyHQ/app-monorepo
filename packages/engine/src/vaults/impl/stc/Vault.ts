/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint-disable @typescript-eslint/require-await */

import { StcClient } from '@onekeyfe/blockchain-libs/dist/provider/chains/stc/starcoin';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { PartialTokenInfo } from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { extractResponseError } from '../../../proxy';
import { DBSimpleAccount } from '../../../types/account';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionNativeTransfer,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxLegacy,
  IDecodedTxStatus,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IEncodedTxUpdateType,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import {
  convertFeeGweiToValue,
  convertFeeValueToGwei,
} from '../../utils/feeInfoUtils';
import { VaultBase } from '../../VaultBase';
import { EVMDecodedTxType } from '../evm/decoder/types';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import {
  decodeTokenData,
  extractTransactionInfo,
  getAddressHistoryFromExplorer,
} from './utils';

import type { IEncodedTxSTC } from './types';

export default class Vault extends VaultBase {
  settings = settings;

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
  };

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    let result: IDecodedTxLegacy;
    const { type, nativeTransfer } = decodedTx.actions[0];

    if (type === IDecodedTxActionType.NATIVE_TRANSFER) {
      result = {
        txType: EVMDecodedTxType.NATIVE_TRANSFER,
        symbol: 'UNKNOWN',
        amount: nativeTransfer?.amount,
        value: nativeTransfer?.amountValue,
        fromAddress: nativeTransfer?.from,
        toAddress: nativeTransfer?.to,
        data: '',
        total: '0', // not available
      } as IDecodedTxLegacy;
    } else if (type === IDecodedTxActionType.TRANSACTION) {
      result = {
        txType: EVMDecodedTxType.NATIVE_TRANSFER,
        symbol: 'UNKNOWN',
        fromAddress: decodedTx.owner,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        data: decodedTx.payload?.data,
        total: '0', // not available
      } as IDecodedTxLegacy;
    } else {
      // shouldn't happen.
      throw new OneKeyInternalError('Incorrect decodedTx.');
    }

    return Promise.resolve(result);
  }

  override async decodeTx(
    encodedTx: IEncodedTxSTC,
    _payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const { data, to } = encodedTx;
    let action: IDecodedTxAction | null = null;
    if (to) {
      const nativeTransfer: IDecodedTxActionNativeTransfer = {
        tokenInfo: token,
        from: encodedTx.from,
        to: encodedTx.to,
        amount: new BigNumber(encodedTx.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        amountValue: encodedTx.value,
        extraInfo: null,
      };
      action = {
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        nativeTransfer,
      };
    } else if (data) {
      // TODO:  display dataName and dataParamsStr on UI's confirmTransactionPage
      const { name: dataName, params: dataParams } = decodeTokenData(data);
      // eslint-disable-next-line no-unused-vars
      const dataParamsStr = JSON.stringify(dataParams);

      action = {
        type: IDecodedTxActionType.TRANSACTION,
        direction: IDecodedTxDirection.SELF,
        unknownAction: {
          extraInfo: {},
        },
      };
    } else {
      // TODO: support other types
      action = {
        type: IDecodedTxActionType.TRANSACTION,
        direction: IDecodedTxDirection.OTHER,
        unknownAction: {
          extraInfo: {},
        },
      };
    }

    const result: IDecodedTx = {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions: [action],
      status: IDecodedTxStatus.Pending, // TODO
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        price: convertFeeValueToGwei({
          value: encodedTx.gasPrice ?? '1',
          network,
        }),
        limit: encodedTx.gasLimit,
      },
      extraInfo: null,
      encodedTx,
      payload: {
        data: encodedTx.data,
      },
    };

    return Promise.resolve(result);
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxSTC> {
    const { from, to, amount, token } = transferInfo;
    if (typeof token !== 'undefined' && token.length > 0) {
      // TODO: token not supported yet.
      throw new NotImplemented();
    }

    const network = await this.getNetwork();
    return Promise.resolve({
      from,
      to,
      value: new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
    });
  }

  async buildEncodedTxFromApprove(
    _approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  private async getJsonRPCClient(): Promise<StcClient> {
    return (await this.engine.providerManager.getClient(
      this.networkId,
    )) as StcClient;
  }

  updateEncodedTxTokenApprove(
    _encodedTx: IEncodedTxSTC,
    _amount: string,
  ): Promise<IEncodedTxSTC> {
    throw new NotImplemented();
  }

  async updateEncodedTx(
    encodedTx: IEncodedTxSTC,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxSTC> {
    if (options.type === IEncodedTxUpdateType.transfer) {
      const network = await this.getNetwork();
      encodedTx.value = new BigNumber(
        (payload as IEncodedTxUpdatePayloadTransfer).amount,
      )
        .shiftedBy(network.decimals)
        .toFixed();
    }
    return Promise.resolve(encodedTx);
  }

  async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxSTC,
  ): Promise<IUnsignedTxPro> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const network = await this.getNetwork();
    const value = new BigNumber(encodedTx.value);

    const { nonce } = encodedTx;
    const nonceBN = new BigNumber(nonce ?? 'NaN');
    const nextNonce: number = !nonceBN.isNaN()
      ? nonceBN.toNumber()
      : await this.getNextNonce(network.id, dbAccount);
    const unsignedTx = await this.engine.providerManager.buildUnsignedTx(
      this.networkId,
      {
        inputs: [
          { address: dbAccount.address, value, publicKey: dbAccount.pub },
        ],
        outputs: encodedTx.to ? [{ address: encodedTx.to, value }] : [],
        nonce: nextNonce,
        feePricePerUnit: new BigNumber(encodedTx.gasPrice || '1'),

        payload: {
          ...(encodedTx.data
            ? {
                data: encodedTx.data,
              }
            : {}),
        },
        ...(typeof encodedTx.gasLimit !== 'undefined'
          ? {
              feeLimit: new BigNumber(encodedTx.gasLimit),
            }
          : {}),
      },
    );

    debugLogger.sendTx.info(
      'buildUnsignedTxFromEncodedTx >>>> buildUnsignedTx',
      unsignedTx,
    );

    return { ...unsignedTx, encodedTx };
  }

  async fetchFeeInfo(encodedTx: IEncodedTxSTC): Promise<IFeeInfo> {
    // NOTE: for fetching gas limit, we don't want blockchain-libs to fetch
    // other info such as gas price and nonce. Therefore the hack here to
    // avoid redundant network requests.
    const { gasLimit, ...encodedTxWithFakePriceAndNonce } = {
      ...encodedTx,
      gasPrice: '1',
    };

    const [network, prices, unsignedTx] = await Promise.all([
      this.getNetwork(),
      this.engine.getGasPrice(this.networkId),
      this.buildUnsignedTxFromEncodedTx(encodedTxWithFakePriceAndNonce),
    ]);

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit: BigNumber.max(
        unsignedTx.feeLimit ?? '0',
        gasLimit ?? '0',
      ).toFixed(),
      prices,
      defaultPresetIndex: '0',
      extraInfo: {
        ...(Object.keys(unsignedTx.tokensChangedTo || {}).length
          ? {
              tokensChangedTo: unsignedTx.tokensChangedTo,
            }
          : {}),
      },
    };
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxSTC;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxSTC> {
    const { price, limit } = params.feeInfoValue;
    if (typeof price !== 'undefined' && typeof price !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof limit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }
    const network = await this.getNetwork();

    const encodedTxWithFee = {
      ...params.encodedTx,
      gasPrice: convertFeeGweiToValue({
        value: price || '0.000000001',
        network,
      }),
      gasLimit: limit,
    };
    return Promise.resolve(encodedTxWithFee);
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return `0x${decrypt(password, encryptedPrivateKey).toString('hex')}`;
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [], tokenIdOnNetwork } = options;
    if (tokenIdOnNetwork) {
      // No token support now.
      return Promise.resolve([]);
    }

    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const { decimals } = await this.engine.getNetwork(this.networkId);
    const token = await this.engine.getNativeTokenInfo(this.networkId);

    const explorerTxs = await getAddressHistoryFromExplorer(
      this.networkId,
      dbAccount.address,
    );
    const promises = explorerTxs.map((tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.transaction_hash,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const transactionInfo = extractTransactionInfo(tx);
        if (transactionInfo) {
          const { from, to, mainTokenAmountValue, feeValue } = transactionInfo;
          const encodedTx = {
            from,
            to: '',
            value: '',
            data: tx.user_transaction.raw_txn.payload,
          };

          let action: IDecodedTxAction = {
            type: IDecodedTxActionType.TRANSACTION,
          };
          if (mainTokenAmountValue) {
            let direction = IDecodedTxDirection.IN;
            if (from === dbAccount.address) {
              direction =
                to === dbAccount.address
                  ? IDecodedTxDirection.SELF
                  : IDecodedTxDirection.OUT;
            }
            encodedTx.to = to;
            encodedTx.value = mainTokenAmountValue;
            action = {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                from,
                to,
                amount: new BigNumber(mainTokenAmountValue)
                  .shiftedBy(-decimals)
                  .toFixed(),
                amountValue: mainTokenAmountValue,
                extraInfo: null,
              },
            };
          }
          const decodedTx: IDecodedTx = {
            txid: tx.transaction_hash,
            owner: dbAccount.address,
            signer: from,
            nonce: 0,
            actions: [action],
            status:
              tx.status === 'Executed'
                ? IDecodedTxStatus.Confirmed
                : IDecodedTxStatus.Pending,
            networkId: this.networkId,
            accountId: this.accountId,
            encodedTx,
            extraInfo: null,
            totalFeeInNative: new BigNumber(feeValue)
              .shiftedBy(-decimals)
              .toFixed(),
          };
          decodedTx.updatedAt = tx.timestamp;
          decodedTx.createdAt =
            historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
          decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
          return this.buildHistoryTx({
            decodedTx,
            historyTxToMerge,
          });
        }
      } catch (e) {
        debugLogger.common.error(e);
      }

      return Promise.resolve(null);
    });

    return (await Promise.all(promises)).filter(Boolean);
  }

  // Chain only functionalities below.

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const client = await this.getJsonRPCClient();
    try {
      return await client.rpc.call(
        request.method,
        request.params as Record<string, any> | Array<any>,
      );
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  createClientFromURL(url: string): StcClient {
    return new StcClient(url);
  }

  fetchTokenInfos(
    _tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }
}
