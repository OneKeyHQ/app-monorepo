/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/* eslint max-classes-per-file: "off" */

import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import {
  getOnChainHistoryTxAssetInfo,
  getOnChainHistoryTxStatus,
} from '@onekeyhq/shared/src/utils/historyUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IAddressValidation,
  INetworkAccountAddressDetail,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
  IOnChainHistoryTxAsset,
  IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTransferType } from '@onekeyhq/shared/types/history';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { VaultContext } from './VaultContext';

import type { KeyringBase } from './KeyringBase';
import type { IDBAccount, IDBWalletType } from '../../dbs/local/types';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildHistoryTxParams,
  IBuildTxHelperParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
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

  abstract validateAddress(address: string): Promise<IAddressValidation>;

  abstract validateXpub(xpub: string): Promise<IXpubValidation>;

  async baseGetPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey = hexUtils.stripHexPrefix(input);
    privateKey = encodeSensitiveText({ text: privateKey });
    return {
      privateKey,
    };
  }

  abstract getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult>;
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
    if (!this.options.isChainOnly) {
      this.keyring = await config.keyringCreator(this);
    }
  }

  abstract buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail>;

  abstract buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx>;

  abstract buildDecodedTx(
    params: IBuildDecodedTxParams & IBuildTxHelperParams,
  ): Promise<IDecodedTx>;

  abstract buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro>;

  abstract updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro>;

  abstract broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro>;

  async validateSendAmount() {
    return Promise.resolve(true);
  }

  async buildHistoryTx({
    historyTxToMerge,
    decodedTx,
    signedTx,
    isSigner,
    isLocalCreated,
  }: {
    historyTxToMerge?: IAccountHistoryTx;
    decodedTx: IDecodedTx;
    signedTx?: ISignedTxPro;
    isSigner?: boolean;
    isLocalCreated?: boolean;
  }): Promise<IAccountHistoryTx> {
    const txid: string = signedTx?.txid || decodedTx?.txid || '';
    if (!txid) {
      throw new Error('buildHistoryTx txid not found');
    }
    const address = await this.getAccountAddress();
    decodedTx.txid = txid || decodedTx.txid;
    decodedTx.owner = address;
    if (isSigner) {
      decodedTx.signer = address;
    }

    // must include accountId here, so that two account wont share same tx history
    const historyId = accountUtils.buildLocalHistoryId({
      networkId: this.networkId,
      txid,
      accountId: this.accountId,
    });
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
    const { accountId, networkId, onChainHistoryTx, tokens, index } = params;

    try {
      const action = await this.buildHistoryTxAction({
        tx: onChainHistoryTx,
        tokens,
      });

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

        totalFeeFiatValue: onChainHistoryTx.gasFeeFiatValue,

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

  async buildHistoryTxAction({
    tx,
    tokens,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxAsset>;
  }) {
    if (isEmpty(tx.sends) && isEmpty(tx.receives)) {
      if (tx.type) return this.buildHistoryTxFunctionCallAction({ tx });
      return this.buildHistoryTxUnknownAction({ tx });
    }

    if (tx.sends[0]?.type === EOnChainHistoryTransferType.Approve) {
      return this.buildHistoryTxApproveAction({ tx, tokens });
    }

    return this.buildHistoryTransferAction({ tx, tokens });
  }

  async buildHistoryTxFunctionCallAction({
    tx,
  }: {
    tx: IOnChainHistoryTx;
  }): Promise<IDecodedTxAction> {
    const network = await this.getNetwork();
    return {
      type: EDecodedTxActionType.FUNCTION_CALL,
      functionCall: {
        from: tx.from,
        to: tx.to,
        functionName: tx.type,
        functionHash: tx.functionCode,
        args: tx.params,
        icon: network.logoURI,
      },
    };
  }

  async buildHistoryTxUnknownAction({
    tx,
  }: {
    tx: IOnChainHistoryTx;
  }): Promise<IDecodedTxAction> {
    const network = await this.getNetwork();
    return {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: tx.from,
        to: tx.to,
        icon: network.logoURI,
      },
    };
  }

  buildHistoryTransferAction({
    tx,
    tokens,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxAsset>;
  }): IDecodedTxAction {
    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        from: tx.from,
        to: tx.to,
        label: tx.label.label,
        sends: tx.sends.map((send) =>
          this.buildHistoryTransfer({
            transfer: send,
            tokens,
          }),
        ),
        receives: tx.receives.map((receive) =>
          this.buildHistoryTransfer({
            transfer: receive,
            tokens,
          }),
        ),
      },
    };
  }

  buildHistoryTransfer({
    transfer,
    tokens,
  }: {
    transfer: IOnChainHistoryTxTransfer;
    tokens: Record<string, IOnChainHistoryTxAsset>;
  }) {
    const { icon, symbol, name, isNFT, isNative } =
      getOnChainHistoryTxAssetInfo({
        tokenAddress: transfer.token,
        tokens,
      });

    return {
      from: transfer.from,
      to: transfer.to,
      tokenIdOnNetwork: transfer.token,
      amount: transfer.amount,
      label: transfer.label.label,
      icon,
      name,
      symbol,
      isNFT,
      isNative,
    };
  }

  buildHistoryTxApproveAction({
    tx,
    tokens,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxAsset>;
  }): IDecodedTxAction {
    const approve = tx.sends[0];
    const transfer = this.buildHistoryTransfer({
      transfer: approve,
      tokens,
    });
    return {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        label: approve.label.label ?? tx.label.label,
        from: approve.from,
        to: approve.to,
        icon: transfer.icon,
        name: transfer.name,
        symbol: transfer.symbol,
        tokenIdOnNetwork: transfer.tokenIdOnNetwork,
        amount: new BigNumber(approve.amount).abs().toFixed(),
        // TODO: isMax from server
        isMax: false,
      },
    };
  }

  // DO NOT override this method
  async signTransaction(params: ISignTransactionParams): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const signedTx = await this.keyring.signTransaction(params);
    return {
      ...signedTx,
      encodedTx: signedTx.encodedTx ?? unsignedTx.encodedTx,
    };
  }

  // TODO resetCache after dbAccount and network DB updated
  // TODO add memo
  async getAccount(): Promise<INetworkAccount> {
    const account: IDBAccount =
      await this.backgroundApi.serviceAccount.getDBAccount({
        accountId: this.accountId,
      });

    if (
      !accountUtils.isAccountCompatibleWithNetwork({
        account,
        networkId: this.networkId,
      })
    ) {
      throw new Error(
        `account impl not matched to network: ${this.networkId} ${account.id}`,
      );
    }

    const networkInfo = await this.getNetworkInfo();
    const addressDetail = await this.buildAccountAddressDetail({
      networkInfo,
      account,
      networkId: this.networkId,
    });

    const address = addressDetail?.address || account.address;
    return {
      ...account,
      addressDetail,
      address,
    };
  }

  async getAccountAddress() {
    return (await this.getAccount()).address;
  }

  async getAccountPath() {
    return (await this.getAccount()).path;
  }
}
