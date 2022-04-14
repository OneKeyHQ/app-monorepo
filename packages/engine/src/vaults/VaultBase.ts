/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  IDecodedTx,
  IEncodedTxAny,
  IFeeInfo,
  IFeeInfoUnit,
  ITransferInfo,
} from '../types/vault';
import { WalletType } from '../types/wallet';

import { VaultContext } from './VaultContext';

import type { IBroadcastedTx, ISignCredentialOptions } from '../types/vault';
import type { KeyringBase, KeyringBaseMock } from './keyring/KeyringBase';
import type { VaultHelperBase } from './VaultHelperBase';
import type { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

export type IVaultInitConfig = {
  keyringCreator: (vault: VaultBase) => Promise<KeyringBase>;
};
export type IKeyringMapKey = WalletType;

export abstract class VaultBase extends VaultContext {
  keyring!: KeyringBase;

  helper!: VaultHelperBase;

  abstract keyringMap: Record<IKeyringMapKey, typeof KeyringBaseMock>;

  async init(config: IVaultInitConfig) {
    // TODO wait context init
    // await this.initContext();
    await this.initKeyring(config);
  }

  async initKeyring(config: IVaultInitConfig) {
    this.keyring = await config.keyringCreator(this);
  }

  // TODO remove
  abstract simpleTransfer(
    payload: {
      to: string;
      value: string;
      tokenIdOnNetwork?: string;
      extra?: { [key: string]: any };
      gasPrice: string; // TODO remove gasPrice, gasLimit
      gasLimit: string;
    },
    // TODO rename ISignAuthInfo
    options: ISignCredentialOptions,
  ): Promise<IBroadcastedTx>;

  abstract attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxAny;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxAny>;

  abstract decodeTx(encodedTx: IEncodedTxAny): Promise<IDecodedTx>;

  abstract buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxAny>;

  // buildEncodedTxFromNftTransfer
  // buildEncodedTxFromSwap

  abstract buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxAny,
  ): Promise<UnsignedTx>;

  abstract fetchFeeInfo(encodedTx: IEncodedTxAny): Promise<IFeeInfo>;

  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ) {
    return this.keyring.signTransaction(unsignedTx, options);
  }

  async signAndSendTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<IBroadcastedTx> {
    const signedTx = await this.signTransaction(unsignedTx, options);
    return this.broadcastTransaction(signedTx.rawTx, options);
  }

  async broadcastTransaction(
    rawTx: string,
    options: ISignCredentialOptions,
  ): Promise<IBroadcastedTx> {
    debugLogger.engine('broadcastTransaction START:', { rawTx });
    // TODO RPC Error format return: EIP-1474 EIP-1193
    const txid = await this.engine.providerManager.broadcastTransaction(
      this.networkId,
      rawTx,
    );
    debugLogger.engine('broadcastTransaction END:', { txid, rawTx });
    return {
      rawTx,
      txid,
    };
  }
}
