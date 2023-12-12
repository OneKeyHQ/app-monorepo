import type { IBip39RevealableSeedEncryptHex } from '@onekeyhq/core/src/secret';
import {
  decodeSensitiveText,
  decryptRevealableSeed,
  ensureSensitiveTextEncoded,
  mnemonicFromEntropy,
  revealEntropyToMnemonic,
  revealableSeedFromMnemonic,
  validateMnemonic,
} from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  InvalidMnemonic,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { randomAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';

import localDb from '../dbs/local/localDbInstance';
import { vaultFactory } from '../vaults/factory';
import {
  getVaultSettings,
  getVaultSettingsAccountDeriveInfo,
} from '../vaults/settings';

import ServiceBase from './ServiceBase';

import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '../dbs/local/types';
import type { IAccountDeriveTypes } from '../vaults/types';

@backgroundClass()
class ServiceAccount extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async validateMnemonic(mnemonic: string): Promise<string> {
    const mnemonicFixed = mnemonic.trim().replace(/\s+/g, ' ');
    if (!validateMnemonic(mnemonicFixed)) {
      throw new InvalidMnemonic();
    }
    return Promise.resolve(mnemonicFixed);
  }

  @backgroundMethod()
  public async sampleMethod() {
    console.log('sampleMethod');
    return 'sampleMethod';
  }

  @backgroundMethod()
  async getWallet({ walletId }: { walletId: string }) {
    return localDb.getWallet({ walletId });
  }

  @backgroundMethod()
  async getWallets() {
    return localDb.getWallets();
  }

  @backgroundMethod()
  async getCredentialDecrypt({
    password,
    credentialId,
  }: {
    credentialId: string;
    password: string;
  }) {
    ensureSensitiveTextEncoded(password);
    const dbCredential = await localDb.getCredential(credentialId);
    const rs = decryptRevealableSeed({
      rs: dbCredential.credential,
      password,
    });
    const mnemonic = revealEntropyToMnemonic(rs.entropyWithLangPrefixed);
    return {
      rs,
      dbCredential,
      mnemonic,
    };
  }

  @backgroundMethod()
  async getDeriveInfo({
    networkId,
    deriveType,
  }: {
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }) {
    const deriveInfo = await getVaultSettingsAccountDeriveInfo({
      networkId,
      deriveType,
    });
    return deriveInfo;
  }

  @backgroundMethod()
  async getDeriveInfoMapOfNetwork({ networkId }: { networkId: string }) {
    const settings = await getVaultSettings({ networkId });
    // TODO remove ETC config
    return settings.accountDeriveInfo;
  }

  @backgroundMethod()
  async getIndexedAccount({ id }: { id: string }) {
    return localDb.getIndexedAccount({ id });
  }

  @backgroundMethod()
  async addHDAccounts({
    walletId,
    networkId,
    indexes,
    indexedAccountId,
    deriveType,
  }: {
    walletId: string | undefined;
    networkId: string | undefined;
    indexes?: Array<number>;
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes;
    // names?: Array<string>;
    // purpose?: number;
    // skipRepeat?: boolean;
    // callback?: (_account: Account) => Promise<boolean>;
    // isAddInitFirstAccountOnly?: boolean;
    // template?: string;
    // skipCheckAccountExist?: boolean;
  }) {
    const {
      data: { password },
    } = await this.backgroundApi.servicePassword.promptPasswordVerify();
    ensureSensitiveTextEncoded(password);
    if (!walletId) {
      throw new Error('walletId is required');
    }
    if (!networkId) {
      throw new Error('networkId is required');
    }
    // canAutoCreateNextAccount
    // skip exists account added
    // postAccountAdded
    // active first account
    const usedIndexes = indexes || [];
    if (indexedAccountId) {
      const indexedAccount = await this.getIndexedAccount({
        id: indexedAccountId,
      });
      usedIndexes.unshift(indexedAccount.index);
    }
    if (usedIndexes.some((index) => index >= 2 ** 31)) {
      throw new OneKeyInternalError(
        'addHDAccounts ERROR: Invalid child index, should be less than 2^31.',
      );
    }
    if (usedIndexes.length <= 0) {
      throw new OneKeyInternalError({
        message: 'addHDAccounts ERROR: indexed is empty',
      });
    }

    // const usedPurpose = await getVaultSettingsDefaultPurpose({ networkId });
    const deriveInfo = await this.getDeriveInfo({
      networkId,
      deriveType,
    });

    const vault = await vaultFactory.getWalletOnlyVault({
      networkId,
      walletId,
    });
    const accounts = await vault.keyring.prepareAccounts({
      // type: 'ADD_ACCOUNTS', // for hardware only?
      password,
      indexes: usedIndexes,
      deriveInfo,
      // purpose: usedPurpose,
      // deriveInfo, // TODO pass deriveInfo to generate id and name
      // skipCheckAccountExist, // BTC required
    });
    await localDb.addAccountsToWallet({
      walletId,
      accounts,
    });
    return {
      accounts,
      indexes,
      deriveType,
      walletId,
      networkId,
    };
  }

  @backgroundMethod()
  async getAccountsOfWallet({
    walletId,
  }: {
    walletId: string;
  }): Promise<{ accounts: Array<IDBIndexedAccount> }> {
    // TODO performance for realm and indexeddb, use wallet.indexedAccounts?
    if (accountUtils.isHdWallet({ walletId })) {
      return localDb.getHDIndexedAccountsOfWallet({ walletId });
    }
    return {
      accounts: [],
    };
  }

  @backgroundMethod()
  async getAccountOfWallet({
    accountId,
    indexedAccountId,
    deriveType,
    networkId,
  }: {
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes;
    networkId: string;
  }): Promise<IDBAccount> {
    if (accountId) {
      return localDb.getAccount({ accountId });
    }
    if (indexedAccountId) {
      const deriveInfo = await this.getDeriveInfo({
        networkId,
        deriveType,
      });
      const indexedAccount = await this.getIndexedAccount({
        id: indexedAccountId,
      });
      const { index, walletId } = indexedAccount;
      const { idSuffix, template } = deriveInfo;
      const realAccountId = accountUtils.buildHDAccountId({
        walletId,
        index,
        template,
        idSuffix,
      });
      return localDb.getAccount({ accountId: realAccountId });
    }
    throw new OneKeyInternalError({
      message: 'accountId or indexedAccountId missing',
    });
  }

  @backgroundMethod()
  async addHDIndexedAccount({
    walletId,
    indexes,
    skipIfExists,
  }: {
    walletId: string;
    indexes: number[];
    skipIfExists: boolean;
  }) {
    return localDb.addHDIndexedAccount({ walletId, indexes, skipIfExists });
  }

  @backgroundMethod()
  async addHDNextIndexedAccount({ walletId }: { walletId: string }) {
    return localDb.addHDNextIndexedAccount({ walletId });
  }

  @backgroundMethod()
  async createHDWallet({
    mnemonic,
    password,
  }: {
    mnemonic: string;
    password: string;
  }) {
    ensureSensitiveTextEncoded(mnemonic);
    ensureSensitiveTextEncoded(password);
    await this.backgroundApi.servicePassword.verifyPassword(password);

    let realMnemonic = decodeSensitiveText({
      encodedText: mnemonic,
    });
    realMnemonic = await this.validateMnemonic(realMnemonic);

    let rs: IBip39RevealableSeedEncryptHex | undefined;
    try {
      rs = revealableSeedFromMnemonic(realMnemonic, password);
    } catch {
      throw new InvalidMnemonic();
    }
    if (realMnemonic !== mnemonicFromEntropy(rs, password)) {
      throw new InvalidMnemonic();
    }

    let dbWallet: IDBWallet = await localDb.createHDWallet({
      password,
      rs,
      backuped: false,
      avatar: randomAvatar(),
    });

    dbWallet = await this.getWallet({ walletId: dbWallet.id });

    return dbWallet;
  }
}

export default ServiceAccount;
