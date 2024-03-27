import { isString } from 'lodash';

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
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
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
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { randomAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EWalletConnectNamespaceType,
  type IWalletConnectEventSessionEventParams,
  type IWalletConnectNamespaces,
  type IWalletConnectSession,
} from '@onekeyhq/shared/src/walletConnect/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { EDBAccountType } from '../../dbs/local/consts';
import localDb from '../../dbs/local/localDbInstance';
import { vaultFactory } from '../../vaults/factory';
import ServiceBase from '../ServiceBase';

import type {
  IDBAccount,
  IDBCreateHWWalletParams,
  IDBCreateHWWalletParamsBase,
  IDBDevice,
  IDBExternalAccount,
  IDBExternalAccountWalletConnectInfo,
  IDBGetWalletsParams,
  IDBIndexedAccount,
  IDBRemoveWalletParams,
  IDBSetAccountNameParams,
  IDBSetWalletNameAndAvatarParams,
  IDBWallet,
  IDBWalletId,
  IDBWalletIdSingleton,
} from '../../dbs/local/types';
import type {
  IAccountSelectorAccountsListSectionData,
  IAccountSelectorFocusedWallet,
} from '../../dbs/simple/entity/SimpleDbEntityAccountSelector';
import type {
  IAccountDeriveTypes,
  IPrepareHardwareAccountsParams,
  IPrepareHdAccountsParams,
  IPrepareImportedAccountsParams,
  IPrepareWatchingAccountsParams,
  IValidateGeneralInputParams,
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
    // TODO check by wordlists first
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
  async getWallet({ walletId }: { walletId: string }): Promise<IDBWallet> {
    return localDb.getWallet({ walletId });
  }

  @backgroundMethod()
  async getWalletSafe({
    walletId,
  }: {
    walletId: string;
  }): Promise<IDBWallet | undefined> {
    return localDb.getWalletSafe({ walletId });
  }

  @backgroundMethod()
  async getWalletDevice({ walletId }: { walletId: string }) {
    return localDb.getWalletDevice({ walletId });
  }

  @backgroundMethod()
  async getDevice({ deviceId }: { deviceId: string }) {
    return localDb.getDevice(deviceId);
  }

  @backgroundMethod()
  async getAllDevices() {
    return localDb.getAllDevices();
  }

  @backgroundMethod()
  async getWallets(options?: IDBGetWalletsParams) {
    return localDb.getWallets(options);
  }

  @backgroundMethod()
  async isWalletHasIndexedAccounts({ walletId }: { walletId: string }) {
    const { accounts: indexedAccounts } = await this.getIndexedAccountsOfWallet(
      {
        walletId,
      },
    );
    // TODO use getRecordsCount instead
    if (indexedAccounts.length > 0) {
      return true;
    }
    return false;
  }

  @backgroundMethod()
  async getHDAndHWWallets(options?: IDBGetWalletsParams) {
    const r = await this.getWallets(options);
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
  async getIndexedAccount({ id }: { id: string }) {
    return localDb.getIndexedAccount({ id });
  }

  @backgroundMethod()
  async addDefaultNetworkAccounts({
    walletId,
    indexedAccountId,
    skipDeviceCancel,
    hideCheckingDeviceLoading,
  }: {
    walletId: string | undefined;
    indexedAccountId: string | undefined;
    skipDeviceCancel?: boolean;
    hideCheckingDeviceLoading?: boolean;
  }) {
    if (!walletId) {
      return;
    }
    if (
      accountUtils.isHdWallet({
        walletId,
      }) ||
      accountUtils.isHwWallet({
        walletId,
      })
    ) {
      // TODO use consts
      const networks = ['evm--1', 'btc--0'];
      for (const id of networks) {
        await this.addHDOrHWAccounts({
          walletId,
          networkId: id,
          indexedAccountId,
          deriveType: 'default', // TODO get global deriveType
          skipDeviceCancel,
          hideCheckingDeviceLoading,
        });
      }
    }
  }

  @backgroundMethod()
  @toastIfError()
  async addHDOrHWAccounts({
    walletId,
    networkId,
    indexes,
    indexedAccountId,
    deriveType,
    skipDeviceCancel,
    hideCheckingDeviceLoading,
  }: {
    walletId: string | undefined;
    networkId: string | undefined;
    indexes?: Array<number>; // multiple add by indexes
    indexedAccountId: string | undefined; // single add by indexedAccountId
    deriveType: IAccountDeriveTypes;
    skipDeviceCancel?: boolean;
    hideCheckingDeviceLoading?: boolean;
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
    const deriveInfo =
      await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
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
          indexedAccountId,
          accounts,
          indexes,
          deriveType,
        };
      },
      {
        deviceParams,
        skipDeviceCancel,
        hideCheckingDeviceLoading,
      },
    );
  }

  @backgroundMethod()
  async validateGeneralInputOfImporting({
    input,
    networkId,
    ...others
  }: IValidateGeneralInputParams & {
    networkId: string;
  }): Promise<IGeneralInputValidation> {
    ensureSensitiveTextEncoded(input);
    const vault = await vaultFactory.getChainOnlyVault({
      networkId,
    });
    const result = await vault.validateGeneralInput({ input, ...others });
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async addImportedAccount({
    input,
    networkId,
    deriveType,
  }: {
    input: string;
    networkId: string;
    deriveType: IAccountDeriveTypes | undefined;
  }) {
    ensureSensitiveTextEncoded(input);
    const walletId = WALLET_TYPE_IMPORTED;

    const vault = await vaultFactory.getWalletOnlyVault({
      networkId,
      walletId,
    });
    // TODO privateKey should be HEX format
    const { privateKey } = await vault.getPrivateKeyFromImported({ input });
    ensureSensitiveTextEncoded(privateKey);
    const nextAccountId = await localDb.getWalletNextAccountId({
      walletId,
    });
    const privateKeyDecoded = decodeSensitiveText({ encodedText: privateKey });

    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
      });
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
    if (deriveType) {
      const deriveInfo =
        await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
          networkId,
          deriveType,
        });
      if (deriveInfo) params.deriveInfo = deriveInfo;
    }

    // addImportedAccount
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
  async removeExternalAccount({ wcSessionTopic }: { wcSessionTopic: string }) {
    const accountId = accountUtils.buildExternalAccountId({
      wcSessionTopic,
    });
    const account = await this.getDBAccount({ accountId });
    return this.removeAccount({ account });
  }

  @backgroundMethod()
  async updateWalletConnectExternalAccount({
    wcSessionTopic,
    wcNamespaces,
  }: {
    wcSessionTopic: string;
    wcNamespaces: IWalletConnectNamespaces;
  }) {
    const accountId = accountUtils.buildExternalAccountId({
      wcSessionTopic,
    });
    const { addressMap, networkIds } =
      await this.backgroundApi.serviceWalletConnect.parseWalletSessionNamespace(
        {
          namespaces: wcNamespaces,
        },
      );
    const r = await localDb.updateExternalAccount({
      accountId,
      addressMap,
      networkIds,
    });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    return r;
  }

  @backgroundMethod()
  async updateExternalAccountSelectedAddress({
    wcSessionTopic,
    wcSessionEvent,
  }: {
    wcSessionTopic: string;
    wcSessionEvent: IWalletConnectEventSessionEventParams;
  }) {
    // const params = {
    //   'id': 1710226674065096,
    //   'topic':
    //     '7452725652a616ebc2554ee049b026d56f537177c969fe5c07f92f75ee5e8bb6',
    //   'params': {
    //     'event': { 'name': 'chainChanged', 'data': 137 },
    //     'chainId': 'eip155:137',
    //   },
    // };

    // const params = {
    //   'id': 1710226817544891,
    //   'topic':
    //     '7452725652a616ebc2554ee049b026d56f537177c969fe5c07f92f75ee5e8bb6',
    //   'params': {
    //     'event': {
    //       'name': 'accountsChanged',
    //       'data': ['eip155:137:0x111'],
    //     },
    //     'chainId': 'eip155:137',
    //   },
    // };

    const accountId = accountUtils.buildExternalAccountId({
      wcSessionTopic,
    });
    const account = (await localDb.getAccount({
      accountId,
    })) as IDBExternalAccount;

    const eventName = wcSessionEvent?.params?.event?.name;
    const wcChain = wcSessionEvent?.params?.chainId;

    // handle EVM
    if (wcChain.startsWith(`${EWalletConnectNamespaceType.evm}:`)) {
      // handle accountsChanged
      if (eventName === 'accountsChanged') {
        const chainData =
          await this.backgroundApi.serviceWalletConnect.getChainData(wcChain);
        if (chainData) {
          const addresses =
            account.connectedAddresses[chainData.networkId]
              .split(',')
              .filter(Boolean) || [];
          const eventAddress = (
            wcSessionEvent?.params?.event?.data as string[] | undefined
          )?.[0];
          if (eventAddress && isString(eventAddress)) {
            const result =
              this.backgroundApi.serviceWalletConnect.parseWalletConnectFullAddress(
                {
                  wcAddress: eventAddress,
                },
              );
            const addressIndex = addresses.indexOf(result.address);
            if (addressIndex >= 0) {
              await localDb.updateExternalAccount({
                accountId,
                selectedMap: {
                  ...account.selectedAddress,
                  [chainData.networkId]: addressIndex,
                },
              });
              appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
            }
          }
        }
      }

      // handle chainChanged
      if (eventName === 'chainChanged') {
        // emit event bus, change chain from AccountSelectorEffects
      }
    }

    // handle non-EVM
    else {
      throw new Error('WalletConnectEventSessionEvent only support EVM now');
    }
  }

  @backgroundMethod()
  async addExternalAccount({
    wcSession,
  }: {
    wcSession: IWalletConnectSession;
  }) {
    const { addressMap, networkIds } =
      await this.backgroundApi.serviceWalletConnect.parseWalletSessionNamespace(
        {
          namespaces: wcSession.namespaces,
        },
      );
    const walletId = WALLET_TYPE_EXTERNAL;

    const nextAccountId = await localDb.getWalletNextAccountId({
      walletId,
    });
    const accountName = `Account #${nextAccountId}`;
    const wcPeerMeta = wcSession.peer.metadata;

    // **** walletconnect external account contains multiple networkId,
    //      so we cann't use vault.keyring.prepareAccounts  ( networkId -> impl -> vault )
    //
    // const vault = await vaultFactory.getWalletOnlyVault({
    //   networkId: '',
    //   walletId,
    // });
    // const accounts0 = await vault.keyring.prepareAccounts({
    //   name: accountName,
    //   networks: networkIds,
    //   wcTopic: wcSession.topic,
    //   wcPeerMeta,
    // });

    const accountId = accountUtils.buildExternalAccountId({
      wcSessionTopic: wcSession.topic,
    });

    const wcInfo: IDBExternalAccountWalletConnectInfo = {
      topic: wcSession.topic,
      peerMeta: wcPeerMeta,
      connectedAddresses: addressMap,
      selectedAddress: {},
    };
    const account: IDBExternalAccount = {
      id: accountId,
      type: EDBAccountType.VARIANT,
      name: accountName,
      networks: networkIds,
      wcTopic: wcSession.topic,
      wcInfoRaw: stringUtils.safeStringify(wcInfo),
      addresses: {},
      connectedAddresses: addressMap, // TODO merge with addresses
      selectedAddress: {},
      address: '',
      pub: '',
      path: '',
      coinType: '',
      impl: '',
    };
    const accounts = [account];
    await localDb.addAccountsToWallet({
      walletId,
      accounts,
    });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    return {
      walletId,
      accounts,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async addWatchingAccount({
    input,
    networkId,
    deriveType,
  }: {
    input: string;
    networkId: string;
    deriveType: IAccountDeriveTypes | undefined;
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
    if (deriveType) {
      const deriveInfo =
        await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
          networkId,
          deriveType,
        });
      if (deriveInfo) params.deriveInfo = deriveInfo;
    }

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
  async getIndexedAccountsOfWallet({ walletId }: { walletId: string }) {
    return localDb.getIndexedAccounts({ walletId });
  }

  @backgroundMethod()
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
        const accountNetworkId = accountUtils.getAccountCompatibleNetwork({
          account,
          networkId: activeNetworkId || '',
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
        return account;
      }),
    );
    return { accounts };
  }

  // TODO move to serviceAccountSelector
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
      const { accounts: accountsExternal } =
        await this.getSingletonAccountsOfWallet({
          walletId: WALLET_TYPE_EXTERNAL,
          activeNetworkId: othersNetworkId,
        });

      return [
        {
          title: 'Private Key',
          data: accountsImported,
          walletId: WALLET_TYPE_IMPORTED,
          emptyText:
            'No private key accounts. Add a new account to manage your assets.',
        },
        {
          title: 'Watchlist',
          data: accountsWatching,
          walletId: WALLET_TYPE_WATCHING,
          emptyText:
            'Your watchlist is empty. Import a address to start monitoring.',
        },
        {
          title: 'External account',
          data: accountsExternal,
          walletId: WALLET_TYPE_EXTERNAL,
          emptyText:
            'No external wallets connected. Link a third-party wallet to view here.',
        },
      ];
    }
    const walletId = focusedWallet;
    try {
      await this.getWallet({ walletId });
    } catch (error) {
      // wallet may be removed
      console.error(error);
      return [];
    }
    const { accounts } = await this.getIndexedAccountsOfWallet({
      walletId,
    });
    if (linkedNetworkId) {
      await Promise.all(
        accounts.map(async (indexedAccount: IDBIndexedAccount) => {
          try {
            const realAccount = await this.getNetworkAccount({
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
        emptyText: 'No account',
      },
    ];
  }

  @backgroundMethod()
  async getDBAccount({ accountId }: { accountId: string }) {
    const account = await localDb.getAccount({ accountId });
    return account;
  }

  @backgroundMethod()
  async saveAccountAddresses({
    account,
    networkId,
  }: {
    account: INetworkAccount;
    networkId: string;
  }) {
    await localDb.saveAccountAddresses({
      account,
      networkId,
    });
  }

  @backgroundMethod()
  async getAccountNameFromAddress({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }) {
    return this.getAccountNameFromAddressMemo({ networkId, address });
  }

  getAccountNameFromAddressMemo = memoizee(
    async ({ networkId, address }: { networkId: string; address: string }) => {
      const vault = await vaultFactory.getChainOnlyVault({
        networkId,
      });
      const { normalizedAddress } = await vault.validateAddress(address);
      return localDb.getAccountNameFromAddress({
        networkId,
        address,
        normalizedAddress,
      });
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

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
    const networkAccount = await vault.getAccount();

    return networkAccount;
  }

  @backgroundMethod()
  async getNetworkAccount({
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
    const settings = await this.backgroundApi.serviceNetwork.getVaultSettings({
      networkId,
    });
    const deriveInfo =
      await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
        networkId,
        deriveType,
      });
    const { idSuffix, template } = deriveInfo;

    const accounts = await Promise.all(
      indexedAccountIds.map(async (indexedAccountId) => {
        const { index, walletId } = accountUtils.parseIndexedAccountId({
          indexedAccountId,
        });

        const realDBAccountId = accountUtils.buildHDAccountId({
          walletId,
          index,
          template, // from networkId
          idSuffix,
          isUtxo:
            settings.isUtxo ||
            networkUtils.isLightningNetworkByImpl(settings.impl),
        });
        return this.getAccount({ accountId: realDBAccountId, networkId });
      }),
    );
    return {
      accounts,
    };
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
  async setAccountName(params: IDBSetAccountNameParams): Promise<void> {
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
  async createHWHiddenWallet({
    walletId,
    skipDeviceCancel,
    hideCheckingDeviceLoading,
  }: {
    walletId: string;
    skipDeviceCancel?: boolean;
    hideCheckingDeviceLoading?: boolean;
  }) {
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
        skipDeviceCancel,
        hideCheckingDeviceLoading,
      },
    );
  }

  @backgroundMethod()
  @toastIfError()
  async createHWWallet(params: IDBCreateHWWalletParamsBase) {
    // TODO verify device

    // createHWWallet
    return this.backgroundApi.serviceHardware.withHardwareProcessing(
      () => this.createHWWalletBase(params),
      {
        deviceParams: {
          dbDevice: params.device as IDBDevice,
        },
        skipDeviceCancel: params.skipDeviceCancel,
        hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
      },
    );
  }

  @backgroundMethod()
  async createHWWalletBase(params: IDBCreateHWWalletParams) {
    const { features, passphraseState } = params;
    if (!features) {
      throw new Error('createHWWalletBase ERROR: features is required');
    }
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
    const { password } = await servicePassword.promptPasswordVerify(
      EReasonForNeedPassword.CreateOrRemoveWallet,
    );

    await timerUtils.wait(100);

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

    await timerUtils.wait(100);

    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  async isTempWalletRemoved({
    wallet,
  }: {
    wallet: IDBWallet;
  }): Promise<boolean> {
    return Promise.resolve(localDb.isTempWalletRemoved({ wallet }));
  }

  @backgroundMethod()
  async setWalletTempStatus({
    walletId,
    isTemp,
  }: {
    walletId: IDBWalletId;
    isTemp: boolean;
  }) {
    const result = await localDb.setWalletTempStatus({
      walletId,
      isTemp,
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
  async removeAccount({
    indexedAccount,
    account,
  }: {
    indexedAccount?: IDBIndexedAccount;
    account?: IDBAccount;
  }) {
    let walletId = '';
    if (indexedAccount) {
      walletId = indexedAccount.walletId;
    }
    if (account) {
      walletId = accountUtils.getWalletIdFromAccountId({
        accountId: account.id,
      });
    }
    await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
      walletId,
    });
    if (account) {
      const accountId = account.id;
      await localDb.removeAccount({ accountId, walletId });
    }
    if (indexedAccount) {
      await localDb.removeIndexedAccount({
        indexedAccountId: indexedAccount.id,
        walletId,
      });
    }

    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    appEventBus.emit(EAppEventBusNames.AccountRemove, undefined);

    if (
      account &&
      accountUtils.isExternalAccount({
        accountId: account.id,
      })
    ) {
      // disconnect walletconnect session
      const topic = (account as IDBExternalAccount).wcTopic;
      if (topic) {
        await this.backgroundApi.serviceWalletConnect.dappSide.disconnectProvider(
          {
            topic,
          },
        );
      }
    }
  }

  @backgroundMethod()
  async removeWallet({
    walletId,
  }: Omit<IDBRemoveWalletParams, 'password' | 'isHardware'>) {
    if (!walletId) {
      throw new Error('walletId is required');
    }
    await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
      walletId,
    });
    const result = await localDb.removeWallet({
      walletId,
    });
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  async getAccountXpub({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const vault = await vaultFactory.getVault({ accountId, networkId });
    return vault.getAccountXpub();
  }

  // Get Address for each chain when request the API
  @backgroundMethod()
  async getAccountAddressForApi({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const account = await this.getAccount({ accountId, networkId });
    if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
      return account.addressDetail.normalizedAddress;
    }
    return account.address;
  }

  async getHDAccountMnemonic({ walletId }: { walletId: string }) {
    if (!accountUtils.isHdWallet({ walletId })) {
      throw new Error('getHDAccountMnemonic ERROR: Not a HD account');
    }
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
      });
    const credential = await localDb.getCredential(walletId);
    let mnemonic = mnemonicFromEntropy(credential.credential, password);
    mnemonic = await this.backgroundApi.servicePassword.encodeSensitiveText({
      text: mnemonic,
    });
    return { mnemonic };
  }
}

export default ServiceAccount;
