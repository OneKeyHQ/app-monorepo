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
import { DeviceNotOpenedPassphrase } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { randomAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDbInstance';
import { vaultFactory } from '../../vaults/factory';
import {
  getVaultSettings,
  getVaultSettingsAccountDeriveInfo,
} from '../../vaults/settings';
import ServiceBase from '../ServiceBase';

import type {
  IDBAccount,
  IDBCreateHWWalletParams,
  IDBCreateHWWalletParamsBase,
  IDBIndexedAccount,
  IDBRemoveWalletParams,
  IDBSetAccountNameParams,
  IDBSetWalletNameAndAvatarParams,
} from '../../dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  IPrepareHardwareAccountsParams,
  IPrepareHdAccountsParams,
} from '../../vaults/types';

@backgroundClass()
class ServiceAccount extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
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
  async getWalletDevice({ walletId }: { walletId: string }) {
    return localDb.getWalletDevice({ walletId });
  }

  @backgroundMethod()
  async getWallets() {
    return localDb.getWallets();
  }

  @backgroundMethod()
  async getHDAndHWWallets() {
    const r = await this.getWallets();
    const wallets = r.wallets.filter(
      (wallet) =>
        accountUtils.isHdWallet({ walletId: wallet.id }) ||
        accountUtils.isHwWallet({
          walletId: wallet.id,
        }),
    );
    return {
      wallets,
    };
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
  }): Promise<IAccountDeriveInfo> {
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
  async addHDOrHWAccounts({
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
    if (!walletId) {
      throw new Error('walletId is required');
    }
    if (!networkId) {
      throw new Error('networkId is required');
    }
    const { isHardware, password, deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
      });

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
    let prepareParams:
      | IPrepareHdAccountsParams
      | IPrepareHardwareAccountsParams;

    if (isHardware) {
      const hwParams: IPrepareHardwareAccountsParams = {
        deviceParams: {
          ...checkIsDefined(deviceParams),
          confirmOnDevice: false,
        },

        indexes: usedIndexes,
        deriveInfo,
      };
      prepareParams = hwParams;
    } else {
      const hdParams: IPrepareHdAccountsParams = {
        // type: 'ADD_ACCOUNTS', // for hardware only?
        password,

        indexes: usedIndexes,
        deriveInfo,
        // purpose: usedPurpose,
        // deriveInfo, // TODO pass deriveInfo to generate id and name
        // skipCheckAccountExist, // BTC required
      };
      prepareParams = hdParams;
    }
    // TODO move to vault
    const accounts = await vault.keyring.prepareAccounts(prepareParams);
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
    if (
      accountUtils.isHdWallet({ walletId }) ||
      accountUtils.isHwWallet({ walletId })
    ) {
      return localDb.getIndexedAccountsOfWallet({ walletId });
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
      const settings = await getVaultSettings({ networkId });
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
        isUtxo: settings.isUtxo,
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
    return localDb.addIndexedAccount({ walletId, indexes, skipIfExists });
  }

  @backgroundMethod()
  async addHDNextIndexedAccount({ walletId }: { walletId: string }) {
    return localDb.addHDNextIndexedAccount({ walletId });
  }

  @backgroundMethod()
  async setAccountName(params: IDBSetAccountNameParams) {
    const r = await localDb.setAccountName(params);
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    return r;
  }

  @backgroundMethod()
  async getWalletDeviceParams({
    walletId,
  }: {
    walletId: string;
  }): Promise<IDeviceSharedCallParams> {
    const wallet = await this.getWallet({ walletId });
    const dbDevice = await this.getWalletDevice({ walletId });
    return {
      confirmOnDevice: true,
      dbDevice,
      deviceCommonParams: {
        passphraseState: wallet?.passphraseState,
        useEmptyPassphrase: !wallet.passphraseState,
      },
    };
  }

  @backgroundMethod()
  async createHWHiddenWallet({ walletId }: { walletId: string }) {
    const device = await this.getWalletDevice({ walletId });
    const { connectId } = device;

    const passphraseState =
      await this.backgroundApi.serviceHardware.getPassphraseState({
        connectId,
        forceInputPassphrase: true,
      });

    if (!passphraseState) {
      throw new DeviceNotOpenedPassphrase({
        connectId,
        deviceId: device.deviceId ?? undefined,
      });
    }
    return this.createHWWalletBase({
      device: deviceUtils.dbDeviceToSearchDevice(device),
      features: device.featuresInfo || ({} as any),
      passphraseState,
    });
  }

  @backgroundMethod()
  async createHWWallet(params: IDBCreateHWWalletParamsBase) {
    return this.createHWWalletBase(params);
  }

  @backgroundMethod()
  async createHWWalletBase(params: IDBCreateHWWalletParams) {
    const { passphraseState } = params;
    const result = await localDb.createHWWallet({
      ...params,
      passphraseState: passphraseState || '',
    });
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  async createHDWallet({ mnemonic }: { mnemonic: string }) {
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify();
    ensureSensitiveTextEncoded(password);

    // eslint-disable-next-line no-param-reassign
    mnemonic = await servicePassword.encodeSensitiveText({
      text: mnemonic,
    });
    ensureSensitiveTextEncoded(mnemonic);

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

    const result = await localDb.createHDWallet({
      password,
      rs,
      backuped: false,
      avatar: randomAvatar(),
    });

    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  async setWalletNameAndAvatar(params: IDBSetWalletNameAndAvatarParams) {
    const result = await localDb.setWalletNameAndAvatar(params);
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  async removeWallet({
    walletId,
  }: Omit<IDBRemoveWalletParams, 'password' | 'isHardware'>) {
    if (!walletId) {
      throw new Error('walletId is required');
    }
    const { isHardware, password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
      });
    const result = await localDb.removeWallet({
      walletId,
      password,
      isHardware,
    });
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }
}

export default ServiceAccount;
