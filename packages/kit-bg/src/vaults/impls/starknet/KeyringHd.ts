import type { IStarknetSignature } from '@onekeyhq/core/src/chains/starknet/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IDeriveStrk20ViewingKeyParams,
  IDeriveStrk20ViewingKeyResult,
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignStrk20ProofInvocationParams,
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

  // STRK20 only; no rung on KeyringBase, so serviceStarknetPrivacy narrows to
  // IKeyringStrk20ViewingKeyDeriver to reach it.
  async deriveStrk20ViewingKey(
    params: IDeriveStrk20ViewingKeyParams,
  ): Promise<IDeriveStrk20ViewingKeyResult> {
    return this.baseDeriveStrk20ViewingKey(params);
  }

  // Reached through IKeyringStrk20ProofInvocationSigner, same as above.
  async signStrk20ProofInvocation(
    params: ISignStrk20ProofInvocationParams,
  ): Promise<IStarknetSignature> {
    return this.baseSignStrk20ProofInvocation(params);
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
