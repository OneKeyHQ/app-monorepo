/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
// eslint-disable-next-line max-classes-per-file
import type { CoreChainApiBase } from '@onekeyhq/core/src/base/CoreChainApiBase';
import type { ICurveName } from '@onekeyhq/core/src/secret';
import type { ICoreApiNetworkInfo } from '@onekeyhq/core/src/types';

import { EVaultKeyringTypes } from '../types';
import { VaultContext } from '../VaultContext';

import type { DBAccount } from '../../types/account';
import type { IUnsignedMessage } from '../../types/message';
import type {
  IGetAddressParams,
  IPrepareAccountByAddressIndexParams,
  IPrepareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../types';
import type { VaultBase } from '../VaultBase';

export abstract class KeyringBase extends VaultContext {
  constructor(vault: VaultBase) {
    super(vault.options);
    this.vault = vault;
  }

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

  vault: VaultBase;

  coreApi: CoreChainApiBase | undefined;

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

  override async addressFromBase(account: DBAccount) {
    return this.vault.addressFromBase(account);
  }

  abstract signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro>;

  abstract signMessage(
    messages: IUnsignedMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]>;

  abstract prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<Array<DBAccount>>;

  // TODO merge prepareAccounts, getAddress, batchGetAddress, getAddressesFromHd, getAddressFromPrivate
  abstract getAddress(params: IGetAddressParams): Promise<string>;

  abstract batchGetAddress(
    params: IGetAddressParams[],
  ): Promise<{ path: string; address: string }[]>;

  // TODO BTC fork only?
  abstract prepareAccountByAddressIndex(
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<Array<DBAccount>>;
}

// @ts-ignore
export class KeyringBaseMock extends KeyringBase {}
