/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isArray, isEmpty, isNil, trim } from 'lodash';

import type {
  IEncodedTxAlgo,
  IEncodedTxGroupAlgo,
} from '@onekeyhq/core/src/chains/algo/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  ManageTokenInsufficientBalanceError,
  OneKeyError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IAccountToken } from '@onekeyhq/shared/types/token';
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
import { ALGO_TX_MIN_FEE, encodeTransaction } from './utils';

import type {
  ISdkAlgoAccountInformation,
  ISdkAlgoEncodedTransaction,
} from './sdkAlgo';
import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
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
  override coreApi = coreChainApi.algo.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
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
    const { transfersInfo, specifiedFeeRate } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      if (transfersInfo.length === 1) {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
          specifiedFeeRate,
        });
      }
      throw new OneKeyInternalError('Batch transfers not supported');
    }

    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromTransfer(params: {
    transferInfo: ITransferInfo;
    specifiedFeeRate?: string;
  }) {
    const { transferInfo, specifiedFeeRate } = params;
    const tx = await this._buildAlgoTxFromTransferInfo({
      transferInfo,
      specifiedFeeRate,
    });
    return encodeTransaction(tx);
  }

  async _buildAlgoTxFromTransferInfo(params: {
    transferInfo: ITransferInfo;
    specifiedFeeRate?: string;
  }) {
    const { transferInfo, specifiedFeeRate } = params;
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { from, to, amount, tokenInfo, note } = transferInfo;

    if (!tokenInfo) {
      throw new Error(
        'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
      );
    }

    const suggestedParams = await this._getSuggestedParams();

    if (!isNil(specifiedFeeRate)) {
      const network = await this.getNetwork();
      suggestedParams.fee = Number(
        chainValueUtils.convertAmountToChainValue({
          value: new BigNumber(
            BigNumber.max(specifiedFeeRate, ALGO_TX_MIN_FEE).toFixed(),
          ),
          network,
        }),
      );

      suggestedParams.flatFee = true;
    }

    const txNote = note ? new Uint8Array(Buffer.from(note)) : undefined;
    if (tokenInfo.isNative) {
      return sdkAlgo.makePaymentTxnWithSuggestedParamsFromObject({
        amount: BigInt(
          new BigNumber(amount).shiftedBy(tokenInfo.decimals).toFixed(),
        ),
        from,
        to,
        suggestedParams,
        note: txNote,
      });
    }

    return sdkAlgo.makeAssetTransferTxnWithSuggestedParamsFromObject({
      amount: BigInt(
        new BigNumber(amount).shiftedBy(tokenInfo.decimals).toFixed(),
      ),
      assetIndex: parseInt(tokenInfo.address, 10),
      from,
      to,
      suggestedParams,
      note: txNote,
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

    actions.sort((a, b) => {
      if (a.type === EDecodedTxActionType.ASSET_TRANSFER) {
        return -1;
      }
      return 1;
    });

    const tx = {
      txid: '',
      owner: accountAddress,
      signer: sender,
      nonce: 0,
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: {
        note: notes.join(' '),
        groupId,
      },
      encodedTx,
    };

    return tx;
  }

  async _decodeAlgoTx(encodedTx: IEncodedTxAlgo) {
    const nativeTx = sdkAlgo.decodeObj(
      Buffer.from(encodedTx, 'base64'),
    ) as ISdkAlgoEncodedTransaction;
    const sender = sdkAlgo.encodeAddress(nativeTx.snd);

    let action: IDecodedTxAction = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: sender,
        to: '',
      },
    };

    if (nativeTx.type === sdkAlgo.TransactionType.pay) {
      const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
        networkId: this.networkId,
        accountId: this.accountId,
      });

      if (nativeToken) {
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
    }

    if (nativeTx.type === sdkAlgo.TransactionType.axfer) {
      const to = sdkAlgo.encodeAddress(nativeTx.arcv!);
      const token = await this.backgroundApi.serviceToken.getToken({
        networkId: this.networkId,
        tokenIdOnNetwork: nativeTx.xaid!.toString(),
        accountId: this.accountId,
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
                accountId: this.accountId,
                contractList: [token.address],
              })
            )[0];

            amount = new BigNumber(tokenDetails.balance ?? 0).toFixed();
          }
          const transfer: IDecodedTxTransferInfo = {
            from: assetSender ?? sender,
            to,
            tokenIdOnNetwork: token.address,
            icon: token.logoURI ?? '',
            name: token.name,
            symbol: token.symbol,
            amount: new BigNumber(amount).shiftedBy(-token.decimals).toFixed(),
            isNFT: false,
            isNative: false,
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

  async _buildUnsignedTxFromEncodedTx({
    encodedTx,
    transfersInfo,
  }: {
    encodedTx: IEncodedTxAlgo;
    transfersInfo: ITransferInfo[];
  }) {
    return {
      encodedTx,
      transfersInfo,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx({
        encodedTx: encodedTx as IEncodedTxAlgo,
        transfersInfo: params.transfersInfo ?? [],
      });
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
    const { unsignedTx, nativeAmountInfo, feeInfo } = params;
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
      if (feeInfo) {
        if (!unsignedTx.transfersInfo || isEmpty(unsignedTx.transfersInfo)) {
          throw new OneKeyInternalError('transfersInfo is required');
        }
        encodedTxNew = await this._attachFeeInfoToEncodedTx({
          encodedTx: unsignedTx.encodedTx as IEncodedTxAlgo,
          transfersInfo: unsignedTx.transfersInfo,
          feeInfo,
        });
      }
    }

    unsignedTx.encodedTx = encodedTxNew;
    return unsignedTx;
  }

  async _attachFeeInfoToEncodedTx({
    encodedTx,
    feeInfo,
    transfersInfo,
  }: {
    encodedTx: IEncodedTxAlgo;
    feeInfo: IFeeInfoUnit;
    transfersInfo: ITransferInfo[];
  }) {
    if (feeInfo.feeAlgo?.baseFee) {
      const flatFee = feeInfo.feeAlgo.baseFee;

      if (typeof flatFee === 'string') {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
          specifiedFeeRate: flatFee,
        });
      }
    }

    return Promise.resolve(encodedTx);
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

  override async activateToken(params: {
    token: IAccountToken;
  }): Promise<boolean> {
    if (params.token.isNative) {
      return Promise.resolve(true);
    }
    const { token } = params;
    const dbAccount = await this.getAccount();
    const client = await this.getClient();
    const { assets } = await client.accountInformation(dbAccount.address);

    for (const { 'asset-id': assetId } of assets) {
      if (assetId === parseInt(token.address, 10)) {
        return Promise.resolve(true);
      }
    }

    const unsignedTx = await this.buildUnsignedTx({
      transfersInfo: [
        {
          from: dbAccount.address,
          to: dbAccount.address,
          amount: '0',
          tokenInfo: token,
        },
      ],
    });

    try {
      const [signedTx] =
        await this.backgroundApi.serviceSend.batchSignAndSendTransaction({
          accountId: this.accountId,
          networkId: this.networkId,
          unsignedTxs: [unsignedTx],
          transferPayload: undefined,
        });
      return !!signedTx.signedTx.txid;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      if (e.message.includes(`overspend (account ${dbAccount.address}`)) {
        throw new ManageTokenInsufficientBalanceError({
          info: {
            token: 'Algo',
          },
        });
      }
      throw e;
    }
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const client = new sdkAlgo.Algodv2('', params.rpcUrl, 443);
    const start = performance.now();
    const { 'last-round': latestBlock } = await client.status().do();
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber: latestBlock,
    };
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('rpcUrl is required');
    }
    const client = new sdkAlgo.Algodv2('', rpcUrl, 443);
    const { txId } = await client
      .sendRawTransaction(Buffer.from(signedTx.rawTx, 'base64'))
      .do();
    console.log('broadcastTransaction END:', {
      txId,
      rawTx: signedTx.rawTx,
    });
    return {
      ...params.signedTx,
      txid: txId,
    };
  }
}
