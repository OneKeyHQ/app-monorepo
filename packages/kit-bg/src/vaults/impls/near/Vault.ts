/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import type { IEncodedTxNear } from '@onekeyhq/core/src/chains/near/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IToken } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import ClientNear from './sdkNear/ClientNear';
import settings from './settings';
import {
  BN,
  FT_MINIMUM_STORAGE_BALANCE_LARGE,
  FT_STORAGE_DEPOSIT_GAS,
  FT_TRANSFER_DEPOSIT,
  FT_TRANSFER_GAS,
  baseDecode,
  baseEncode,
  deserializeTransaction,
  getPublicKey,
  nearApiJs,
  parseJsonFromRawResponse,
  serializeTransaction,
  verifyNearAddress,
} from './utils';

import type { INearAccessKey, INearAccountStorageBalance } from './types';
import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.near.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  async getClient() {
    return this.getClientCache();
  }

  private getClientCache = memoizee(
    async () =>
      new ClientNear({
        backgroundApi: this.backgroundApi,
        networkId: this.networkId,
      }),
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;

    const address = account.address || '';

    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  override buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxNear> {
    const { transfersInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      if (transfersInfo.length === 1) {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
        });
      }
      throw new OneKeyInternalError('Batch transfers not supported');
    }

    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromTransfer(params: { transferInfo: ITransferInfo }) {
    const { transferInfo } = params;
    const { tokenInfo } = transferInfo;

    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const actions = [];

    if (tokenInfo.isNative) {
      actions.push(
        await this._buildNativeTokenTransferAction({
          amount: transferInfo.amount,
        }),
      );
    } else {
      const hasStorageBalance = await this._isStorageBalanceAvailable({
        address: transferInfo.to,
        tokenAddress: tokenInfo.address,
      });
      if (!hasStorageBalance) {
        // action: storage_deposit
        actions.push(
          await this._buildStorageDepositAction({
            amount: new BN(FT_MINIMUM_STORAGE_BALANCE_LARGE ?? '0'),
            address: transferInfo.to,
          }),
        );
      }
      // action: token transfer
      actions.push(
        await this._buildTokenTransferAction({
          transferInfo,
        }),
      );
    }
    const account = await this.getAccount();
    const pubKey = getPublicKey({ accountPub: account.pub, prefix: false });
    const publicKey = nearApiJs.utils.key_pair.PublicKey.from(pubKey);

    // Mock value here, update nonce and blockHash in buildUnsignedTx later
    const nonce = 0;
    const blockHash = '91737S76o1EfWfjxUQ4k3dyD3qmxDQ7hqgKUKxgxsSUW';

    const tx = nearApiJs.transactions.createTransaction(
      // 'c3be856133196da252d0f1083614cdc87a85c8aa8abeaf87daff1520355eec51',
      transferInfo.from,
      publicKey,
      tokenInfo.address || transferInfo.to,
      nonce,
      actions,
      baseDecode(blockHash),
    );
    const txStr = serializeTransaction(tx);
    return Promise.resolve(txStr);
  }

  _isStorageBalanceAvailable = memoizee(
    async ({
      address,
      tokenAddress,
    }: {
      tokenAddress: string;
      address: string;
    }) => {
      const storageBalance = await this._fetchAccountStorageBalance({
        address,
        tokenAddress,
      });
      return storageBalance?.total !== undefined;
    },
    {
      promise: true,
      primitive: true,
      max: 1,
      maxAge: 1000 * 30,
    },
  );

  async _fetchAccountStorageBalance({
    address,
    tokenAddress,
  }: {
    address: string;
    tokenAddress: string;
  }): Promise<INearAccountStorageBalance | null> {
    const cli = await this.getClient();
    const result = (await cli.callContract(tokenAddress, 'storage_balance_of', {
      account_id: address,
    })) as INearAccountStorageBalance;

    return result;
  }

  async _buildNativeTokenTransferAction({ amount }: { amount: string }) {
    const network = await this.getNetwork();
    const amountBN = new BigNumber(amount || 0);
    const amountBNInAction = new BN(
      amountBN.shiftedBy(network.decimals).toFixed(),
    );
    return nearApiJs.transactions.transfer(amountBNInAction);
  }

  async _buildTokenTransferAction({
    transferInfo,
  }: {
    transferInfo: ITransferInfo;
  }) {
    const token = transferInfo.tokenInfo as IToken;
    const amountBN = new BigNumber(transferInfo.amount || 0);
    const amountStr = amountBN.shiftedBy(token.decimals).toFixed();
    return nearApiJs.transactions.functionCall(
      'ft_transfer',
      {
        amount: amountStr,
        receiver_id: transferInfo.to,
      },
      new BN(FT_TRANSFER_GAS),
      new BN(FT_TRANSFER_DEPOSIT),
    );
  }

  async _buildStorageDepositAction({
    amount,
    address,
  }: {
    amount: BN;
    address: string;
  }) {
    return nearApiJs.transactions.functionCall(
      'storage_deposit',
      {
        account_id: address,
        registration_only: true,
      },
      new BN(FT_STORAGE_DEPOSIT_GAS ?? '0'),
      amount,
    );
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxNear;

    const nativeTx = deserializeTransaction(encodedTx);
    const decodedTx: IDecodedTx = {
      txid: '',
      owner: await this.getAccountAddress(),
      signer: nativeTx.signerId,
      nonce: parseFloat(nativeTx.nonce.toString()),
      actions: await this._nativeTxActionToEncodedTxAction(nativeTx),

      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
    };

    return decodedTx;
  }

  async _nativeTxActionToEncodedTxAction(
    nativeTx: nearApiJs.transactions.Transaction,
  ) {
    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
      networkId: this.networkId,
      accountAddress,
    });

    const actions = await Promise.all(
      nativeTx.actions.map(async (nativeAction) => {
        let action: IDecodedTxAction = {
          type: EDecodedTxActionType.UNKNOWN,
        };
        if (nativeAction.enum === 'transfer' && nativeAction.transfer) {
          const amountValue = nativeAction.transfer.deposit.toString();
          const amount = new BigNumber(amountValue)
            .shiftedBy(nativeToken.decimals * -1)
            .toFixed();

          const transfer: IDecodedTxTransferInfo = {
            from: nativeTx.signerId,
            to: nativeTx.receiverId,
            tokenIdOnNetwork: nativeToken.address,
            icon: nativeToken.logoURI ?? '',
            name: nativeToken.name,
            symbol: nativeToken.symbol,
            amount,
            isNFT: false,
            isNative: true,
          };

          action = await this.buildTxTransferAssetAction({
            from: transfer.from,
            to: transfer.to,
            transfers: [transfer],
          });
        }
        if (nativeAction.enum === 'functionCall') {
          if (nativeAction?.functionCall?.methodName === 'ft_transfer') {
            const tokenInfo = await this.backgroundApi.serviceToken.getToken({
              networkId: this.networkId,
              tokenIdOnNetwork: nativeTx.receiverId,
              accountAddress,
            });
            if (tokenInfo) {
              const transferData = parseJsonFromRawResponse(
                nativeAction.functionCall?.args,
              ) as {
                receiver_id: string;
                sender_id: string;
                amount: string;
              };
              const amountValue = transferData.amount;
              const amount = new BigNumber(amountValue)
                .shiftedBy(tokenInfo.decimals * -1)
                .toFixed();

              const transfer: IDecodedTxTransferInfo = {
                from: transferData.sender_id || nativeTx.signerId,
                to: transferData.receiver_id,
                tokenIdOnNetwork: tokenInfo.address,
                icon: tokenInfo.logoURI ?? '',
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                amount,
                isNFT: false,
                isNative: false,
              };

              action = await this.buildTxTransferAssetAction({
                from: nativeTx.signerId,
                to: nativeTx.receiverId,
                transfers: [transfer],
              });
            }
          }
        }
        return action;
      }),
    );
    return actions;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxNear);
    }
    throw new OneKeyInternalError();
  }

  async _buildUnsignedTxFromEncodedTx(encodedTx: IEncodedTxNear) {
    const nativeTx = deserializeTransaction(encodedTx);
    const cli = await this.getClient();

    const accessKey = await this._fetchAccountAccessKey();
    const { blockHash } = await cli.getBestBlock();

    nativeTx.nonce = new BN(accessKey?.nonce ?? 0);
    nativeTx.blockHash = baseDecode(blockHash);

    return Promise.resolve({ encodedTx: serializeTransaction(nativeTx) });
  }

  async _fetchAccountAccessKey(): Promise<INearAccessKey | undefined> {
    const account = await this.getAccount();
    const accountAddress = await this.getAccountAddress();
    const cli = await this.getClient();
    const result = (await cli.getAccessKeys(accountAddress)) || [];
    const publicKey = getPublicKey({ accountPub: account.pub });
    const info = result.find((item) => item.pubkey === publicKey);
    return info;
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, nativeAmountInfo } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxNear;
    let encodedTxNew = encodedTx;
    const nativeTx = deserializeTransaction(encodedTx);

    if (!isNil(nativeAmountInfo?.maxSendAmount)) {
      const action = await this._buildNativeTokenTransferAction({
        amount: nativeAmountInfo.maxSendAmount,
      });
      nativeTx.actions = [action];
      encodedTxNew = serializeTransaction(nativeTx);
    }

    unsignedTx.encodedTx = encodedTxNew;
    return unsignedTx;
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    const result = verifyNearAddress(hexUtils.stripHexPrefix(address));
    return Promise.resolve(result);
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    let privateKey = '';

    const input = decodeSensitiveText({ encodedText: params.input });

    const [prefix, encoded] = input.split(':');
    const decodedPrivateKey = Buffer.from(baseDecode(encoded));
    if (prefix === 'ed25519' && decodedPrivateKey.length === 64) {
      privateKey = decodedPrivateKey.slice(0, 32).toString('hex');
    }
    privateKey = encodeSensitiveText({ text: privateKey });

    return Promise.resolve({
      privateKey,
    });
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    let isValid = false;
    const [prefix, encoded] = privateKey.split(':');
    try {
      isValid =
        prefix === 'ed25519' && Buffer.from(baseDecode(encoded)).length === 64;
    } catch {
      // pass
    }
    return Promise.resolve({
      isValid,
    });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }
}
