/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint-disable @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import Decimal from 'decimal.js';
import { isNil } from 'lodash';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type {
  FeePricePerUnit,
  PartialTokenInfo,
  TransactionStatus,
} from '@onekeyhq/engine/src/types/provider';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import simpleDb from '../../../dbs/simple/simpleDb';
import {
  InvalidAddress,
  InvalidTokenAddress,
  NotImplemented,
  OneKeyInternalError,
  PendingQueueTooLong,
} from '../../../errors';
import { Verifier, extractResponseError } from '../../../proxy';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import {
  convertFeeGweiToValue,
  convertFeeValueToGwei,
} from '../../utils/feeInfoUtils';
import { VaultBase } from '../../VaultBase';
import { EVMDecodedTxType } from '../evm/decoder/types';

import {
  KeyringHardware,
  KeyringHd,
  KeyringImported,
  KeyringWatching,
} from './keyring';
import { ClientStc, StarcoinTypes, encoding, utils } from './sdk';
import settings from './settings';
import {
  buildUnsignedTx,
  decodeTransactionPayload,
  encodeTokenTransferData,
  extractTransactionInfo,
  getAddressHistoryFromExplorer,
  verifyAddress,
} from './utils';

import type { DBAccount, DBSimpleAccount } from '../../../types/account';
import type { Token } from '../../../types/token';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionNativeTransfer,
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
import type { IEncodedTxSTC } from './types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const MAIN_TOKEN_ADDRESS = '0x00000000000000000000000000000001::STC::STC';
const DEFAULT_GAS_LIMIT_NATIVE_TRANSFER = '105547';

export default class Vault extends VaultBase {
  settings = settings;

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    let result: IDecodedTxLegacy;
    const { type, nativeTransfer, tokenTransfer } = decodedTx.actions[0];

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
    } else if (type === IDecodedTxActionType.UNKNOWN) {
      result = {
        txType: EVMDecodedTxType.NATIVE_TRANSFER,
        symbol: 'UNKNOWN',
        fromAddress: decodedTx.owner,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        data: decodedTx.payload?.data,
        total: '0', // not available
      } as IDecodedTxLegacy;
    } else if (type === IDecodedTxActionType.TOKEN_TRANSFER) {
      result = {
        txType: EVMDecodedTxType.TOKEN_TRANSFER,
        symbol: tokenTransfer?.tokenInfo.symbol,
        amount: tokenTransfer?.amount,
        value: tokenTransfer?.amountValue,
        fromAddress: tokenTransfer?.from,
        toAddress: tokenTransfer?.to,
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
    let token: Token | undefined = await this.engine.getNativeTokenInfo(
      this.networkId,
    );
    const { data, to } = encodedTx;
    let action: IDecodedTxAction | null = null;
    if (to) {
      const nativeTransfer: IDecodedTxActionNativeTransfer = {
        tokenInfo: token,
        from: encodedTx.from,
        to: encodedTx.to,
        amount: new BigNumber(encodedTx.value)
          .shiftedBy(-token.decimals)
          .toFixed(),
        amountValue: encodedTx.value,
        extraInfo: null,
      };
      action = {
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        nativeTransfer,
      };
    } else if (data) {
      const decodedPayload = decodeTransactionPayload(data);
      if (decodedPayload.type === 'tokenTransfer') {
        const {
          tokenAddress,
          to: transferTo,
          amountValue,
        } = decodedPayload.payload;
        let actionKey = 'nativeTransfer';
        let actionType = IDecodedTxActionType.NATIVE_TRANSFER;
        if (tokenAddress !== MAIN_TOKEN_ADDRESS) {
          token = await this.engine.ensureTokenInDB(
            this.networkId,
            tokenAddress,
          );
          if (typeof token === 'undefined') {
            throw new OneKeyInternalError('Failed to get token info.');
          }
          actionKey = 'tokenTransfer';
          actionType = IDecodedTxActionType.TOKEN_TRANSFER;
        }
        const amount = new BigNumber(amountValue)
          .shiftedBy(-token.decimals)
          .toFixed();

        action = {
          type: actionType,
          [actionKey]: {
            tokenInfo: token,
            from: encodedTx.from,
            to: transferTo,
            amount,
            amountValue,
            extraInfo: null,
          },
        };
      } else {
        /* TODO:  display dataName and dataParamsStr on UI's confirmTransactionPage
        const { name: dataName, params: dataParams } =
          decodeTransactionPayload(data);
        const dataParamsStr = JSON.stringify(dataParams);
        */
        action = {
          type: IDecodedTxActionType.UNKNOWN,
          direction: IDecodedTxDirection.SELF,
          unknownAction: {
            extraInfo: {},
          },
        };
      }
    } else {
      // TODO: support other types
      action = {
        type: IDecodedTxActionType.UNKNOWN,
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
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { from, to, amount, token: tokenAddress } = transferInfo;
    if (typeof tokenAddress !== 'undefined' && tokenAddress.length > 0) {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tokenAddress,
      );
      if (typeof token === 'undefined') {
        throw new OneKeyInternalError('Failed to get token info.');
      }
      return Promise.resolve({
        from,
        to: '',
        value: '',
        data: encodeTokenTransferData(to, token, amount),
      });
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

  private async getJsonRPCClient(): Promise<ClientStc> {
    const rpcURL = await this.getRpcUrl();
    return this.createClientFromURL(rpcURL);
  }

  override createClientFromURL = memoizee(
    (rpcURL: string) => new ClientStc(rpcURL),
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    const client = await this.getJsonRPCClient();
    return client.getTransactionStatuses(txids);
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<(BigNumber | undefined)[]> {
    const requestsNew = requests.map(({ address, tokenAddress }) => ({
      address,
      coin: { ...(typeof tokenAddress === 'string' ? { tokenAddress } : {}) },
    }));
    const client = await this.getJsonRPCClient();
    return client.getBalances(requestsNew);
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

  override async getNextNonce(
    networkId: string,
    dbAccount: DBAccount,
  ): Promise<number> {
    const client = await this.getJsonRPCClient();
    const [addressInfo] = await client.getAddresses([dbAccount.address]);
    const onChainNonce = addressInfo?.nonce ?? 0;
    const maxPendingNonce = await simpleDb.history.getMaxPendingNonce({
      accountId: this.accountId,
      networkId,
    });
    const pendingNonceList = await simpleDb.history.getPendingNonceList({
      accountId: this.accountId,
      networkId,
    });
    let nextNonce = Math.max(
      isNil(maxPendingNonce) ? 0 : maxPendingNonce + 1,
      onChainNonce,
    );
    if (Number.isNaN(nextNonce)) {
      nextNonce = onChainNonce;
    }
    if (nextNonce > onChainNonce) {
      for (let i = onChainNonce; i < nextNonce; i += 1) {
        if (!pendingNonceList.includes(i)) {
          nextNonce = i;
          break;
        }
      }
    }

    if (nextNonce < onChainNonce) {
      nextNonce = onChainNonce;
    }

    if (nextNonce - onChainNonce >= HISTORY_CONSTS.PENDING_QUEUE_MAX_LENGTH) {
      throw new PendingQueueTooLong(HISTORY_CONSTS.PENDING_QUEUE_MAX_LENGTH);
    }

    return nextNonce;
  }

  override async addressFromBase(account: DBAccount) {
    return this.validateAddress(account.address);
  }

  async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxSTC,
  ): Promise<IUnsignedTxPro> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const network = await this.getNetwork();
    const chainId = await this.getNetworkChainId();
    const value = new BigNumber(encodedTx.value);
    const client = await this.getJsonRPCClient();
    const { nonce } = encodedTx;
    const nonceBN = new BigNumber(nonce ?? 'NaN');
    const nextNonce: number = !nonceBN.isNaN()
      ? nonceBN.toNumber()
      : await this.getNextNonce(network.id, dbAccount);
    const unsignedTx = await buildUnsignedTx(
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
      client,
      chainId,
    );

    debugLogger.sendTx.info(
      'buildUnsignedTxFromEncodedTx >>>> buildUnsignedTx',
      unsignedTx,
    );

    return { ...unsignedTx, encodedTx };
  }

  override async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const client = await this.getJsonRPCClient();
    return client.getFeePricePerUnit();
  }

  async fetchFeeInfo(encodedTx: IEncodedTxSTC): Promise<IFeeInfo> {
    // NOTE: for fetching gas limit, we don't want blockchain-libs to fetch
    // other info such as gas price and nonce. Therefore the hack here to
    // avoid redundant network requests.
    const { gasLimit, ...encodedTxWithFakePriceAndNonce } = {
      ...encodedTx,
      gasPrice: '1',
    };

    const [network, { prices }, unsignedTx] = await Promise.all([
      this.getNetwork(),
      this.engine.getGasInfo(this.networkId),
      this.buildUnsignedTxFromEncodedTx(encodedTxWithFakePriceAndNonce),
    ]);

    let limit = BigNumber.max(
      unsignedTx.feeLimit ?? '0',
      gasLimit ?? '0',
    ).toFixed();
    if (limit === '0') {
      // Dry run failed.
      if (!encodedTx.data) {
        // Native STC transfer, give a default limit.
        limit = DEFAULT_GAS_LIMIT_NATIVE_TRANSFER;
      } else {
        throw new OneKeyInternalError('', 'msg__broadcast_tx_Insufficient_fee');
      }
    }

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit,
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

    const explorerTxs = await getAddressHistoryFromExplorer(
      this.networkId,
      dbAccount.address,
    );
    const promises = explorerTxs.map(async (tx) => {
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
          const { from, to, tokenAddress, amountValue, feeValue } =
            transactionInfo;
          const encodedTx = {
            from,
            to: '',
            value: '',
            data: tx.user_transaction.raw_txn.payload,
          };

          let action: IDecodedTxAction = {
            type: IDecodedTxActionType.UNKNOWN,
          };
          if (amountValue && tokenAddress) {
            let direction = IDecodedTxDirection.IN;
            if (from === dbAccount.address) {
              direction =
                to === dbAccount.address
                  ? IDecodedTxDirection.SELF
                  : IDecodedTxDirection.OUT;
            }
            let actionType = IDecodedTxActionType.NATIVE_TRANSFER;
            let token: Token | undefined = await this.engine.getNativeTokenInfo(
              this.networkId,
            );
            let actionKey = 'nativeTransfer';
            if (tokenAddress === MAIN_TOKEN_ADDRESS) {
              encodedTx.to = to;
              encodedTx.value = amountValue;
            } else {
              actionType = IDecodedTxActionType.TOKEN_TRANSFER;
              actionKey = 'tokenTransfer';
              token = await this.engine.ensureTokenInDB(
                this.networkId,
                tokenAddress,
              );
              if (typeof token === 'undefined') {
                throw new OneKeyInternalError('Failed to get token info.');
              }
            }

            action = {
              type: actionType,
              direction,
              [actionKey]: {
                tokenInfo: token,
                from,
                to,
                amount: new BigNumber(amountValue)
                  .shiftedBy(-token.decimals)
                  .toFixed(),
                amountValue,
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
          return await this.buildHistoryTx({
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

  async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    const client = await this.getJsonRPCClient();
    try {
      // eslint-disable-next-line camelcase
      const resp: Array<{ json: { scaling_factor: number } }> =
        await client.rpc.batchCall(
          tokenAddresses.map((tokenAddress) => {
            const [address] = tokenAddress.split('::');
            return [
              'state.get_resource',
              [
                address,
                `0x1::Token::TokenInfo<${tokenAddress}>`,
                { decode: true },
              ],
            ];
          }),
        );
      // eslint-disable-next-line camelcase
      return resp.map(({ json: { scaling_factor } }, index) => {
        try {
          const [, , name] = tokenAddresses[index].split('::');
          return {
            name,
            symbol: name,
            decimals: Decimal.log10(scaling_factor).toDP(0).toNumber(),
          };
        } catch (e) {
          debugLogger.common.error(e);
          return undefined;
        }
      });
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  override async validateTokenAddress(tokenAddress: string): Promise<string> {
    const [address, module, name] = tokenAddress.split('::');
    if (module && name) {
      try {
        return `${await this.validateAddress(address)}::${module}::${name}`;
      } catch {
        // pass
      }
    }
    throw new InvalidTokenAddress();
  }

  override async validateAddress(address: string): Promise<string> {
    const { normalizedAddress, isValid } = verifyAddress(address);
    if (!isValid || !normalizedAddress) {
      throw new InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  override async validateWatchingCredential(input: string): Promise<boolean> {
    // Generic address test, override if needed.
    return Promise.resolve(
      this.settings.watchingAccountEnabled && verifyAddress(input).isValid,
    );
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
    options?: any,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const client = await this.getJsonRPCClient();
    const txid = await client.broadcastTransaction(signedTx.rawTx);
    debugLogger.engine.info('broadcastTransaction END:', {
      txid,
      rawTx: signedTx.rawTx,
    });
    return {
      ...signedTx,
      txid,
      encodedTx: signedTx.encodedTx,
    };
  }
}
