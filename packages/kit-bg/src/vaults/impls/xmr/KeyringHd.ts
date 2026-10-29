import { parseXmrTransaction } from '@onekeyhq/core/src/chains/xmr/transactionReview';
import { parseXmrViewingKeyPair } from '@onekeyhq/core/src/chains/xmr/viewingKeys';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

/** Derivation must match OneKey V4 (`spend = sc_reduce32(bip32_key)`, `view = keccak256(spend)`); changing it strands V4 users importing the same mnemonic. */
export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.xmr.hd;

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    // The view key is dropped here and stored only when scanning is enabled,
    // so a never-enabled account leaves nothing behind.
    const accounts = await this.basePrepareAccountsHd(params);
    for (const account of accounts) {
      const { spendPublicKeyHex } = parseXmrViewingKeyPair(account.pub ?? '');
      account.pub = spendPublicKeyHex;
    }
    return accounts;
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const encodedTx = parseXmrTransaction(params.unsignedTx.encodedTx);
    return this.baseSignTransaction({
      ...params,
      unsignedTx: { ...params.unsignedTx, encodedTx },
    });
  }

  async xmrGetKeyImageBip32PrivateKeyHex({
    password,
  }: {
    password: string;
  }): Promise<string> {
    const [account, credentials, networkInfo] = await Promise.all([
      this.vault.getAccount(),
      this.baseGetCredentialsInfo({ password }),
      this.getCoreApiNetworkInfo(),
    ]);
    return this.coreApi.getKeyImageBip32PrivateKeyHex({
      networkInfo,
      account,
      password,
      credentials,
    });
  }

  async xmrDeriveViewingKey({
    password,
  }: {
    password: string;
  }): Promise<string> {
    const [account, credentials, networkInfo] = await Promise.all([
      this.vault.getAccount(),
      this.baseGetCredentialsInfo({ password }),
      this.getCoreApiNetworkInfo(),
    ]);
    return this.coreApi.getViewingKeyPair({
      networkInfo,
      account,
      password,
      credentials,
    });
  }

  override async signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    // Monero has no signed-message format the ecosystem agrees on.
    throw new NotImplemented();
  }
}
