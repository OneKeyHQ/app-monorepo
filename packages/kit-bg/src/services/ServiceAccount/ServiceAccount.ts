import type { IBip39RevealableSeedEncryptHex } from '@onekeyhq/core/src/secret';
import {
  decodeSensitiveText,
  decryptRevealableSeed,
  encryptImportedCredential,
  ensureSensitiveTextEncoded,
  mnemonicFromEntropy,
  revealEntropyToMnemonic,
  revealableSeedFromMnemonic,
  validateMnemonic,
} from '@onekeyhq/core/src/secret';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
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
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { randomAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import {
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../../dbs/local/consts';
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
  IDBDevice,
  IDBIndexedAccount,
  IDBRemoveWalletParams,
  IDBSetAccountNameParams,
  IDBSetWalletNameAndAvatarParams,
  IDBWallet,
  IDBWalletIdSingleton,
} from '../../dbs/local/types';
import type {
  IAccountSelectorAccountsListSectionData,
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
} from '../../dbs/simple/entity/SimpleDbEntityAccountSelector';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
  IPrepareHardwareAccountsParams,
  IPrepareHdAccountsParams,
  IPrepareImportedAccountsParams,
  IPrepareWatchingAccountsParams,
} from '../../vaults/types';

@backgroundClass()
class ServiceAccount extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async validateMnemonic(mnemonic: string): Promise<string> {
    ensureSensitiveTextEncoded(mnemonic);
    const realMnemonic = decodeSensitiveText({
      encodedText: mnemonic,
    });
    const realMnemonicFixed = realMnemonic.trim().replace(/\s+/g, ' ');
    if (!validateMnemonic(realMnemonicFixed)) {
      throw new InvalidMnemonic();
    }
    return Promise.resolve(realMnemonicFixed);
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
  async isWalletHasIndexedAccounts({ walletId }: { walletId: string }) {
    const { accounts: indexedAccounts } = await this.getIndexedAccounts({
      walletId,
    });
    // TODO use getRecordsCount instead
    if (indexedAccounts.length > 0) {
      return true;
    }
    return false;
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
  async getDeriveInfoItemsOfNetwork({
    networkId,
  }: {
    networkId: string | undefined;
  }): Promise<IAccountDeriveInfoItems[]> {
    if (!networkId) {
      return [];
    }
    const map = await this.getDeriveInfoMapOfNetwork({
      networkId,
    });
    return Object.entries(map).map(([k, v]) => ({
      value: k,
      item: v,
      label:
        (v.labelKey
          ? appLocale.intl.formatMessage({ id: v.labelKey })
          : v.label) || k,
    }));
  }

  @backgroundMethod()
  async getIndexedAccount({ id }: { id: string }) {
    return localDb.getIndexedAccount({ id });
  }

  @backgroundMethod()
  @toastIfError()
  async addHDOrHWAccounts({
    walletId,
    networkId,
    indexes,
    indexedAccountId,
    deriveType,
  }: {
    walletId: string | undefined;
    networkId: string | undefined;
    indexes?: Array<number>; // multiple add by indexes
    indexedAccountId: string | undefined; // single add by indexedAccountId
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
    if (!deriveType) {
      throw new Error('deriveType is required');
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

    // addHDOrHWAccounts
    return this.backgroundApi.serviceHardware.withHardwareProcessing(
      async () => {
        // TODO move to vault
        // TODO show hardware UI
        const accounts = await vault.keyring.prepareAccounts(prepareParams);
        await localDb.addAccountsToWallet({
          walletId,
          accounts,
        });
        appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
        return {
          networkId,
          walletId,
          accounts,
          indexes,
          deriveType,
        };
      },
      {
        deviceParams,
      },
    );
  }

  @backgroundMethod()
  async addImportedAccount({
    input,
    networkId,
  }: {
    input: string;
    networkId: string;
  }) {
    ensureSensitiveTextEncoded(input);
    const walletId = WALLET_TYPE_IMPORTED;

    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
      });

    const vault = await vaultFactory.getWalletOnlyVault({
      networkId,
      walletId,
    });
    const { privateKey } = await vault.getPrivateKeyFromImported({ input });
    ensureSensitiveTextEncoded(privateKey);
    const nextAccountId = await localDb.getWalletNextAccountId({
      walletId,
    });
    const privateKeyDecoded = decodeSensitiveText({ encodedText: privateKey });
    const credentialEncrypt = encryptImportedCredential({
      credential: {
        privateKey: privateKeyDecoded,
      },
      password,
    });
    const params: IPrepareImportedAccountsParams = {
      password,
      name: `Account #${nextAccountId}`, // TODO i18n
      importedCredential: credentialEncrypt,
      createAtNetwork: networkId,
    };
    const accounts = await vault.keyring.prepareAccounts(params);
    await localDb.addAccountsToWallet({
      walletId,
      accounts,
      importedCredential: credentialEncrypt,
    });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    return {
      networkId,
      walletId,
      accounts,
    };
  }

  @backgroundMethod()
  async addWatchingAccount({
    input,
    networkId,
  }: {
    input: string;
    networkId: string;
  }) {
    const walletId = WALLET_TYPE_WATCHING;
    const vault = await vaultFactory.getWalletOnlyVault({
      networkId,
      walletId,
    });
    let address = '';
    let xpub = '';
    const addressValidationResult = await vault.validateAddress(input);
    if (addressValidationResult.isValid) {
      address = addressValidationResult.normalizedAddress;
    } else {
      const xpubValidationResult = await vault.validateXpub(input);
      if (xpubValidationResult.isValid) {
        xpub = input;
      }
    }
    if (!address && !xpub) {
      throw new Error('input not valid');
    }
    const nextAccountId = await localDb.getWalletNextAccountId({
      walletId,
    });
    const params: IPrepareWatchingAccountsParams = {
      address,
      xpub,
      name: `Account #${nextAccountId}`, // TODO i18n
      networks: [networkId],
      createAtNetwork: networkId,
    };
    // addWatchingAccount
    const accounts = await vault.keyring.prepareAccounts(params);
    await localDb.addAccountsToWallet({
      walletId,
      accounts,
    });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    return {
      networkId,
      walletId,
      accounts,
    };
  }

  @backgroundMethod()
  async getIndexedAccounts({ walletId }: { walletId?: string } = {}) {
    return localDb.getIndexedAccounts({ walletId });
  }

  @backgroundMethod()
  async getAccountsOfWalletLegacy({
    walletId,
  }: {
    walletId: string;
  }): Promise<{ accounts: Array<IDBIndexedAccount> }> {
    // TODO performance for realm and indexeddb, use wallet.indexedAccounts?
    if (
      accountUtils.isHdWallet({ walletId }) ||
      accountUtils.isHwWallet({ walletId })
    ) {
      return this.getIndexedAccounts({ walletId });
    }
    return {
      accounts: [],
    };
  }

  async getSingletonAccountsOfWallet({
    walletId,
    activeNetworkId,
  }: {
    walletId: IDBWalletIdSingleton;
    activeNetworkId?: string;
  }) {
    let { accounts } = await localDb.getSingletonAccountsOfWallet({
      walletId,
    });
    accounts = await Promise.all(
      accounts.map(async (account) => {
        const { id: accountId } = account;
        if (activeNetworkId) {
          const accountNetworkId = accountUtils.getAccountCompatibleNetwork({
            account,
            networkId: activeNetworkId,
          });

          if (accountNetworkId) {
            try {
              return await this.getAccount({
                accountId,
                networkId: accountNetworkId,
              });
            } catch (e) {
              return account;
            }
          }
        }
        return account;
      }),
    );
    return { accounts };
  }

  @backgroundMethod()
  async getAccountSelectorAccountsListSectionData({
    focusedWallet,
    othersNetworkId,
    linkedNetworkId,
    deriveType,
  }: {
    focusedWallet: IAccountSelectorFocusedWallet;
    othersNetworkId?: string;
    linkedNetworkId?: string;
    deriveType: IAccountDeriveTypes;
  }): Promise<Array<IAccountSelectorAccountsListSectionData>> {
    if (!focusedWallet) {
      return [];
    }
    if (focusedWallet === '$$others') {
      const { accounts: accountsWatching } =
        await this.getSingletonAccountsOfWallet({
          walletId: WALLET_TYPE_WATCHING,
          activeNetworkId: othersNetworkId,
        });
      const { accounts: accountsImported } =
        await this.getSingletonAccountsOfWallet({
          walletId: WALLET_TYPE_IMPORTED,
          activeNetworkId: othersNetworkId,
        });

      return [
        {
          title: 'Watching account',
          data: accountsWatching,
          walletId: WALLET_TYPE_WATCHING,
        },
        {
          title: 'Imported account',
          data: accountsImported,
          walletId: WALLET_TYPE_IMPORTED,
        },
      ];
    }
    const walletId = focusedWallet;
    const { accounts } = await this.getAccountsOfWalletLegacy({
      walletId,
    });
    if (linkedNetworkId) {
      await Promise.all(
        accounts.map(async (indexedAccount: IDBIndexedAccount) => {
          try {
            const realAccount = await this.getAccountOfWallet({
              accountId: undefined,
              indexedAccountId: indexedAccount.id,
              deriveType,
              networkId: linkedNetworkId,
            });
            indexedAccount.associateAccount = realAccount;
          } catch (e) {
            //
          }
        }),
      );
    }

    return [
      {
        title: '',
        data: accounts,
        walletId,
      },
    ];
  }

  @backgroundMethod()
  async getDBAccount({ accountId }: { accountId: string }) {
    const account = await localDb.getAccount({ accountId });
    return account;
  }

  @backgroundMethod()
  async getAccount({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<INetworkAccount> {
    checkIsDefined(accountId);
    checkIsDefined(networkId);
    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    return vault.getAccount();
  }

  @backgroundMethod()
  async getAccountsByIndexedAccount({
    indexedAccountIds,
    networkId,
    deriveType,
  }: {
    indexedAccountIds: string[];
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }): Promise<{
    accounts: INetworkAccount[];
  }> {
    const settings = await getVaultSettings({ networkId });
    const deriveInfo = await getVaultSettingsAccountDeriveInfo({
      networkId,
      deriveType,
    });
    const { idSuffix, template } = deriveInfo;

    const accounts = await Promise.all(
      indexedAccountIds.map(async (indexedAccountId) => {
        const { index, walletId } = accountUtils.parseIndexedAccountId({
          indexedAccountId,
        });

        const realAccountId = accountUtils.buildHDAccountId({
          walletId,
          index,
          template, // from networkId
          idSuffix,
          isUtxo: settings.isUtxo,
        });
        return this.getAccount({ accountId: realAccountId, networkId });
      }),
    );
    return {
      accounts,
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
  }): Promise<INetworkAccount> {
    if (accountId) {
      return this.getAccount({
        accountId,
        networkId,
      });
    }
    if (indexedAccountId) {
      if (!deriveType) {
        throw new Error('deriveType is required');
      }
      const { accounts } = await this.getAccountsByIndexedAccount({
        networkId,
        deriveType,
        indexedAccountIds: [indexedAccountId],
      });
      if (accounts[0]) {
        return accounts[0];
      }
      throw new Error(`indexedAccounts not found: ${indexedAccountId}`);
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
    const result = await localDb.addHDNextIndexedAccount({ walletId });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    return result;
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
  @toastIfError()
  async createHWHiddenWallet({ walletId }: { walletId: string }) {
    const dbDevice = await this.getWalletDevice({ walletId });
    const { connectId } = dbDevice;

    // createHWHiddenWallet
    return this.backgroundApi.serviceHardware.withHardwareProcessing(
      async () => {
        const passphraseState =
          await this.backgroundApi.serviceHardware.getPassphraseState({
            connectId,
            forceInputPassphrase: true,
          });

        if (!passphraseState) {
          throw new DeviceNotOpenedPassphrase({
            payload: {
              connectId,
              deviceId: dbDevice.deviceId ?? undefined,
            },
          });
        }

        // TODO save remember states

        return this.createHWWalletBase({
          device: deviceUtils.dbDeviceToSearchDevice(dbDevice),
          features: dbDevice.featuresInfo || ({} as any),
          passphraseState,
        });
      },
      {
        deviceParams: {
          dbDevice,
        },
      },
    );
  }

  @backgroundMethod()
  @toastIfError()
  async createHWWallet(params: IDBCreateHWWalletParamsBase) {
    // createHWWallet
    return this.backgroundApi.serviceHardware.withHardwareProcessing(
      () => this.createHWWalletBase(params),
      {
        deviceParams: {
          dbDevice: params.device as IDBDevice,
        },
        skipCancel: true,
      },
    );
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
    ensureSensitiveTextEncoded(mnemonic); // TODO also add check for imported account

    const realMnemonic = await this.validateMnemonic(mnemonic);

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

  @backgroundMethod()
  async getIsUTXOAccount({ networkId }: { networkId: string }) {
    const settings = await getVaultSettings({ networkId });
    return settings.isUtxo;
  }

  @backgroundMethod()
  async buildActiveAccountInfoFromSelectedAccount({
    selectedAccount,
    nonce,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
    nonce?: number;
  }): Promise<{
    selectedAccount: IAccountSelectorSelectedAccount;
    activeAccount: IAccountSelectorActiveAccountInfo;
    nonce?: number;
  }> {
    const {
      othersWalletAccountId,
      indexedAccountId,
      deriveType,
      networkId,
      walletId,
    } = selectedAccount;

    let account: IDBAccount | undefined;
    let wallet: IDBWallet | undefined;
    let network: IServerNetwork | undefined;
    let indexedAccount: IDBIndexedAccount | undefined;
    let deriveInfo: IAccountDeriveInfo | undefined;

    if (walletId) {
      try {
        wallet = await this.getWallet({ walletId });
      } catch (e) {
        console.error(e);
      }

      if (indexedAccountId) {
        try {
          indexedAccount = await this.getIndexedAccount({
            id: indexedAccountId,
          });
        } catch (e) {
          console.error(e);
        }
      }
    }

    if (networkId) {
      try {
        network = await this.backgroundApi.serviceNetwork.getNetwork({
          networkId,
        });
      } catch (e) {
        console.error(e);
      }

      if (indexedAccountId || othersWalletAccountId) {
        try {
          const r = await this.getAccountOfWallet({
            indexedAccountId,
            accountId: othersWalletAccountId,
            deriveType,
            networkId,
          });
          account = r;
        } catch (e) {
          console.error(e);
        }
      }

      if (deriveType) {
        try {
          deriveInfo = await getVaultSettingsAccountDeriveInfo({
            networkId,
            deriveType,
          });
        } catch (error) {
          //
        }
      }
    }
    const isOthersWallet = Boolean(account && !indexedAccountId);
    const activeAccount: IAccountSelectorActiveAccountInfo = {
      account,
      indexedAccount,
      accountName: account?.name || indexedAccount?.name || '',
      wallet,
      network,
      deriveType,
      deriveInfo,
      deriveInfoItems: await this.getDeriveInfoItemsOfNetwork({ networkId }),
      ready: true,
      isOthersWallet,
    };
    const selectedAccountFixed: IAccountSelectorSelectedAccount = {
      othersWalletAccountId: isOthersWallet
        ? activeAccount?.account?.id
        : undefined,
      indexedAccountId: activeAccount.indexedAccount?.id,
      deriveType: activeAccount.deriveType,
      networkId: activeAccount.network?.id,
      walletId: activeAccount.wallet?.id,
      focusedWallet: isOthersWallet ? '$$others' : activeAccount.wallet?.id,
    };
    return { activeAccount, selectedAccount: selectedAccountFixed, nonce };
  }
}

export default ServiceAccount;
