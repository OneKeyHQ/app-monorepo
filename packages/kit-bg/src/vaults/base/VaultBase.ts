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
import {
  EOnChainHistoryTransferType,
  type IAccountHistoryTx,
  type IOnChainHistoryTx,
  type IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';

import { VaultContext } from './VaultContext';

import type { KeyringBase } from './KeyringBase';
import type { IDBWalletType } from '../../dbs/local/types';
import type {
  IBroadcastTransactionParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildHistoryTxParams,
  IBuildUnsignedTxParams,
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

  abstract buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx>;

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

  async buildOnChainHistoryTx(
    params: IBuildHistoryTxParams,
  ): Promise<IAccountHistoryTx | null> {
    const { accountId, networkId, onChainHistoryTx } = params;

    try {
      const action = this.buildHistoryTxAction({ tx: onChainHistoryTx });

      const decodedTx: IDecodedTx = {
        txid: onChainHistoryTx.tx,

        owner: onChainHistoryTx.from,
        signer: onChainHistoryTx.from,

        nonce: onChainHistoryTx.nonce,
        actions: [action],

        status: getOnChainHistoryTxStatus(onChainHistoryTx.status),

        networkId,
        accountId,

        totalFeeInNative: onChainHistoryTx.gasFee,

        extraInfo: null,
      };

      decodedTx.updatedAt = new Date(
        onChainHistoryTx.timestamp * 1000,
      ).getTime();
      decodedTx.createdAt = decodedTx.updatedAt;
      // On chain tx is always final
      decodedTx.isFinal = true;

      return await this.buildHistoryTx({
        decodedTx,
      });
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  buildHistoryTxAction({ tx }: { tx: IOnChainHistoryTx }) {
    if (isEmpty(tx.sends) && isEmpty(tx.receives)) {
      return this.buildHistoryTxDefaultAction(tx);
    }

    if (tx.sends[0]?.type === EOnChainHistoryTransferType.Approve) {
      return this.buildHistoryTxApproveAction(tx);
    }

    return this.buildHistoryTransferAction(tx);
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

  buildHistoryTransferAction(tx: IOnChainHistoryTx): IDecodedTxAction {
    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        from: tx.from,
        to: tx.to,
        label: tx.label.label,
        sends: tx.sends.map((send) => this.buildHistoryTransfer(send)),
        receives: tx.receives.map((receive) =>
          this.buildHistoryTransfer(receive),
        ),
      },
    };
  }

  buildHistoryTransfer(transfer: IOnChainHistoryTxTransfer) {
    let image = '';
    let symbol = '';
    let isNFT = false;
    if (!isNil((transfer.info as IAccountNFT)?.itemId)) {
      const info = transfer.info as IAccountNFT;
      image = info.metadata.image;
      symbol = info.metadata.name;
      isNFT = true;
    } else if (!isNil((transfer.info as IToken)?.address)) {
      const info = transfer.info as IToken;
      image = info.logoURI;
      symbol = info.symbol;
    }

    return {
      from: transfer.from,
      to: transfer.to,
      token: transfer.token,
      amount: transfer.amount,
      image,
      symbol,
      isNFT,
      label: transfer.label.label,
    };
  }

  buildHistoryTxApproveAction(tx: IOnChainHistoryTx): IDecodedTxAction {
    const approve = tx.sends[0];
    const transfer = this.buildHistoryTransfer(approve);
    return {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        label: approve.label.label ?? tx.label.label,
        owner: approve.from,
        spender: approve.to,
        tokenIcon: transfer.image,
        amount: new BigNumber(approve.amount).abs().toFixed(),
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
}
