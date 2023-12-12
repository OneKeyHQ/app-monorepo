/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/* eslint max-classes-per-file: "off" */

import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { VaultContext } from './VaultContext';

import type { KeyringBase } from './KeyringBase';
import type { IDBWalletType } from '../../dbs/local/types';
import type {
  IBroadcastTransactionParams,
  IBuildEncodedTxParams,
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
