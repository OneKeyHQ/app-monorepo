import {
  deriveSparkChildMnemonicFromHdCredential,
  getSparkAccountFromChildMnemonic,
  getSparkNetworkFromImpl,
} from '@onekeyhq/core/src/chains/spark/utils';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import localDb from '../../../dbs/local/localDb';
import { KeyringHdBase } from '../../base/KeyringHdBase';

import type { IDBAccount, IDBSimpleAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
} from '../../types';

/**
 * Spark payments are signed inside the Breez SDK, which ServiceLightningSpark
 * connects with the wallet's BIP-85 child mnemonic. This keyring only creates
 * the account record; it never exposes private keys.
 */
export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.lightningspark.hd;

  override async getPrivateKeys(): Promise<IGetPrivateKeysResult> {
    throw new NotImplemented();
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    if (accountUtils.isBotWallet({ walletId: this.walletId })) {
      throw new OneKeyLocalError('Bot wallets do not support Spark');
    }
    if (params.indexes.some((index) => index !== 0)) {
      throw new OneKeyLocalError('Spark supports only one account per wallet');
    }
    return this.basePrepareAccountsHd(params);
  }

  /**
   * Derives the wallet's Lightning child mnemonic for connecting the Breez
   * SDK, and refuses when it no longer yields the identity stored on this
   * account. The caller must not persist, log or return the mnemonic.
   */
  async getChildMnemonicForConnect({
    password,
  }: {
    password: string;
  }): Promise<string> {
    const account = (await localDb.getAccount({
      accountId: this.accountId,
    })) as IDBSimpleAccount;
    const network = getSparkNetworkFromImpl(
      networkUtils.getNetworkImpl({ networkId: this.networkId }),
    );
    const credentials = await this.baseGetCredentialsInfo({ password });
    const childMnemonic = await deriveSparkChildMnemonicFromHdCredential({
      hdCredential: checkIsDefined(credentials.hd),
      password,
      ...getPbkdf2KdfParamsForNonDbTx(),
    });
    const { publicKey } = getSparkAccountFromChildMnemonic({
      childMnemonic,
      network,
    });
    if (!account.pub || publicKey !== account.pub) {
      throw new OneKeyLocalError('Spark identity does not match this account');
    }
    return childMnemonic;
  }

  override async signTransaction(): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  override async signMessage(): Promise<string[]> {
    throw new NotImplemented();
  }
}
