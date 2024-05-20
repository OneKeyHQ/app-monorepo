/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isArray, isEmpty, isNil, trim } from 'lodash';

import type {
  IEncodedTxAlgo,
  IEncodedTxGroupAlgo,
} from '@onekeyhq/core/src/chains/algo/types';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
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
import sdkAlgo from './sdkAlgo';
import ClientAlgo from './sdkAlgo/ClientAlog';
import { encodeTransaction } from './utils';

import type { ISdkAlgoEncodedTransaction } from './sdkAlgo';
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
  INativeAmountInfo,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  _getSuggestedParams = memoizee(
    async () => {
      const client = await this.getClient();
      return client.getSuggestedParams();
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  _getClientCache = memoizee(
    async () =>
      new ClientAlgo({
        networkId: this.networkId,
        backgroundApi: this.backgroundApi,
      }),
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  async getClient() {
    return this._getClientCache();
  }

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
  ): Promise<IEncodedTxAlgo | IEncodedTxGroupAlgo> {
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
    const tx = await this._buildAlgoTxFromTransferInfo(transferInfo);
    return encodeTransaction(tx);
  }

  async _buildAlgoTxFromTransferInfo(transferInfo: ITransferInfo) {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { from, to, amount, tokenInfo } = transferInfo;

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const suggestedParams = await this._getSuggestedParams();
    if (tokenInfo.isNative) {
      return sdkAlgo.makePaymentTxnWithSuggestedParamsFromObject({
        amount: BigInt(
          new BigNumber(amount).shiftedBy(tokenInfo.decimals).toFixed(),
        ),
        from,
        to,
        suggestedParams,
      });
    }

    return sdkAlgo.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(
        new BigNumber(amount).shiftedBy(tokenInfo.decimals).toFixed(),
      ),
      assetIndex: parseInt(tokenInfo.address),
      from,
      to,
      suggestedParams,
    });
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as
      | IEncodedTxAlgo
      | IEncodedTxGroupAlgo;
    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
      networkId: this.networkId,
      accountAddress,
    });
    const actions: IDecodedTxAction[] = [];
    const notes: string[] = [];
    let sender = '';
    let groupId = '';

    const txGroup = isArray(encodedTx) ? encodedTx : [encodedTx];
    let txFee = new BigNumber(0);

    for (let i = 0, len = txGroup.length; i < len; i += 1) {
      const { action, nativeTx } = await this._decodeAlgoTx(txGroup[i]);
      actions.push(action);
      txFee = txFee.plus(nativeTx.fee ?? 0);
      sender = nativeTx.snd ? sdkAlgo.encodeAddress(nativeTx.snd) : '';
      if (nativeTx.grp) {
        groupId = Buffer.from(nativeTx.grp).toString('base64');
      }
      if (nativeTx.note) {
        let noteString = nativeTx.note.toString();
        if (noteString.length === 1) {
          try {
            noteString = `0x${Buffer.from(noteString).toString('hex')}`;
          } catch {
            // pass
          }
        }
        notes.push(noteString);
      }
    }

    const tx = {
      txid: '',
      owner: accountAddress,
      signer: sender,
      nonce: 0,
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      totalFeeInNative: txFee.shiftedBy(-nativeToken.decimals).toFixed(),
      extraInfo: {
        note: trim(notes.join(' ')),
        groupId,
      },
      encodedTx,
    };

    return tx;
  }

  async _decodeAlgoTx(encodedTx: IEncodedTxAlgo) {
    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
      networkId: this.networkId,
      accountAddress,
    });
    let action: IDecodedTxAction = { type: EDecodedTxActionType.UNKNOWN };
    const nativeTx = sdkAlgo.decodeObj(
      Buffer.from(encodedTx, 'base64'),
    ) as ISdkAlgoEncodedTransaction;
    const sender = sdkAlgo.encodeAddress(nativeTx.snd);

    if (nativeTx.type === sdkAlgo.TransactionType.pay) {
      const amount = nativeTx.amt?.toString() || '0';
      const to = sdkAlgo.encodeAddress(nativeTx.rcv!);
      const transfer: IDecodedTxTransferInfo = {
        from: sender,
        to,
        tokenIdOnNetwork: nativeToken.address,
        icon: nativeToken.logoURI ?? '',
        name: nativeToken.name,
        symbol: nativeToken.symbol,
        amount: new BigNumber(amount)
          .shiftedBy(-nativeToken.decimals)
          .toFixed(),
        isNFT: false,
        isNative: true,
      };
      action = await this.buildTxTransferAssetAction({
        from: sender,
        to,
        transfers: [transfer],
      });
    }

    if (nativeTx.type === sdkAlgo.TransactionType.axfer) {
      const to = sdkAlgo.encodeAddress(nativeTx.arcv!);
      const token = await this.backgroundApi.serviceToken.getToken({
        networkId: this.networkId,
        tokenIdOnNetwork: nativeTx.xaid!.toString(),
        accountAddress,
      });
      let amount = new BigNumber(nativeTx.aamt?.toString() ?? 0).toFixed();
      if (token) {
        // opt-in to an asset
        if (sender === to && amount === '0') {
          action = {
            type: EDecodedTxActionType.TOKEN_ACTIVATE,
            tokenActivate: {
              tokenIdOnNetwork: token.address,
              icon: token.logoURI ?? '',
              decimals: token.decimals,
              name: token.name,
              symbol: token.symbol,
              from: '',
              to: '',
            },
          };
        } else {
          const assetSender =
            nativeTx.asnd && sdkAlgo.encodeAddress(nativeTx.asnd);
          // opt-out of an asset
          if (nativeTx.aclose) {
            const tokenDetails = (
              await this.backgroundApi.serviceToken.fetchTokensDetails({
                networkId: this.networkId,
                accountAddress,
                contractList: [token.address],
              })
            )[0];

            amount = new BigNumber(tokenDetails.balance ?? 0).toFixed();
          }
          const transfer: IDecodedTxTransferInfo = {
            from: assetSender ?? sender,
            to,
            tokenIdOnNetwork: nativeToken.address,
            icon: nativeToken.logoURI ?? '',
            name: nativeToken.name,
            symbol: nativeToken.symbol,
            amount: new BigNumber(amount).shiftedBy(-token.decimals).toFixed(),
            isNFT: false,
            isNative: true,
          };
          action = await this.buildTxTransferAssetAction({
            from: sender,
            to,
            transfers: [transfer],
          });
        }
      }
    }

    return {
      action,
      nativeTx,
    };
  }

  async _buildUnsignedTxFromEncodedTx(encodedTx: IEncodedTxAlgo) {
    return {
      encodedTx,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxAlgo);
    }
    throw new OneKeyInternalError();
  }

  async _updateNativeTokenAmount(params: {
    encodedTx: IEncodedTxAlgo;
    nativeAmountInfo: INativeAmountInfo;
  }) {
    const { encodedTx, nativeAmountInfo } = params;

    const network = await this.getNetwork();

    const nativeTx = sdkAlgo.decodeObj(
      Buffer.from(encodedTx, 'base64'),
    ) as ISdkAlgoEncodedTransaction;
    if (
      !isNil(nativeAmountInfo.maxSendAmount) &&
      nativeTx.type === sdkAlgo.TransactionType.pay
    ) {
      return encodeTransaction(
        sdkAlgo.Transaction.from_obj_for_encoding({
          ...nativeTx,
          amt: BigInt(
            new BigNumber(nativeAmountInfo.maxSendAmount)
              .shiftedBy(network.decimals)
              .toFixed(),
          ),
        }),
      );
    }
    return Promise.resolve(encodedTx);
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, nativeAmountInfo } = params;
    let encodedTxNew = unsignedTx.encodedTx as
      | IEncodedTxAlgo
      | IEncodedTxGroupAlgo;

    if (!isArray(encodedTxNew)) {
      if (nativeAmountInfo) {
        encodedTxNew = await this._updateNativeTokenAmount({
          encodedTx: encodedTxNew,
          nativeAmountInfo,
        });
      }
    }

    unsignedTx.encodedTx = encodedTxNew;
    return unsignedTx;
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    if (sdkAlgo.isValidAddress(address)) {
      return Promise.resolve({
        isValid: true,
        displayAddress: address,
        normalizedAddress: address,
      });
    }
    return Promise.resolve({
      isValid: false,
      displayAddress: '',
      normalizedAddress: '',
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey = Buffer.from(sdkAlgo.seedFromMnemonic(input)).toString(
      'hex',
    );
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
    try {
      const seed = sdkAlgo.seedFromMnemonic(privateKey);
      if (seed) {
        return Promise.resolve({
          isValid: true,
        });
      }
    } catch {
      // pass
    }

    return Promise.resolve({
      isValid: false,
    });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }
}
