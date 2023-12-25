// eslint-disable-next-line max-classes-per-file
import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type {
  ICoreApiNetworkInfo,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { EVaultKeyringTypes } from '../types';

import { VaultContext } from './VaultContext';

import type { VaultBase } from './VaultBase';
import type { IDBAccount } from '../../dbs/local/types';
import type {
  IPrepareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../types';

export abstract class KeyringBase extends VaultContext {
  constructor(vault: VaultBase) {
    super(vault.options);
    this.vault = vault;
  }

  vault: VaultBase;

  abstract coreApi: CoreChainApiBase | undefined;

  abstract keyringType: EVaultKeyringTypes;

  isKeyringImported() {
    return this.keyringType === EVaultKeyringTypes.imported;
  }

  isKeyringHd() {
    return this.keyringType === EVaultKeyringTypes.hd;
  }

  isKeyringHardware() {
    return this.keyringType === EVaultKeyringTypes.hardware;
  }

  isKeyringWatching() {
    return this.keyringType === EVaultKeyringTypes.watching;
  }

  async baseGetCoreApiNetworkInfo(): Promise<ICoreApiNetworkInfo> {
    const network = await this.getNetwork();
    const networkInfo = await this.getNetworkInfo();
    // check presetNetworks.extensions.providerOptions
    const { addressPrefix, curve } = networkInfo;
    const networkImpl = await this.getNetworkImpl();
    const chainId = await this.vault.getNetworkChainId();
    const { isTestnet } = network;
    const { networkId } = this;
    return {
      isTestnet,
      networkChainCode: networkImpl,
      chainId,
      networkId,
      networkImpl,
      addressPrefix,
      curve,
    };
  }

  abstract signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro>;

  abstract signMessage(params: ISignMessageParams): Promise<ISignedMessagePro>;

  abstract prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<IDBAccount[]>;
}

// @ts-ignore
export class KeyringBaseMock extends KeyringBase {}
