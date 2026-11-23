import type { IStarknetSignature } from '@onekeyhq/core/src/chains/starknet/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import { KeyringHdBase } from '../../base/KeyringHdBase';

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
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.starknet.hd;

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
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareAccountsHd(params);
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this.baseSignTransaction({
      ...params,
      addressEncoding: await this.vault.getAddressEncoding(),
    });
  }

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    return this.baseSignMessage({
      ...params,
      addressEncoding: await this.vault.getAddressEncoding(),
    });
  }

  override async exportAccountSecretKeys(
    params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    return this.baseExportAccountSecretKeys(params);
  }
}
