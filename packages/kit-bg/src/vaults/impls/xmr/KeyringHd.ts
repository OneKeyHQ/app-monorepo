import { parseXmrTransaction } from '@onekeyhq/core/src/chains/xmr/transactionReview';
import { parseXmrViewingKeyPair } from '@onekeyhq/core/src/chains/xmr/viewingKeys';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { KeyringHdBase } from '../../base/KeyringHdBase';
import { saveLocalWalletViewingKey } from '../../localWallet/viewingKeyStore';

import type Vault from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

/**
 * Derivation is a compatibility contract with OneKey V4 (`spend = sc_reduce32(bip32_key)`,
 * `view = keccak256(spend)`, in `keys::derive_from_bip32_key`); changing it strands V4 users importing the same mnemonic.
 */
export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.xmr.hd;

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    // coreApi derives the primary address plus `spendPub:viewPriv`; the view
    // key goes to the viewing key store, never onto the account record.
    // Scan state is created lazily when the user opts in.
    const accounts = await this.basePrepareAccountsHd(params);
    for (const account of accounts) {
      const { spendPublicKeyHex } = parseXmrViewingKeyPair(account.pub ?? '');
      // eslint-disable-next-line no-await-in-loop
      await saveLocalWalletViewingKey({
        backgroundApi: this.backgroundApi,
        networkId: this.vault.networkId,
        accountId: account.id,
        value: account.pub ?? '',
      });
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
    const vault = this.vault as Vault;
    const encodedTx = parseXmrTransaction(params.unsignedTx.encodedTx);
    await vault.xmrClaimTransactionReview(encodedTx);
    try {
      await vault.xmrMarkReservationSigned(
        encodedTx.reservationId,
        encodedTx.inputCount,
      );
      return await this.baseSignTransaction({
        ...params,
        unsignedTx: { ...params.unsignedTx, encodedTx },
      });
    } catch (error) {
      // Nothing was broadcast, so holding the reservation would make a balance not spendable with no visible cause.
      await vault.xmrReleaseReservation(encodedTx.reservationId);
      throw error;
    }
  }

  /** See CoreChainSoftware.getSpendPrivateKeyHex. */
  async xmrGetSpendPrivateKeyHex({
    password,
  }: {
    password: string;
  }): Promise<string> {
    const [account, credentials, networkInfo] = await Promise.all([
      this.vault.getAccount(),
      this.baseGetCredentialsInfo({ password }),
      this.getCoreApiNetworkInfo(),
    ]);
    return this.coreApi.getSpendPrivateKeyHex({
      networkInfo,
      account,
      password,
      credentials,
    });
  }

  /** See CoreChainSoftware.getViewingKeyPair. */
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
