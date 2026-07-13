import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { ThirdPartyChainNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';

import { EVaultKeyringTypes } from '../types';

import { KeyringBase } from './KeyringBase';

import type { VaultBase } from './VaultBase';
import type { IDBAccount } from '../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IBuildPrepareAccountsPrefixedPathParams,
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IPrepareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

// Defers unsupported-chain errors until a user-invoked keyring method runs.
export class ThirdPartyUnsupportedKeyringStub extends KeyringBase {
  constructor(
    vault: VaultBase,
    private readonly meta: { vendor: string; chain?: string },
  ) {
    super(vault);
  }

  override coreApi = undefined;

  override keyringType = EVaultKeyringTypes.hardware;

  private throwUnsupported(): never {
    throw new ThirdPartyChainNotSupported({
      vendor: this.meta.vendor,
      chain: this.meta.chain,
      payload: {},
    });
  }

  override signTransaction(
    _params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    this.throwUnsupported();
  }

  override signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    this.throwUnsupported();
  }

  override prepareAccounts(
    _params: IPrepareAccountsParams,
  ): Promise<IDBAccount[]> {
    this.throwUnsupported();
  }

  override batchGetAddresses(
    _params: IPrepareAccountsParams,
  ): Promise<{ address: string; path: string }[]> {
    this.throwUnsupported();
  }

  override exportAccountSecretKeys(
    _params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    this.throwUnsupported();
  }

  override buildHwAllNetworkPrepareAccountsParams(
    _params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    this.throwUnsupported();
  }

  override buildPrepareAccountsPrefixedPath(
    _params: IBuildPrepareAccountsPrefixedPathParams,
  ): string {
    this.throwUnsupported();
  }
}
