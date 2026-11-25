import type { IStarknetSignature } from '@onekeyhq/core/src/chains/starknet/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';

import { KeyringImportedBase } from '../../base/KeyringImportedBase';

import {
  deriveSoftwareViewingKey,
  signSoftwareProofInvocation,
} from './privacySigningContext';

import type {
  IDeriveStrk20ViewingKeyParams,
  IDeriveStrk20ViewingKeyResult,
  ISignStrk20ProofInvocationParams,
} from './privacyKeyringTypes';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareImportedAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override coreApi = coreChainApi.starknet.imported;

  override async exportAccountSecretKeys(
    params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    return this.baseExportAccountSecretKeys(params);
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys({
      ...params,
      addressEncoding: await this.vault.getAddressEncoding(),
    });
  }

  async deriveStrk20ViewingKey(
    params: IDeriveStrk20ViewingKeyParams,
  ): Promise<IDeriveStrk20ViewingKeyResult> {
    return deriveSoftwareViewingKey(this, params);
  }

  async signStrk20ProofInvocation(
    params: ISignStrk20ProofInvocationParams,
  ): Promise<IStarknetSignature> {
    return signSoftwareProofInvocation(this, params);
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareAccountsImported(params);
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction({
      ...params,
      addressEncoding: await this.vault.getAddressEncoding(),
    });
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    return this.baseSignMessage({
      ...params,
      addressEncoding: await this.vault.getAddressEncoding(),
    });
  }
}
