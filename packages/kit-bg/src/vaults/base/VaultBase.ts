/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/* eslint max-classes-per-file: "off" */

import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getOnChainHistoryTxStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IOnChainHistoryTxAsset,
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
  IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTransferType } from '@onekeyhq/shared/types/history';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { VaultContext } from './VaultContext';

import type { KeyringBase } from './KeyringBase';
import type { IDBWalletType } from '../../dbs/local/types';
import type {
  IBroadcastTransactionParams,
  IBuildEncodedTxParams,
  IBuildHistoryTxParams,
  IBuildUnsignedTxParams,
  ISignAndSendTransactionParams,
  ISignTransactionParams,
  IUpdateUnsignedTxParams,
  IVaultOptions,
  IVaultSettings,
} from '../types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

export type IVaultInitConfig = {
  keyringCreator: (vault: VaultBase) => Promise<KeyringBase>;
};
export type IKeyringMapKey = IDBWalletType;

if (platformEnv.isExtensionUi) {
  debugger;
  throw new Error('engine/VaultBase is not allowed imported from ui');
}

export abstract class VaultBaseChainOnly extends VaultContext {
  abstract settings: IVaultSettings;

  constructor(options: IVaultOptions) {
    super(options);
    this.checkVaultSettingsIsValid();
  }

  private checkVaultSettingsIsValid() {
    if (!Object.isFrozen(this.settings)) {
      throw new Error(
        `VaultSettings should be frozen, please use Object.freeze() >>>> networkId=${this.networkId}, accountId=${this.accountId}`,
      );
    }
  }

  // Methods not related to a single account, but implementation.

  async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    throw new NotImplemented();
  }

  // **** address parser: dbAddress, baseAddress, displayAddress, utxoAddress, normalizedAddress
  // async addressFromBase(account: DBAccount): Promise<string> {
  // async addressToBase(address: string): Promise<string> {
  // async getDisplayAddress(address: string): Promise<string> {
}

// **** more VaultBase: VaultBaseEvmLike, VaultBaseUtxo, VaultBaseVariant
// **** or more interface to implement: IVaultEvmLike, IVaultUtxo, IVaultVariant
export abstract class VaultBase extends VaultBaseChainOnly {
  uuid: string = generateUUID();

  keyring!: KeyringBase;

  abstract keyringMap: Record<IKeyringMapKey, typeof KeyringBase>;

  async init(config: IVaultInitConfig) {
    await this.initKeyring(config);
  }

  async initKeyring(config: IVaultInitConfig) {
    this.keyring = await config.keyringCreator(this);
  }

  abstract buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx>;

  abstract buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro>;

  abstract updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro>;

  abstract broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro>;

  abstract validateAddress(address: string): Promise<IAddressValidation>;

  async validateSendAmount() {
    return Promise.resolve(true);
  }

  async fixHistoryTx(historyTx: IAccountHistoryTx): Promise<IAccountHistoryTx> {
    if (platformEnv.isDev && platformEnv.isDesktop) {
      Object.assign(historyTx, {
        _tmpCreatedAtText: new Date(
          historyTx.decodedTx.createdAt || 0,
        ).toLocaleString(),
        _tmpUpdatedAtText: new Date(
          historyTx.decodedTx.updatedAt || 0,
        ).toLocaleString(),
        _tmpStatus: historyTx.decodedTx.status,
        _tmpIsFinal: historyTx.decodedTx.isFinal,
      });
    }
    return Promise.resolve(historyTx);
  }

  async buildHistoryTx({
    historyTxToMerge,
    encodedTx,
    decodedTx,
    signedTx,
    isSigner,
    isLocalCreated,
  }: {
    historyTxToMerge?: IAccountHistoryTx;
    encodedTx?: IEncodedTx | null;
    decodedTx: IDecodedTx;
    signedTx?: ISignedTxPro;
    isSigner?: boolean;
    isLocalCreated?: boolean;
  }): Promise<IAccountHistoryTx> {
    const txid: string = signedTx?.txid || decodedTx?.txid || '';
    if (!txid) {
      throw new Error('buildHistoryTx txid not found');
    }
    // const address = await this.getAccountAddress();
    // decodedTx.txid = txid || decodedTx.txid;
    // decodedTx.owner = address;
    // if (isSigner) {
    //   decodedTx.signer = address;
    // }

    // must include accountId here, so that two account wont share same tx history
    const historyId = `${this.networkId}_${txid}_${this.accountId}`;
    const historyTx: IAccountHistoryTx = {
      id: historyId,

      isLocalCreated: Boolean(isLocalCreated),

      ...historyTxToMerge,

      decodedTx,
    };
    return Promise.resolve(historyTx);
  }

  async buildOnChainHistoryTxs(
    params: IBuildHistoryTxParams,
  ): Promise<IAccountHistoryTx[]> {
    const { accountId, networkId, onChainHistoryTxs, localHistoryTxs, tokens } =
      params;

    const promises = onChainHistoryTxs.map(async (onChainTx) => {
      try {
        const historyTxToMerge = localHistoryTxs.find(
          (item) => item.decodedTx.txid === onChainTx.tx,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          return null;
        }

        const actions = this.buildHistoryTxActions({
          tx: onChainTx,
          tokens,
        });

        const decodedTx: IDecodedTx = {
          txid: onChainTx.tx,

          owner: onChainTx.from,
          signer: onChainTx.from,

          nonce: onChainTx.nonce,
          actions,

          status: getOnChainHistoryTxStatus(onChainTx.status),

          networkId,
          accountId,

          totalFeeInNative: onChainTx.gasFee,

          extraInfo: null,
        };

        decodedTx.updatedAt = new Date(onChainTx.timestamp * 1000).getTime();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === EDecodedTxStatus.Confirmed;

        return await this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        console.log(e);
        return null;
      }
    });

    return (await Promise.all(promises)).filter(Boolean) as IAccountHistoryTx[];
  }

  buildHistoryTxActions({
    tx,
    tokens,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxAsset>;
  }) {
    const actions: IDecodedTxAction[] = [];

    [...tx.sends, ...tx.receives].forEach((transfer) => {
      const token = tokens[transfer.token];

      if (token) {
        if (transfer.type === EOnChainHistoryTransferType.Approve) {
          actions.push(
            this.buildHistoryTxApproveAction({
              transfer,
              token: (token as IOnChainHistoryTxToken).info,
            }),
          );
        }

        // @ts-ignore
        // nft
        if (token.itemId) {
          actions.push(
            this.buildHistoryNFTAction({
              transfer,
              nft: token as IOnChainHistoryTxNFT,
            }),
          );
        } // token
        else if (transfer.token !== '') {
          actions.push(
            this.buildHistoryNativeTransferAction({
              transfer,
              token: (token as IOnChainHistoryTxToken).info,
            }),
          );
        } // native token
        else {
          actions.push(
            this.buildHistoryNativeTransferAction({
              transfer,
              token: (token as IOnChainHistoryTxToken).info,
            }),
          );
        }
      }
    });

    if (isEmpty(actions)) {
      actions.push(this.buildHistoryTxDefaultAction(tx));
    }

    return actions;
  }

  buildHistoryTxDefaultAction(tx: IOnChainHistoryTx): IDecodedTxAction {
    return {
      type: EDecodedTxActionType.FUNCTION_CALL,
      functionCall: {
        target: tx.to,
        functionName: tx.type,
        functionHash: tx.functionCode,
        args: tx.params,
      },
    };
  }

  buildHistoryNativeTransferAction({
    transfer,
    token,
  }: {
    transfer: IOnChainHistoryTxTransfer;
    token: IToken;
  }) {
    return {
      type: EDecodedTxActionType.NATIVE_TRANSFER,
      nativeTransfer: {
        from: transfer.from,
        to: transfer.to,
        amount: new BigNumber(transfer.amount).abs().toFixed(),
        amountValue: new BigNumber(transfer.amount)
          .abs()
          .shiftedBy(token.decimals)
          .toFixed(),
        tokenInfo: token,
      },
    };
  }

  buildHistoryTokenTransferAction({
    transfer,
    token,
  }: {
    transfer: IOnChainHistoryTxTransfer;
    token: IToken;
  }) {
    return {
      type: EDecodedTxActionType.TOKEN_TRANSFER,
      tokenTransfer: {
        tokenInfo: token,
        from: transfer.from,
        to: transfer.to,
        amount: new BigNumber(transfer.amount).abs().toFixed(),
        amountValue: new BigNumber(transfer.amount)
          .abs()
          .shiftedBy(token.decimals)
          .toFixed(),
      },
    };
  }

  buildHistoryNFTAction({
    transfer,
    nft,
  }: {
    transfer: IOnChainHistoryTxTransfer;
    nft: IOnChainHistoryTxNFT;
  }) {
    return {
      type: EDecodedTxActionType.NFT_TRANSFER,
      nftTransfer: {
        nftInfo: nft,
        from: transfer.from,
        to: transfer.to,
        amount: new BigNumber(transfer.amount).abs().toFixed(),
      },
    };
  }

  buildHistoryTxApproveAction({
    transfer,
    token,
  }: {
    transfer: IOnChainHistoryTxTransfer;
    token: IToken;
  }): IDecodedTxAction {
    return {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        tokenInfo: token,
        owner: transfer.from,
        spender: transfer.to,
        amount: new BigNumber(transfer.amount).abs().toFixed(),
        amountValue: new BigNumber(transfer.amount)
          .abs()
          .shiftedBy(token.decimals)
          .toFixed(),
        // TODO will be provided by the interface.
        isMax: false,
      },
    };
  }

  // DO NOT override this method
  async signTransaction(params: ISignTransactionParams): Promise<ISignedTxPro> {
    const { unsignedTx, password } = params;
    if (!password) {
      throw new Error('signAndSendTransaction ERROR: password is required');
    }
    const signedTx = await this.keyring.signTransaction(params);
    return {
      ...signedTx,
      encodedTx: signedTx.encodedTx ?? unsignedTx.encodedTx,
    };
  }

  // DO NOT override this method, override broadcastTransaction instead.
  async signAndSendTransaction(
    params: ISignAndSendTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const signedTx = await this.signTransaction(params);
    return this.broadcastTransaction({
      signedTx: {
        ...signedTx,
        encodedTx: signedTx.encodedTx ?? unsignedTx.encodedTx,
      },
    });
  }
}
