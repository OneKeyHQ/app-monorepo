// eslint-disable-next-line max-classes-per-file
import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type {
  ICoreApiNetworkInfo,
  ICurveName,
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
    const chainInfo = await this.getChainInfo();
    // check presetNetworks.extensions.providerOptions
    const addressPrefix = chainInfo?.implOptions?.addressPrefix as
      | string
      | undefined;
    const curve = chainInfo?.implOptions?.curve as ICurveName | undefined;
    const chainCode = chainInfo.code;
    const chainId = await this.vault.getNetworkChainId();
    const networkImpl = await this.getNetworkImpl();
    const { isTestnet } = network;
    const { networkId } = this;
    return {
      isTestnet,
      networkChainCode: chainCode,
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
