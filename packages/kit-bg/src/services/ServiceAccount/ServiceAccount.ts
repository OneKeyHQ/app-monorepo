import { isEmpty, isNil } from 'lodash';

import type { IBip39RevealableSeedEncryptHex } from '@onekeyhq/core/src/secret';
import {
  EMnemonicType,
  decodeSensitiveText,
  decryptRevealableSeed,
  encryptImportedCredential,
  ensureSensitiveTextEncoded,
  mnemonicFromEntropy,
  revealEntropyToMnemonic,
  revealableSeedFromMnemonic,
  revealableSeedFromTonMnemonic,
  tonMnemonicFromEntropy,
  tonValidateMnemonic,
  validateMnemonic,
} from '@onekeyhq/core/src/secret';
import type {
  EAddressEncodings,
  IExportKeyType,
} from '@onekeyhq/core/src/types';
import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ALL_NETWORK_ACCOUNT_MOCK_ADDRESS } from '@onekeyhq/shared/src/consts/addresses';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  COINTYPE_ALLNETWORKS,
  IMPL_ALLNETWORKS,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  InvalidMnemonic,
  OneKeyError,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { DeviceNotOpenedPassphrase } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import { randomAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IBatchCreateAccount,
  INetworkAccount,
} from '@onekeyhq/shared/types/account';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';
import type { IExternalConnectWalletResult } from '@onekeyhq/shared/types/externalWallet.types';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { EDBAccountType } from '../../dbs/local/consts';
import localDb from '../../dbs/local/localDb';
import { vaultFactory } from '../../vaults/factory';
import { getVaultSettings } from '../../vaults/settings';
import ServiceBase from '../ServiceBase';

import type {
  IDBAccount,
  IDBCreateHwWalletParams,
  IDBCreateHwWalletParamsBase,
  IDBCreateQRWalletParams,
  IDBCredentialBase,
  IDBDevice,
  IDBEnsureAccountNameNotDuplicateParams,
  IDBExternalAccount,
  IDBGetAllWalletsParams,
  IDBGetWalletsParams,
  IDBIndexedAccount,
  IDBRemoveWalletParams,
  IDBSetAccountNameParams,
  IDBSetWalletNameAndAvatarParams,
  IDBUtxoAccount,
  IDBVariantAccount,
  IDBWallet,
  IDBWalletId,
  IDBWalletIdSingleton,
} from '../../dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
  IHwAllNetworkPrepareAccountsResponse,
  IPrepareHardwareAccountsParams,
  IPrepareHdAccountsParams,
  IPrepareImportedAccountsParams,
  IPrepareWatchingAccountsParams,
  IValidateGeneralInputParams,
} from '../../vaults/types';
import type { IWithHardwareProcessingControlParams } from '../ServiceHardwareUI/ServiceHardwareUI';

export type IAddHDOrHWAccountsParams = {
  walletId: string | undefined;
  networkId: string | undefined;
  indexes?: Array<number>; // multiple add by indexes
  names?: Array<string>;
  indexedAccountId: string | undefined; // single add by indexedAccountId
  deriveType: IAccountDeriveTypes;
  hwAllNetworkPrepareAccountsResponse?: IHwAllNetworkPrepareAccountsResponse;
  isVerifyAddressAction?: boolean;

  // purpose?: number;
  // skipRepeat?: boolean;
  // callback?: (_account: Account) => Promise<boolean>;
  // isAddInitFirstAccountOnly?: boolean;
  // template?: string;
  // skipCheckAccountExist?: boolean;
} & IWithHardwareProcessingControlParams;
export type IAddHDOrHWAccountsResult = {
  networkId: string;
  walletId: string;
  indexedAccountId: string | undefined;
  indexes: number[] | undefined;
  accounts: IBatchCreateAccount[];
  deriveType: IAccountDeriveTypes;
};

@backgroundClass()
class ServiceAccount extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });

    appEventBus.on(EAppEventBusNames.WalletUpdate, () => {
      this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.AccountUpdate, () => {
      this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.RenameDBAccounts, () => {
      this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.WalletRename, () => {
      this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, () => {
      this.clearAccountCache();
    });
  }

  clearAccountCache() {
    this.getIndexedAccountWithMemo.clear();
  }

  @backgroundMethod()
  async validateMnemonic(mnemonic: string): Promise<{
    mnemonic: string;
    mnemonicType: EMnemonicType;
  }> {
    ensureSensitiveTextEncoded(mnemonic);
    const realMnemonic = decodeSensitiveText({
      encodedText: mnemonic,
    });
    const realMnemonicFixed = realMnemonic.trim().replace(/\s+/g, ' ');
    // TODO check by wordlists first
    if (!validateMnemonic(realMnemonicFixed)) {
      if (await tonValidateMnemonic(realMnemonicFixed.split(' '))) {
        return {
          mnemonic: realMnemonicFixed,
          mnemonicType: EMnemonicType.TON,
        };
      }
      throw new InvalidMnemonic();
    }
    return {
      mnemonic: realMnemonicFixed,
      mnemonicType: EMnemonicType.BIP39,
    };
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

  // TODO move to serviceHardware
  @backgroundMethod()
  async getWalletDevice({ walletId }: { walletId: string }) {
    return localDb.getWalletDevice({ walletId });
  }

  @backgroundMethod()
  async getWalletDeviceSafe({
    dbWallet,
    walletId,
  }: {
    dbWallet?: IDBWallet;
    walletId: string;
  }) {
    return localDb.getWalletDeviceSafe({ dbWallet, walletId });
  }

  @backgroundMethod()
  async getAccountDeviceSafe({ accountId }: { accountId: string }) {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    if (!walletId) {
      return null;
    }
    const device = await this.getWalletDeviceSafe({ walletId });
    if (!device) {
      return null;
    }
    return device;
  }

  // TODO move to serviceHardware
  @backgroundMethod()
  async getDevice({ dbDeviceId }: { dbDeviceId: string }) {
    return localDb.getDevice(dbDeviceId);
  }

  @backgroundMethod()
  async getWallets(options?: IDBGetWalletsParams) {
    return localDb.getWallets(options);
  }

  @backgroundMethod()
  async getAllHdHwQrWallets(options?: IDBGetWalletsParams) {
    const r = await this.getWallets(options);
    const wallets = r.wallets.filter(
      (wallet) =>
        accountUtils.isHdWallet({ walletId: wallet.id }) ||
        accountUtils.isQrWallet({ walletId: wallet.id }) ||
        accountUtils.isHwWallet({
          walletId: wallet.id,
        }),
    );
    return {
      wallets,
    };
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

  async getAllCredentials() {
    const credentials = await localDb.getAllCredentials();
    const credentialsExisted: IDBCredentialBase[] = [];
    const credentialsRemoved: IDBCredentialBase[] = [];

    for (const credential of credentials) {
      let isRemoved = false;
      if (accountUtils.isHdWallet({ walletId: credential.id })) {
        const wallet = await this.getWalletSafe({ walletId: credential.id });
        if (!wallet) {
          isRemoved = true;
        }
      }
      if (accountUtils.isImportedAccount({ accountId: credential.id })) {
        const account = await this.getDBAccountSafe({
          accountId: credential.id,
        });
        if (!account) {
          isRemoved = true;
        }
      }
      if (isRemoved) {
        credentialsRemoved.push(credential);
      } else {
        credentialsExisted.push(credential);
      }
    }
    return {
      credentials: credentialsExisted,
      credentialsRemoved,
    };
  }

  @backgroundMethod()
  async dumpCredentials() {
    const { credentials } = await this.getAllCredentials();
    return credentials.reduce(
      (mapping, { id, credential }) =>
        Object.assign(mapping, { [id]: credential }),
      {},
    );
  }

  @backgroundMethod()
  async getCredentialDecryptFromCredential({
    credential,
    password,
  }: {
    credential: string;
    password: string;
  }) {
    ensureSensitiveTextEncoded(password);
    const rs = decryptRevealableSeed({
      rs: credential,
      password,
    });
    const mnemonic = revealEntropyToMnemonic(rs.entropyWithLangPrefixed);
    return { rs, mnemonic };
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
    const { mnemonic, rs } = await this.getCredentialDecryptFromCredential({
      password,
      credential: dbCredential.credential,
    });
    return {
      rs,
      dbCredential,
      mnemonic,
    };
  }

  @backgroundMethod()
  async getIndexedAccount({ id }: { id: string }) {
    return this.getIndexedAccountWithMemo({ id });
  }

  getIndexedAccountWithMemo = memoizee(
    ({ id }: { id: string }) => localDb.getIndexedAccount({ id }),
    {
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
    },
  );

  @backgroundMethod()
  async getIndexedAccountSafe({ id }: { id: string }) {
    return localDb.getIndexedAccountSafe({ id });
  }

  @backgroundMethod()
  async getIndexedAccountByAccount({
    account,
  }: {
    account: IDBAccount | undefined;
  }) {
    return localDb.getIndexedAccountByAccount({ account });
  }

  async buildPrepareHdOrHwIndexes({
    indexedAccountId,
    indexes,
  }: {
    indexedAccountId: string | undefined;
    indexes: number[] | undefined;
  }) {
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
    return usedIndexes;
  }

  async getPrepareHDOrHWAccountsParams({
    walletId,
    networkId,
    indexes,
    names,
    indexedAccountId,
    deriveType,
    confirmOnDevice,
    hwAllNetworkPrepareAccountsResponse,
    isVerifyAddressAction,
  }: {
    walletId: string | undefined;
    networkId: string | undefined;
    indexes?: Array<number>;
    names?: Array<string>; // custom names
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes;
    confirmOnDevice?: EConfirmOnDeviceType;
    hwAllNetworkPrepareAccountsResponse?: IHwAllNetworkPrepareAccountsResponse;
    isVerifyAddressAction?: boolean;
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
        reason: EReasonForNeedPassword.Default,
      });

    // canAutoCreateNextAccount
    // skip exists account added
    // postAccountAdded
    // active first account

    const usedIndexes = await this.buildPrepareHdOrHwIndexes({
      indexedAccountId,
      indexes,
    });

    // const usedPurpose = await getVaultSettingsDefaultPurpose({ networkId });
    const deriveInfo =
      await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
        networkId,
        deriveType,
      });

    let prepareParams:
      | IPrepareHdAccountsParams
      | IPrepareHardwareAccountsParams;
    if (isHardware) {
      const hwParams: IPrepareHardwareAccountsParams = {
        deviceParams: {
          ...checkIsDefined(deviceParams),
          confirmOnDevice,
        },

        indexes: usedIndexes,
        names,
        deriveInfo,
        hwAllNetworkPrepareAccountsResponse,
      };
      prepareParams = hwParams;
    } else {
      const hdParams: IPrepareHdAccountsParams = {
        // type: 'ADD_ACCOUNTS', // for hardware only?
        password,

        indexes: usedIndexes,
        names,
        deriveInfo,
        // purpose: usedPurpose,
        // deriveInfo, // TODO pass deriveInfo to generate id and name
        // skipCheckAccountExist, // BTC required
      };
      prepareParams = hdParams;
    }

    prepareParams.isVerifyAddressAction = isVerifyAddressAction;

    return {
      deviceParams,
      prepareParams,
      walletId,
      networkId,
    };
  }

  async prepareHdOrHwAccounts(params: IAddHDOrHWAccountsParams) {
    // addHDOrHWAccounts
    const {
      indexes,
      indexedAccountId,
      deriveType,
      skipCloseHardwareUiStateDialog,
      skipDeviceCancel,
      skipDeviceCancelAtFirst,
      hideCheckingDeviceLoading,
      skipWaitingAnimationAtFirst,
    } = params;

    const { prepareParams, deviceParams, networkId, walletId } =
      await this.getPrepareHDOrHWAccountsParams(params);

    try {
      defaultLogger.account.accountCreatePerf.prepareHdOrHwAccountsStart(
        params,
      );

      const vault = await vaultFactory.getWalletOnlyVault({
        networkId,
        walletId,
      });

      const r =
        await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
          async () => {
            // addHDOrHWAccounts
            const accounts = await vault.keyring.prepareAccounts(prepareParams);
            return {
              vault,
              accounts,
              networkId,
              walletId,
            };
          },
          {
            deviceParams,
            skipCloseHardwareUiStateDialog,
            skipDeviceCancel,
            skipDeviceCancelAtFirst,
            hideCheckingDeviceLoading,
            debugMethodName: 'keyring.prepareAccounts',
            skipWaitingAnimationAtFirst,
          },
        );

      defaultLogger.account.accountCreatePerf.prepareHdOrHwAccountsEnd(params);
      return r;
    } catch (error) {
      // TODO merge with EmptyAccount\canCreateAddress\isNetworkNotMatched\EmptyAccount
      if (
        networkId &&
        accountUtils.isQrWallet({ walletId }) &&
        errorUtils.isErrorByClassName({
          error,
          className: [
            EOneKeyErrorClassNames.VaultKeyringNotDefinedError,
            EOneKeyErrorClassNames.OneKeyErrorNotImplemented,
          ],
        })
      ) {
        const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
          networkId,
        });
        throw new OneKeyError({
          message: appLocale.intl.formatMessage(
            {
              id: ETranslations.wallet_unsupported_network_title,
            },
            {
              network: network?.name || '',
            },
          ),
        });
      }
      throw error;
    }
  }

  @backgroundMethod()
  async addBatchCreatedHdOrHwAccount({
    walletId,
    networkId,
    account,
  }: {
    walletId: string;
    networkId: string;
    account: IBatchCreateAccount;
  }) {
    const { addressDetail, existsInDb, displayAddress, ...dbAccount } = account;
    if (isNil(dbAccount.pathIndex)) {
      throw new Error(
        'addBatchCreatedHdOrHwAccount ERROR: pathIndex is required',
      );
    }
    await this.addIndexedAccount({
      walletId,
      indexes: [dbAccount.pathIndex],
      skipIfExists: true,
    });
    await localDb.addAccountsToWallet({
      allAccountsBelongToNetworkId: networkId,
      walletId,
      accounts: [dbAccount],
    });
  }

  @backgroundMethod()
  async addHDOrHWAccountsFn(
    params: IAddHDOrHWAccountsParams,
  ): Promise<IAddHDOrHWAccountsResult | undefined> {
    // addHDOrHWAccounts
    const {
      walletId,
      networkId,
      deriveType,
      indexes,
      indexedAccountId,
      ...others
    } = params;

    const usedIndexes = await this.buildPrepareHdOrHwIndexes({
      indexedAccountId,
      indexes,
    });

    const { accountsForCreate } =
      await this.backgroundApi.serviceBatchCreateAccount.startBatchCreateAccountsFlow(
        {
          mode: 'normal',
          params: {
            walletId: walletId || '',
            networkId: networkId || '',
            deriveType,
            indexes: usedIndexes,
            saveToDb: true,
            ...others,
          },
        },
      );

    return {
      networkId: networkId || '',
      walletId: walletId || '',
      indexedAccountId,
      accounts: accountsForCreate,
      indexes,
      deriveType,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async addHDOrHWAccounts(params: IAddHDOrHWAccountsParams) {
    return this.addHDOrHWAccountsFn(params);
  }

  @backgroundMethod()
  @toastIfError()
  async restoreAccountsToWallet(params: {
    walletId: string;
    accounts: IDBAccount[];
    importedCredential?: string;
  }) {
    const { walletId, accounts, importedCredential } = params;
    const shouldCreateIndexAccount =
      accountUtils.isHdWallet({ walletId }) ||
      accountUtils.isHwWallet({ walletId });
    if (shouldCreateIndexAccount) {
      await Promise.all(
        accounts.map(async (account) => {
          const { idSuffix } = accountUtils.parseAccountId({
            accountId: account.id,
          });
          const indexedAccountNo = account.indexedAccountId
            ? accountUtils.parseIndexedAccountId({
                indexedAccountId: account.indexedAccountId,
              }).index
            : 0;
          const indexedAccountId = accountUtils.buildIndexedAccountId({
            walletId,
            index: indexedAccountNo,
          });
          account.id = accountUtils.buildHDAccountId({
            walletId,
            networkImpl: account.impl,
            index: account.pathIndex,
            template: account.template,
            idSuffix,
            isUtxo: account.type === EDBAccountType.UTXO,
          });
          account.indexedAccountId = indexedAccountId;
        }),
      );
    }
    // restoreAccountsToWallet
    await localDb.addAccountsToWallet({
      walletId,
      accounts,
      importedCredential,
    });
    if (shouldCreateIndexAccount) {
      await this.addIndexedAccount({
        walletId,
        indexes: accounts.map((account) =>
          account.indexedAccountId
            ? accountUtils.parseIndexedAccountId({
                indexedAccountId: account.indexedAccountId,
              }).index
            : 0,
        ),
        skipIfExists: true,
      });
      for (const account of accounts) {
        await this.setAccountName({
          name: account.name,
          indexedAccountId: account.indexedAccountId,
        });
      }
    }
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
  async getNetworkSupportedExportKeyTypes({
    networkId,
    exportType,
    accountId,
  }: {
    networkId: string;
    exportType: IExportKeyType;
    accountId?: string;
  }) {
    const settings = await getVaultSettings({ networkId });
    let keyTypes: ECoreApiExportedSecretKeyType[] | undefined;
    if (exportType === 'privateKey') {
      keyTypes = settings.supportExportedSecretKeys?.filter((item) =>
        [
          ECoreApiExportedSecretKeyType.privateKey,
          ECoreApiExportedSecretKeyType.xprvt,
        ].includes(item),
      );
    }
    if (exportType === 'publicKey') {
      keyTypes = settings.supportExportedSecretKeys?.filter((item) =>
        [
          ECoreApiExportedSecretKeyType.publicKey,
          ECoreApiExportedSecretKeyType.xpub,
        ].includes(item),
      );
    }
    if (exportType === 'mnemonic') {
      if (accountId) {
        const hasMnemonic = await this.hasTonImportedAccountMnemonic({
          accountId,
        });
        if (hasMnemonic) {
          keyTypes = settings.supportExportedSecretKeys?.filter((item) =>
            [ECoreApiExportedSecretKeyType.mnemonic].includes(item),
          );
        }
      }
    }
    return keyTypes;
  }

  @backgroundMethod()
  @toastIfError()
  async exportAccountKeysByType({
    accountId,
    indexedAccountId,
    networkId,
    deriveType,
    exportType,
    accountName,
  }: {
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    networkId: string;
    deriveType: IAccountDeriveTypes | undefined;
    exportType: IExportKeyType;
    accountName: string | undefined;
  }) {
    if (!accountId && !indexedAccountId) {
      throw new Error('accountId or indexedAccountId is required');
    }
    if (accountId && indexedAccountId) {
      throw new Error(
        'accountId and indexedAccountId can not be used at the same time',
      );
    }
    let dbAccountId = accountId;
    if (indexedAccountId) {
      if (!deriveType) {
        throw new Error('deriveType required');
      }
      dbAccountId = await this.getDbAccountIdFromIndexedAccountId({
        indexedAccountId,
        networkId,
        deriveType,
      });
    }
    if (!dbAccountId) {
      throw new Error('dbAccountId required');
    }
    const dbAccount = await this.getDBAccountSafe({
      accountId: dbAccountId,
    });

    if (!dbAccount) {
      const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
        networkId,
      });
      let deriveInfo: IAccountDeriveInfo | undefined;
      let deriveItems: IAccountDeriveInfoItems[] | undefined;
      if (deriveType) {
        deriveInfo =
          await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
            networkId,
            deriveType,
          });
        deriveItems =
          await this.backgroundApi.serviceNetwork.getDeriveInfoItemsOfNetwork({
            networkId,
          });
      }
      throw new Error(
        appLocale.intl.formatMessage(
          {
            id: ETranslations.global_private_key_error,
          },
          {
            network: network?.name || '',
            path:
              deriveItems?.length && deriveItems?.length > 1
                ? deriveInfo?.label || deriveType || ''
                : '',
          },
        ),
      );
    }
    const keyTypes = await this.getNetworkSupportedExportKeyTypes({
      networkId,
      exportType,
    });
    const keyType = keyTypes?.[0];
    if (!keyType) {
      // throw new Error(
      //   appLocale.intl.formatMessage({
      //     id: ETranslations.hardware_not_support,
      //   }),
      // );
      throw new Error('Export keyType not found for the network');
    }
    if (exportType === 'privateKey') {
      return this.exportAccountSecretKey({
        accountId: dbAccountId,
        networkId,
        keyType,
      });
    }
    if (exportType === 'publicKey') {
      return this.exportAccountPublicKey({
        accountId: dbAccountId,
        networkId,
        keyType,
      });
    }
    throw new Error(`exportType not supported: ${String(exportType)}`);
  }

  @backgroundMethod()
  @toastIfError()
  async exportAccountSecretKey({
    accountId,
    networkId,
    keyType,
  }: {
    accountId: string;
    networkId: string;
    keyType: ECoreApiExportedSecretKeyType;
  }): Promise<string> {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.Security,
      });
    return vault.keyring.exportAccountSecretKeys({
      password,
      keyType,
    });
  }

  @backgroundMethod()
  @toastIfError()
  async exportAccountPublicKey({
    accountId,
    networkId,
    keyType,
  }: {
    accountId: string;
    networkId: string;
    keyType: ECoreApiExportedSecretKeyType;
  }): Promise<string | undefined> {
    const buildResult = async (account: IDBAccount | undefined) => {
      if (!account) {
        throw new Error('exportAccountPublicKey ERROR: account not found');
      }
      let publicKey: string | undefined;
      if (keyType === ECoreApiExportedSecretKeyType.publicKey) {
        publicKey = account?.pub;
      }
      if (keyType === ECoreApiExportedSecretKeyType.xpub) {
        publicKey = (account as IDBUtxoAccount | undefined)?.xpub;
      }
      if (!publicKey) {
        throw new Error('publicKey not found');
      }
      return publicKey;
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.Security,
      });
    const account: IDBAccount | undefined = await this.getAccount({
      accountId,
      networkId,
    });
    if (accountUtils.isHwOrQrAccount({ accountId })) {
      const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
      const indexedAccountId = account.indexedAccountId;
      const { deriveType } =
        await this.backgroundApi.serviceNetwork.getDeriveTypeByDBAccount({
          networkId,
          account,
        });
      const { prepareParams, deviceParams } =
        await this.getPrepareHDOrHWAccountsParams({
          walletId,
          networkId,
          indexedAccountId,
          deriveType,
          confirmOnDevice: EConfirmOnDeviceType.EveryItem,
        });
      const vault = await vaultFactory.getWalletOnlyVault({
        networkId,
        walletId,
      });

      // const accounts = await vault.keyring.prepareAccounts(prepareParams);
      const { accountsForCreate } =
        await this.backgroundApi.serviceBatchCreateAccount.previewBatchBuildAccounts(
          {
            walletId,
            networkId,
            deriveType,
            indexes: prepareParams.indexes,
            showOnOneKey: true,
          },
        );
      return buildResult(accountsForCreate?.[0]);
    }
    return buildResult(account);
  }

  @backgroundMethod()
  @toastIfError()
  async addImportedAccount({
    input,
    networkId,
    deriveType,
    name,
    shouldCheckDuplicateName,
  }: {
    input: string;
    networkId: string;
    deriveType: IAccountDeriveTypes | undefined;
    name?: string;
    shouldCheckDuplicateName?: boolean;
  }) {
    ensureSensitiveTextEncoded(input);
    const walletId = WALLET_TYPE_IMPORTED;
    const vault = await vaultFactory.getWalletOnlyVault({
      networkId,
      walletId,
    });
    const { privateKey } = await vault.getPrivateKeyFromImported({ input });
    return this.addImportedAccountWithCredential({
      credential: privateKey,
      networkId,
      deriveType,
      name,
      shouldCheckDuplicateName,
    });
  }

  @backgroundMethod()
  @toastIfError()
  async addImportedAccountWithCredential({
    credential,
    networkId,
    deriveType,
    name,
    shouldCheckDuplicateName,
    skipAddIfNotEqualToAddress,
  }: {
    name?: string;
    shouldCheckDuplicateName?: boolean;
    credential: string;
    networkId: string;
    deriveType: IAccountDeriveTypes | undefined;
    skipAddIfNotEqualToAddress?: string;
  }): Promise<{
    networkId: string;
    walletId: string;
    accounts: IDBAccount[];
  }> {
    if (platformEnv.isWebDappMode) {
      throw new Error(
        'addImportedAccountWithCredential ERROR: Not supported in Dapp mode',
      );
    }
    const walletId = WALLET_TYPE_IMPORTED;

    if (shouldCheckDuplicateName && name) {
      await localDb.ensureAccountNameNotDuplicate({
        name,
        walletId,
      });
    }

    const vault = await vaultFactory.getWalletOnlyVault({
      networkId,
      walletId,
    });
    // TODO privateKey should be HEX format
    ensureSensitiveTextEncoded(credential);

    const privateKeyDecoded = decodeSensitiveText({ encodedText: credential });

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
      name: name || '',
      importedCredential: credentialEncrypt,
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

    // addImportedAccount
    const accounts = await vault.keyring.prepareAccounts(params);

    if (
      skipAddIfNotEqualToAddress &&
      accounts.length === 1 &&
      accounts?.[0]?.address &&
      accounts?.[0]?.address !== skipAddIfNotEqualToAddress
    ) {
      return {
        networkId,
        walletId,
        accounts: [],
      };
    }

    await localDb.addAccountsToWallet({
      allAccountsBelongToNetworkId: networkId,
      walletId,
      accounts,
      importedCredential: credentialEncrypt,
      accountNameBuilder: ({ nextAccountId }) =>
        accountUtils.buildBaseAccountName({ nextAccountId }),
    });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    return {
      networkId,
      walletId,
      accounts,
    };
  }

  @backgroundMethod()
  async addExternalAccount({
    connectResult,
  }: {
    connectResult: IExternalConnectWalletResult;
  }) {
    const walletId = WALLET_TYPE_EXTERNAL;

    const isWalletConnect = !!connectResult.connectionInfo.walletConnect;

    let accounts: IDBExternalAccount[] = [];

    const { notSupportedNetworkIds, connectionInfo, accountInfo } =
      connectResult;
    const { addresses, networkIds, impl, createAtNetwork, name } = accountInfo;

    if (isWalletConnect) {
      // walletconnect should create multiple chain accounts
      for (const networkId of checkIsDefined(networkIds)) {
        const accountId = accountUtils.buildExternalAccountId({
          wcSessionTopic: connectResult.connectionInfo?.walletConnect?.topic,
          connectionInfo: connectResult.connectionInfo,
          networkId,
        });

        const { isMergedNetwork } = accountUtils.getWalletConnectMergedNetwork({
          networkId,
        });
        const account: IDBExternalAccount = {
          id: accountId,
          type: EDBAccountType.VARIANT,
          name: '',
          connectionInfoRaw: stringUtils.safeStringify(connectionInfo),
          addresses: {},
          connectedAddresses: addresses, // TODO merge with addresses
          selectedAddress: {},
          address: '',
          pub: '',
          path: '',
          coinType: '',
          impl: networkUtils.getNetworkImpl({ networkId }),
          createAtNetwork: networkId,
          networks: isMergedNetwork ? undefined : [networkId],
        };
        if (!accounts.find((item) => item.id === accountId)) {
          accounts.push(account);
        }
      }
    } else {
      // injected create single account
      const accountId = accountUtils.buildExternalAccountId({
        wcSessionTopic: connectResult.connectionInfo?.walletConnect?.topic,
        connectionInfo: connectResult.connectionInfo,
      });

      const account: IDBExternalAccount = {
        id: accountId,
        type: EDBAccountType.VARIANT,
        name: '',
        connectionInfoRaw: stringUtils.safeStringify(connectionInfo),
        addresses: {},
        connectedAddresses: addresses, // TODO merge with addresses
        selectedAddress: {},
        address: '',
        pub: '',
        path: '',
        coinType: '',
        impl,
        createAtNetwork,
        networks: networkIds,
      };
      accounts = [account];
    }

    // addExternalAccount
    await localDb.addAccountsToWallet({
      walletId,
      accounts,
      accountNameBuilder: ({ nextAccountId }) =>
        accountUtils.buildBaseAccountName({
          mainName: name || 'Account',
          nextAccountId,
        }),
    });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);

    if (notSupportedNetworkIds && notSupportedNetworkIds?.length > 0) {
      // TODO show external wallet switch network dialog to evm--1
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: `Not supported network: ${notSupportedNetworkIds.join(', ')}`,
      });
    }
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
    name,
    shouldCheckDuplicateName,
    isUrlAccount,
    skipAddIfNotEqualToAddress,
  }: {
    input: string;
    networkId: string;
    name?: string;
    shouldCheckDuplicateName?: boolean;
    deriveType?: IAccountDeriveTypes;
    isUrlAccount?: boolean;
    skipAddIfNotEqualToAddress?: string;
  }): Promise<{
    networkId: string;
    walletId: string;
    accounts: IDBAccount[];
  }> {
    if (networkUtils.isAllNetwork({ networkId })) {
      throw new Error(
        'addWatchingAccount ERROR: networkId should not be all networks',
      );
    }
    const walletId = WALLET_TYPE_WATCHING;

    if (name && shouldCheckDuplicateName) {
      await localDb.ensureAccountNameNotDuplicate({
        name,
        walletId,
      });
    }

    // /evm/0x63ac73816EeB38514DaE6c46008baf55f1c59C9e
    if (networkId === IMPL_EVM) {
      // eslint-disable-next-line no-param-reassign
      networkId = getNetworkIdsMap().eth;
    }

    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    if (!network) {
      throw new Error('addWatchingAccount ERROR: network not found');
    }

    const vault = await vaultFactory.getWalletOnlyVault({
      networkId,
      walletId,
    });
    let address = '';
    let xpub = '';
    let btcForkAddressEncoding: EAddressEncodings | undefined;
    const addressValidationResult = await vault.validateAddress(input);
    if (addressValidationResult.isValid) {
      address = addressValidationResult.normalizedAddress;
      btcForkAddressEncoding = addressValidationResult.encoding;
    } else {
      const xpubValidationResult = await vault.validateXpub(input);
      if (xpubValidationResult.isValid) {
        xpub = input;
      }
    }
    if (!address && !xpub) {
      throw new Error('input not valid');
    }

    const params: IPrepareWatchingAccountsParams = {
      address,
      xpub,
      name: name || '',
      networks: [networkId],
      createAtNetwork: networkId,
      isUrlAccount,
    };

    let deriveTypeByAddressEncoding: IAccountDeriveTypes | undefined;
    if (btcForkAddressEncoding) {
      deriveTypeByAddressEncoding =
        await this.backgroundApi.serviceNetwork.getDeriveTypeByAddressEncoding({
          encoding: btcForkAddressEncoding,
          networkId,
        });
      if (
        deriveType &&
        deriveTypeByAddressEncoding &&
        deriveTypeByAddressEncoding !== deriveType
      ) {
        throw new Error('addWatchingAccount ERROR: deriveType not correct');
      }
    }

    if (!deriveType && deriveTypeByAddressEncoding) {
      // eslint-disable-next-line no-param-reassign
      deriveType = deriveTypeByAddressEncoding;
    }

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

    if (
      skipAddIfNotEqualToAddress &&
      accounts.length === 1 &&
      accounts?.[0]?.address &&
      accounts?.[0]?.address !== skipAddIfNotEqualToAddress
    ) {
      return {
        networkId,
        walletId,
        accounts: [],
      };
    }

    await localDb.addAccountsToWallet({
      allAccountsBelongToNetworkId: networkId,
      walletId,
      accounts,
      accountNameBuilder: ({ nextAccountId }) =>
        isUrlAccount
          ? `Url Account ${Date.now()}`
          : accountUtils.buildBaseAccountName({ nextAccountId }),
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
    return localDb.getIndexedAccountsOfWallet({ walletId });
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
        try {
          const accountNetworkId = accountUtils.getAccountCompatibleNetwork({
            account,
            networkId: activeNetworkId || '',
          });
          if (accountNetworkId) {
            return await this.getAccount({
              accountId,
              networkId: accountNetworkId,
            });
          }
        } catch (e) {
          //
        }
        return account;
      }),
    );
    return { accounts };
  }

  @backgroundMethod()
  async getWalletConnectDBAccounts({ topic }: { topic: string | undefined }) {
    const { accounts } =
      await this.backgroundApi.serviceAccount.getSingletonAccountsOfWallet({
        walletId: WALLET_TYPE_EXTERNAL,
      });
    const wcAccounts = accounts
      .filter((item) => {
        const accountTopic = (item as IDBExternalAccount | undefined)
          ?.connectionInfo?.walletConnect?.topic;
        // find specific walletconnect account with same topic
        if (topic) {
          return accountTopic === topic;
        }
        // find all walletconnect accounts
        return Boolean(accountTopic);
      })
      .filter(Boolean);
    return {
      accounts: wcAccounts,
    };
  }

  @backgroundMethod()
  async getDBAccount({ accountId }: { accountId: string }) {
    const account = await localDb.getAccount({ accountId });
    return account;
  }

  @backgroundMethod()
  async getDBAccountSafe({ accountId }: { accountId: string }) {
    const account = await localDb.getAccountSafe({ accountId });
    return account;
  }

  @backgroundMethod()
  async getUrlDBAccountSafe() {
    return this.getDBAccountSafe({
      accountId: accountUtils.buildWatchingAccountId({
        coinType: '',
        isUrlAccount: true,
      }),
    });
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
  async getMockedAllNetworkAccount({
    indexedAccountId,
  }: {
    indexedAccountId: string;
  }): Promise<INetworkAccount> {
    const mockAllNetworkAccountAddress = ALL_NETWORK_ACCOUNT_MOCK_ADDRESS;
    const indexedAccount = await this.getIndexedAccount({
      id: indexedAccountId,
    });
    const { index } = accountUtils.parseIndexedAccountId({ indexedAccountId });
    const realDBAccountId = await this.getDbAccountIdFromIndexedAccountId({
      indexedAccountId,
      networkId: getNetworkIdsMap().onekeyall,
      deriveType: 'default',
    });
    return {
      id: realDBAccountId,
      indexedAccountId,
      name: indexedAccount.name,
      address: mockAllNetworkAccountAddress,
      type: undefined,
      path: '',
      coinType: COINTYPE_ALLNETWORKS,
      pathIndex: index,
      impl: IMPL_ALLNETWORKS,
      pub: '',
      addresses: {},
      selectedAddress: {},
      connectionInfoRaw: '',
      connectedAddresses: {},
      connectionInfo: {},
      addressDetail: {
        isValid: true,
        allowEmptyAddress: true,
        networkId: getNetworkIdsMap().onekeyall,
        address: mockAllNetworkAccountAddress,
        baseAddress: mockAllNetworkAccountAddress,
        normalizedAddress: mockAllNetworkAccountAddress,
        displayAddress: mockAllNetworkAccountAddress,
      },
    };
  }

  @backgroundMethod()
  async getAccount({
    dbAccount,
    accountId,
    networkId,
  }: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
  }): Promise<INetworkAccount> {
    checkIsDefined(accountId);
    checkIsDefined(networkId);
    if (networkUtils.isAllNetwork({ networkId })) {
      if (
        accountUtils.isOthersWallet({
          walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
        })
      ) {
        let dbAccountUsed: IDBAccount | undefined = dbAccount;
        if (!dbAccountUsed || dbAccountUsed?.id !== accountId) {
          dbAccountUsed = await localDb.getAccount({ accountId });
        }
        const realNetworkId = accountUtils.getAccountCompatibleNetwork({
          account: dbAccountUsed,
          networkId: undefined,
        });
        if (realNetworkId === getNetworkIdsMap().onekeyall) {
          throw new Error(
            'getAccount ERROR: realNetworkId can not be allnetwork',
          );
        }
        return this.getAccount({
          dbAccount: dbAccountUsed,
          accountId,
          networkId: checkIsDefined(realNetworkId),
        });
      }
      const indexedAccountId =
        accountUtils.buildAllNetworkIndexedAccountIdFromAccountId({
          accountId,
        });
      const allNetworkAccount = await this.getMockedAllNetworkAccount({
        indexedAccountId,
      });
      if (allNetworkAccount.id !== accountId) {
        throw new Error(
          'getAccount ERROR: allNetworkAccount accountId not match',
        );
      }
      return allNetworkAccount;
    }
    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    const networkAccount = await vault.getAccount({ dbAccount });

    return networkAccount;
  }

  @backgroundMethod()
  async getNetworkAccount({
    dbAccount,
    accountId,
    indexedAccountId,
    deriveType,
    networkId,
  }: {
    dbAccount?: IDBAccount;
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes;
    networkId: string;
  }): Promise<INetworkAccount> {
    if (accountId) {
      return this.getAccount({
        dbAccount,
        accountId,
        networkId,
      });
    }
    if (indexedAccountId) {
      if (!deriveType) {
        throw new Error('deriveType is required');
      }
      const { accounts } = await this.getAccountsByIndexedAccounts({
        networkId,
        deriveType,
        indexedAccountIds: [indexedAccountId],
        dbAccounts: [dbAccount].filter(Boolean),
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
  async getAllIndexedAccounts({
    allWallets,
    filterRemoved,
  }: {
    allWallets?: IDBWallet[];
    filterRemoved?: boolean;
  } = {}) {
    const { indexedAccounts } = await localDb.getAllIndexedAccounts();
    let indexedAccountsExists: IDBIndexedAccount[] = [];
    const indexedAccountsRemoved: IDBIndexedAccount[] = [];
    if (filterRemoved) {
      const wallets: IDBWallet[] =
        allWallets || (await this.getAllWallets()).wallets;
      await Promise.all(
        indexedAccounts.map(async (indexedAccount) => {
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: indexedAccount.id,
          });
          let isRemoved = false;
          if (walletId && wallets?.length) {
            const wallet = wallets.find((o) => o.id === walletId);
            if (!wallet) {
              isRemoved = true;
            }
          }
          if (isRemoved) {
            indexedAccountsRemoved.push(indexedAccount);
          } else {
            indexedAccountsExists.push(indexedAccount);
          }
        }),
      );
    } else {
      indexedAccountsExists = indexedAccounts;
    }
    return {
      indexedAccounts: indexedAccountsExists,
      indexedAccountsRemoved,
    };
  }

  @backgroundMethod()
  async getAllAccounts({
    ids,
    filterRemoved,
  }: {
    ids?: string[];
    filterRemoved?: boolean;
  } = {}) {
    // filter accounts match to available wallets, some account wallet or indexedAccount may be deleted
    const { accounts } = await localDb.getAllAccounts({ ids });

    const removedHiddenWallet: {
      [walletId: string]: true;
    } = {};
    const removedWallet: {
      [walletId: string]: true;
    } = {};
    const removedIndexedAccount: {
      [indexedAccountId: string]: true;
    } = {};

    let accountsFiltered: IDBAccount[] = accounts;
    let accountsRemoved: IDBAccount[] | undefined;

    if (filterRemoved) {
      const { wallets } = await this.getAllWallets({ refillWalletInfo: true });
      const { indexedAccounts } = await this.getAllIndexedAccounts({
        allWallets: wallets,
        filterRemoved,
      });

      accountsRemoved = [];
      accountsFiltered = (
        await Promise.all(
          accounts.map(async (account) => {
            const { indexedAccountId, id } = account;

            if (
              accountUtils.isUrlAccountFn({
                accountId: id,
              })
            ) {
              return null;
            }

            const walletId = accountUtils.getWalletIdFromAccountId({
              accountId: id,
            });
            const pushRemovedAccount = () => {
              accountsRemoved?.push(account);
            };

            if (walletId) {
              if (removedWallet[walletId] || removedHiddenWallet[walletId]) {
                pushRemovedAccount();
                return null;
              }
              const wallet: IDBWallet | undefined = wallets.find(
                (o) => o.id === walletId,
              );
              if (!wallet) {
                removedWallet[walletId] = true;
                pushRemovedAccount();
                return null;
              }
              if (localDb.isTempWalletRemoved({ wallet })) {
                removedHiddenWallet[walletId] = true;
                pushRemovedAccount();
                return null;
              }
            }
            if (indexedAccountId) {
              if (removedIndexedAccount[indexedAccountId]) {
                pushRemovedAccount();
                return null;
              }
              const indexedAccount: IDBIndexedAccount | undefined =
                indexedAccounts.find((o) => o.id === indexedAccountId);
              if (!indexedAccount) {
                removedIndexedAccount[indexedAccountId] = true;
                pushRemovedAccount();
                return null;
              }
            }
            return account;
          }),
        )
      ).filter(Boolean);
    }

    return {
      accounts: accountsFiltered,
      accountsRemoved,
    };
  }

  async getAllWallets(params: IDBGetAllWalletsParams = {}) {
    return localDb.getAllWallets(params);
  }

  async getAllDevices() {
    return localDb.getAllDevices();
  }

  // TODO cache
  @backgroundMethod()
  async getAccountsInSameIndexedAccountId({
    indexedAccountId,
  }: {
    indexedAccountId: string;
  }): Promise<IDBAccount[]> {
    return localDb.getAccountsInSameIndexedAccountId({ indexedAccountId });
  }

  @backgroundMethod()
  async getDbAccountIdFromIndexedAccountId({
    indexedAccountId,
    networkId,
    deriveType,
  }: {
    indexedAccountId: string;
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }) {
    const settings = await this.backgroundApi.serviceNetwork.getVaultSettings({
      networkId,
    });
    const deriveInfo =
      await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
        networkId,
        deriveType,
      });
    const { idSuffix, template } = deriveInfo;

    const { index, walletId } = accountUtils.parseIndexedAccountId({
      indexedAccountId,
    });
    const realDBAccountId = accountUtils.buildHDAccountId({
      walletId,
      networkImpl: settings.impl,
      index,
      template, // from networkId
      idSuffix,
      isUtxo: settings.isUtxo,
    });
    return realDBAccountId;
  }

  @backgroundMethod()
  /**
   * Retrieves accounts by their indexed account IDs.
   *
   * @param indexedAccountIds - An array of indexed account IDs.
   * @param networkId - The network ID.
   * @param deriveType - The account derive type.
   * @returns A promise that resolves to an object containing the retrieved accounts.
   */
  async getAccountsByIndexedAccounts({
    dbAccounts,
    indexedAccountIds,
    networkId,
    deriveType,
  }: {
    dbAccounts?: IDBAccount[];
    indexedAccountIds: string[];
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }): Promise<{
    accounts: INetworkAccount[];
  }> {
    const accounts = await Promise.all(
      indexedAccountIds.map(async (indexedAccountId) => {
        if (networkUtils.isAllNetwork({ networkId })) {
          return this.getMockedAllNetworkAccount({ indexedAccountId });
        }
        const realDBAccountId = await this.getDbAccountIdFromIndexedAccountId({
          indexedAccountId,
          networkId,
          deriveType,
        });
        const dbAccount: IDBAccount | undefined = dbAccounts?.find(
          (o) => o.id === realDBAccountId,
        );
        return this.getAccount({
          accountId: realDBAccountId,
          networkId,
          dbAccount,
        });
      }),
    );
    return {
      accounts,
    };
  }

  @backgroundMethod()
  async addIndexedAccount({
    walletId,
    indexes,
    names,
    skipIfExists,
  }: {
    walletId: string;
    indexes: number[];
    names?: {
      [index: number]: string;
    };
    skipIfExists: boolean;
  }) {
    return localDb.addIndexedAccount({
      walletId,
      indexes,
      names,
      skipIfExists,
    });
  }

  @backgroundMethod()
  async addHDNextIndexedAccount({ walletId }: { walletId: string }) {
    const result = await localDb.addHDNextIndexedAccount({ walletId });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  async ensureAccountNameNotDuplicate(
    params: IDBEnsureAccountNameNotDuplicateParams,
  ) {
    return localDb.ensureAccountNameNotDuplicate(params);
  }

  // rename account
  @backgroundMethod()
  @toastIfError()
  async setAccountName(params: IDBSetAccountNameParams): Promise<void> {
    const r = await localDb.setAccountName(params);
    if (!params.skipEventEmit) {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    }
    return r;
  }

  @backgroundMethod()
  async getWalletDeviceParams({
    walletId,
  }: {
    walletId: string;
  }): Promise<IDeviceSharedCallParams | undefined> {
    if (!accountUtils.isHwWallet({ walletId })) {
      return undefined;
    }

    const wallet = await this.getWallet({ walletId });
    const dbDevice = await this.getWalletDevice({ walletId });
    return {
      confirmOnDevice: EConfirmOnDeviceType.LastItem,
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
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
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
        debugMethodName: 'createHWHiddenWallet.getPassphraseState',
      },
    );
  }

  @backgroundMethod()
  @toastIfError()
  async createQrWallet(params: IDBCreateQRWalletParams) {
    // const { name, deviceId, xfp, version } = qrDevice;
    const result = await localDb.createQrWallet(params);
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async createHWWallet(params: IDBCreateHwWalletParamsBase) {
    // createHWWallet
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      () => this.createHWWalletBase(params),
      {
        deviceParams: {
          dbDevice: params.device as IDBDevice,
        },
        skipDeviceCancel: params.skipDeviceCancel,
        hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
        debugMethodName: 'createHWWalletBase',
      },
    );
  }

  @backgroundMethod()
  async restoreTempCreatedWallet({ walletId }: { walletId: string }) {
    await localDb.restoreTempCreatedWallet({ walletId });
  }

  @backgroundMethod()
  async createHWWalletBase(params: IDBCreateHwWalletParams) {
    const { features, passphraseState } = params;
    if (!features) {
      throw new Error('createHWWalletBase ERROR: features is required');
    }
    const result = await localDb.createHwWallet({
      ...params,
      passphraseState: passphraseState || '',
    });
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  async createHDWallet({
    name,
    mnemonic,
    walletHashBuilder,
  }: {
    mnemonic: string;
    name?: string;
    walletHashBuilder?: (options: { realMnemonic: string }) => string;
  }) {
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.CreateOrRemoveWallet,
    });

    ensureSensitiveTextEncoded(mnemonic); // TODO also add check for imported account

    const { mnemonic: realMnemonic, mnemonicType } =
      await this.validateMnemonic(mnemonic);

    if (mnemonicType === EMnemonicType.TON) {
      throw new Error('TON mnemonic is not supported');
    }

    let walletHash: string | undefined;
    if (walletHashBuilder) {
      walletHash = walletHashBuilder({ realMnemonic });
    }

    let rs: IBip39RevealableSeedEncryptHex | undefined;
    try {
      rs = revealableSeedFromMnemonic(realMnemonic, password);
    } catch {
      throw new InvalidMnemonic();
    }
    if (realMnemonic !== mnemonicFromEntropy(rs, password)) {
      throw new InvalidMnemonic();
    }

    return this.createHDWalletWithRs({ rs, password, name, walletHash });
  }

  @backgroundMethod()
  async saveTonImportedAccountMnemonic({
    mnemonic,
    accountId,
  }: {
    mnemonic: string;
    accountId: string;
  }) {
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.CreateOrRemoveWallet,
    });
    ensureSensitiveTextEncoded(mnemonic);
    const { mnemonic: realMnemonic, mnemonicType } =
      await this.validateMnemonic(mnemonic);

    if (mnemonicType !== EMnemonicType.TON) {
      throw new Error('saveTonMnemonic ERROR: Not a TON mnemonic');
    }
    let rs: IBip39RevealableSeedEncryptHex | undefined;
    try {
      rs = revealableSeedFromTonMnemonic(realMnemonic, password);
    } catch {
      throw new InvalidMnemonic();
    }

    if (realMnemonic !== tonMnemonicFromEntropy(rs, password)) {
      throw new InvalidMnemonic();
    }
    await localDb.saveTonImportedAccountMnemonic({ accountId, rs });
  }

  @backgroundMethod()
  async createHDWalletWithRs({
    rs,
    password,
    avatarInfo,
    name,
    walletHash,
  }: {
    rs: string;
    password: string;
    avatarInfo?: IAvatarInfo;
    name?: string;
    walletHash?: string;
  }): Promise<{ wallet: IDBWallet; indexedAccount?: IDBIndexedAccount }> {
    if (platformEnv.isWebDappMode) {
      throw new Error('createHDWallet ERROR: Not supported in Dapp mode');
    }
    ensureSensitiveTextEncoded(password);

    if (walletHash) {
      // TODO performance issue
      const { wallets } = await this.getAllWallets();
      const existsSameHashWallet = wallets.find(
        (item) => walletHash && item.hash && item.hash === walletHash,
      );
      if (existsSameHashWallet) {
        // localDb.buildCreateHDAndHWWalletResult({
        //   walletId: existsSameHashWallet.id,
        //   addedHdAccountIndex:
        // })
        // DO NOT throw error, just return the exists wallet, so v4 migration can continue
        // throw new Error('Wallet with the same mnemonic hash already exists');
        return { wallet: existsSameHashWallet };
      }
    }

    const result = await localDb.createHDWallet({
      password,
      rs,
      backuped: false,
      avatar: avatarInfo ?? randomAvatar(),
      name,
      walletHash,
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
    hideImmediately,
  }: {
    walletId: IDBWalletId;
    isTemp: boolean;
    hideImmediately?: boolean;
  }) {
    const result = await localDb.setWalletTempStatus({
      walletId,
      isTemp,
      hideImmediately,
    });
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async setWalletNameAndAvatar(params: IDBSetWalletNameAndAvatarParams) {
    const result = await localDb.setWalletNameAndAvatar(params);
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    appEventBus.emit(EAppEventBusNames.WalletRename, {
      walletId: params.walletId,
    });
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
    // await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
    //   walletId,
    // });
    //  OK-26980 remove account without password
    if (account) {
      const accountId = account.id;
      await localDb.removeAccount({ accountId, walletId });
      await this.backgroundApi.serviceDApp.removeDappConnectionAfterAccountRemove(
        { accountId },
      );
    }
    if (indexedAccount) {
      await localDb.removeIndexedAccount({
        indexedAccountId: indexedAccount.id,
        walletId,
      });
      await this.backgroundApi.serviceDApp.removeDappConnectionAfterAccountRemove(
        { indexedAccountId: indexedAccount.id },
      );
    }

    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    appEventBus.emit(EAppEventBusNames.AccountRemove, undefined);

    if (
      account &&
      accountUtils.isExternalAccount({
        accountId: account.id,
      })
    ) {
      await this.backgroundApi.serviceDappSide.disconnectExternalWallet({
        account,
      });
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
    await this.backgroundApi.serviceDApp.removeDappConnectionAfterWalletRemove({
      walletId,
    });
    return result;
  }

  @backgroundMethod()
  async getAccountXpub({
    accountId,
    networkId,
    dbAccount,
  }: {
    accountId: string;
    networkId: string;
    dbAccount?: IDBAccount;
  }) {
    if (networkUtils.isAllNetwork({ networkId })) {
      return '';
    }

    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });

    const xpub = await vault.getAccountXpub({ dbAccount });

    return xpub;
  }

  // Get Address for each chain when request the API
  @backgroundMethod()
  async getAccountAddressForApi({
    dbAccount,
    accountId,
    networkId,
  }: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
  }) {
    if (networkUtils.isAllNetwork({ networkId })) {
      return ALL_NETWORK_ACCOUNT_MOCK_ADDRESS;
    }
    const account = await this.getAccount({ accountId, networkId, dbAccount });
    if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
      return account.addressDetail.normalizedAddress;
    }
    return account.address;
  }

  @backgroundMethod()
  async getHDAccountMnemonic({
    walletId,
    reason,
  }: {
    walletId: string;
    reason?: EReasonForNeedPassword;
  }) {
    if (!accountUtils.isHdWallet({ walletId })) {
      throw new Error('getHDAccountMnemonic ERROR: Not a HD account');
    }
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
        reason,
      });
    const credential = await localDb.getCredential(walletId);
    let mnemonic = mnemonicFromEntropy(credential.credential, password);
    mnemonic = await this.backgroundApi.servicePassword.encodeSensitiveText({
      text: mnemonic,
    });
    return { mnemonic };
  }

  @backgroundMethod()
  async getTonImportedAccountMnemonic({ accountId }: { accountId: string }) {
    if (!accountUtils.isImportedAccount({ accountId })) {
      throw new Error(
        'getTonImportedAccountMnemonic ERROR: Not a Ton Imported account',
      );
    }
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.Security,
      });
    const credential = await localDb.getCredential(
      accountUtils.buildTonMnemonicCredentialId({
        accountId,
      }),
    );
    let mnemonic = tonMnemonicFromEntropy(credential.credential, password);
    mnemonic = await this.backgroundApi.servicePassword.encodeSensitiveText({
      text: mnemonic,
    });
    return { mnemonic };
  }

  @backgroundMethod()
  async hasTonImportedAccountMnemonic({ accountId }: { accountId: string }) {
    try {
      const credential = await localDb.getCredential(
        accountUtils.buildTonMnemonicCredentialId({
          accountId,
        }),
      );
      return !!credential;
    } catch {
      return false;
    }
  }

  @backgroundMethod()
  async canAutoCreateAddressInSilentMode({
    walletId,
    networkId,
    deriveType,
  }: {
    walletId: string;
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }) {
    if (
      // !networkUtils.isAllNetwork({ networkId }) && // all network cost too much time
      accountUtils.isHdWallet({ walletId })
    ) {
      const pwd = await this.backgroundApi.servicePassword.getCachedPassword();
      if (pwd) {
        const map =
          await this.backgroundApi.serviceNetwork.getDeriveInfoMapOfNetwork({
            networkId,
          });
        const deriveInfo = map?.[deriveType as 'default'];
        if (deriveInfo) {
          return true;
        }
      }
    }
    return false;
  }

  @backgroundMethod()
  @toastIfError()
  async verifyHWAccountAddresses(params: {
    walletId: string;
    networkId: string;
    indexes?: Array<number>;
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes;
    confirmOnDevice?: EConfirmOnDeviceType;
  }): Promise<string[]> {
    const { prepareParams, deviceParams, networkId, walletId } =
      await this.getPrepareHDOrHWAccountsParams(params);

    prepareParams.isVerifyAddressAction = true;

    const vault = await vaultFactory.getWalletOnlyVault({
      networkId,
      walletId,
    });

    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
    // getHWAccountAddresses
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const addresses = await vault.keyring.batchGetAddresses(prepareParams);
        if (!isEmpty(addresses)) {
          return addresses.map((address) => address.address);
        }

        // const accounts = await vault.keyring.prepareAccounts(prepareParams);
        const { accountsForCreate } =
          await this.backgroundApi.serviceBatchCreateAccount.previewBatchBuildAccounts(
            {
              walletId,
              networkId,
              deriveType: params.deriveType,
              indexes: prepareParams.indexes,
              showOnOneKey: true,
              isVerifyAddressAction: prepareParams.isVerifyAddressAction,
            },
          );
        const results: string[] = [];
        for (let i = 0; i < accountsForCreate.length; i += 1) {
          const account = accountsForCreate[i];
          if (vaultSettings.accountType === EDBAccountType.VARIANT) {
            const address = (account as IDBVariantAccount).addresses[networkId];
            if (address) {
              results.push(address);
            } else {
              const addressInfo = await vault.buildAccountAddressDetail({
                networkId,
                account,
                networkInfo: await vault.getNetworkInfo(),
              });
              results.push(addressInfo.displayAddress);
            }
          } else {
            results.push(account.address);
          }
        }

        return results;
      },
      {
        deviceParams,
        skipDeviceCancelAtFirst: true,
        debugMethodName: 'verifyHWAccountAddresses.prepareAccounts',
      },
    );
  }

  @backgroundMethod()
  async insertWalletOrder({
    targetWalletId,
    startWalletId,
    endWalletId,
    emitEvent,
  }: {
    targetWalletId: string;
    startWalletId: string | undefined;
    endWalletId: string | undefined;
    emitEvent?: boolean;
  }) {
    const checkIsNotHiddenWallet = (wallet: IDBWallet | undefined) => {
      if (wallet && accountUtils.isHwHiddenWallet({ wallet })) {
        throw new Error(
          'insertWalletOrder ERROR: Not supported for HW hidden wallet',
        );
      }
    };

    const targetWallet = await localDb.getWalletSafe({
      walletId: targetWalletId,
    });
    checkIsNotHiddenWallet(targetWallet);

    const startWallet = await localDb.getWalletSafe({
      walletId: startWalletId || '',
    });
    checkIsNotHiddenWallet(startWallet);

    const endWallet = await localDb.getWalletSafe({
      walletId: endWalletId || '',
    });
    checkIsNotHiddenWallet(endWallet);

    const startOrder = startWallet?.walletOrder ?? 0;
    const endOrder = endWallet?.walletOrder ?? startOrder + 1;
    await localDb.updateWalletOrder({
      walletId: targetWalletId,
      walletOrder: (startOrder + endOrder) / 2,
    });

    if (emitEvent) {
      // force UI re-render, may cause performance issue
      appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    }
  }

  @backgroundMethod()
  async insertIndexedAccountOrder({
    targetIndexedAccountId,
    startIndexedAccountId,
    endIndexedAccountId,
    emitEvent,
  }: {
    targetIndexedAccountId: string;
    startIndexedAccountId: string | undefined;
    endIndexedAccountId: string | undefined;
    emitEvent?: boolean;
  }) {
    // const targetIndexedAccount = await localDb.getIndexedAccountSafe({
    //   id: targetIndexedAccountId,
    // });

    const startIndexedAccount = await localDb.getIndexedAccountSafe({
      id: startIndexedAccountId || '',
    });

    const endIndexedAccount = await localDb.getIndexedAccountSafe({
      id: endIndexedAccountId || '',
    });

    const startOrder = startIndexedAccount?.order ?? 0;
    const endOrder = endIndexedAccount?.order ?? startOrder + 1;

    await localDb.updateIndexedAccountOrder({
      indexedAccountId: targetIndexedAccountId,
      order: (startOrder + endOrder) / 2,
    });

    if (emitEvent) {
      // force UI re-render, may cause performance issue
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    }
  }

  @backgroundMethod()
  async insertAccountOrder({
    targetAccountId,
    startAccountId,
    endAccountId,
    emitEvent,
  }: {
    targetAccountId: string;
    startAccountId: string | undefined;
    endAccountId: string | undefined;
    emitEvent?: boolean;
  }) {
    // const targetAccount = await localDb.getAccountSafe({
    //   accountId: targetAccountId,
    // });

    const startAccount = await localDb.getAccountSafe({
      accountId: startAccountId || '',
    });

    const endAccount = await localDb.getAccountSafe({
      accountId: endAccountId || '',
    });

    const startOrder = startAccount?.accountOrder ?? 0;
    const endOrder = endAccount?.accountOrder ?? startOrder + 1;

    await localDb.updateAccountOrder({
      accountId: targetAccountId,
      order: (startOrder + endOrder) / 2,
    });

    if (emitEvent) {
      // force UI re-render, may cause performance issue
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    }
  }

  @backgroundMethod()
  async getNetworkAccountsInSameIndexedAccountId({
    indexedAccountId,
    networkIds,
  }: {
    indexedAccountId: string;
    networkIds: string[];
  }): Promise<
    {
      network: IServerNetwork;
      accountDeriveType: IAccountDeriveTypes;
      account?: INetworkAccount;
    }[]
  > {
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.serviceAccount__getNetworkAccountsInSameIndexedAccountId,
    });

    perf.markStart('getAccountsInSameIndexedAccountId');
    const { serviceNetwork } = this.backgroundApi;
    const dbAccounts = await this.getAccountsInSameIndexedAccountId({
      indexedAccountId,
    });
    perf.markEnd('getAccountsInSameIndexedAccountId');

    perf.markStart('processAllNetworksAccounts');
    const result = await Promise.all(
      networkIds.map(async (networkId) => {
        const perfEachAccount = perfUtils.createPerf({
          name: EPerformanceTimerLogNames.serviceAccount__getNetworkAccountsInSameIndexedAccountId_EachAccount,
        });

        perfEachAccount.markStart('getCompatibleAccount');
        const dbAccount = dbAccounts.find((account) =>
          accountUtils.isAccountCompatibleWithNetwork({
            account,
            networkId,
          }),
        );
        perfEachAccount.markEnd('getCompatibleAccount');

        let account: INetworkAccount | undefined;

        perfEachAccount.markStart('getNetwork');
        const network = await serviceNetwork.getNetwork({ networkId });
        perfEachAccount.markEnd('getNetwork');

        perfEachAccount.markStart('getGlobalDeriveTypeOfNetwork');
        const accountDeriveType =
          await serviceNetwork.getGlobalDeriveTypeOfNetwork({ networkId });
        perfEachAccount.markEnd('getGlobalDeriveTypeOfNetwork');

        if (dbAccount) {
          perfEachAccount.markStart('getNetworkAccount');
          try {
            account = await this.getNetworkAccount({
              dbAccount,
              accountId: undefined,
              networkId,
              deriveType: accountDeriveType,
              indexedAccountId: dbAccount.indexedAccountId,
            });
          } catch {
            console.log('failed to get Network account');
          }
          perfEachAccount.markEnd('getNetworkAccount');
        }

        perfEachAccount.done();
        return { network, accountDeriveType, account };
      }),
    );
    perf.markEnd('processAllNetworksAccounts');

    perf.done();

    return result;
  }

  @backgroundMethod()
  async getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes({
    networkId,
    indexedAccountId,
  }: {
    networkId: string;
    indexedAccountId: string;
  }) {
    const { serviceNetwork } = this.backgroundApi;
    const network = await serviceNetwork.getNetworkSafe({ networkId });
    if (!network) {
      throw new Error('Network not found');
    }
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const vaultSettings = await vault.getVaultSettings();
    const accountDeriveTypes = Object.entries(
      vaultSettings.accountDeriveInfo,
    ).map(([deriveType, deriveInfo]) => ({
      deriveType: deriveType as IAccountDeriveTypes,
      deriveInfo,
    }));
    const networkAccounts = await Promise.all(
      accountDeriveTypes.map(async (item) => {
        let resp: { accounts: INetworkAccount[] } | undefined;
        try {
          resp = await this.getAccountsByIndexedAccounts({
            indexedAccountIds: [indexedAccountId],
            networkId,
            deriveType: item.deriveType,
          });
        } catch (e) {
          // fail to get account
        }
        return {
          deriveType: item.deriveType,
          deriveInfo: item.deriveInfo,
          account: resp?.accounts[0],
        };
      }),
    );
    return { networkAccounts, network };
  }

  @backgroundMethod()
  async getAccountAddressType({
    accountId,
    networkId,
    address,
  }: {
    accountId: string;
    networkId: string;
    address: string;
  }) {
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.getAddressType({ address });
  }

  @backgroundMethod()
  async createAddressIfNotExists(
    {
      walletId,
      networkId,
      accountId,
      indexedAccountId,
    }: {
      walletId: string;
      networkId: string;
      accountId?: string;
      indexedAccountId?: string;
    },
    { allowWatchAccount }: { allowWatchAccount?: boolean },
  ) {
    if (!accountId && !indexedAccountId) {
      throw new Error('accountId or indexedAccountId is required');
    }

    const { serviceNetwork, serviceAccount } = this.backgroundApi;
    const deriveType = await serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId,
    });

    const showSwitchAccountSelector = () => {
      appEventBus.emit(EAppEventBusNames.ShowSwitchAccountSelector, {
        networkId,
      });
    };

    if (
      !allowWatchAccount &&
      accountUtils.isWatchingAccount({
        accountId: accountId ?? '',
      })
    ) {
      showSwitchAccountSelector();
      return undefined;
    }

    if (indexedAccountId) {
      try {
        const result = await serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId,
          networkId,
          deriveType,
        });
        return result;
      } catch (error) {
        const isCreated = await new Promise<boolean>((resolve, reject) => {
          const promiseId = this.backgroundApi.servicePromise.createCallback({
            resolve,
            reject,
          });
          appEventBus.emit(EAppEventBusNames.CreateAddressByDialog, {
            networkId,
            indexedAccountId,
            deriveType,
            promiseId,
            autoCreateAddress: accountUtils.isHdWallet({ walletId }),
          });
        });
        if (!isCreated) {
          return undefined;
        }
        const result = await serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId,
          networkId,
          deriveType,
        });
        return result;
      }
    }

    if (accountId) {
      try {
        const result = await serviceAccount.getNetworkAccount({
          accountId,
          indexedAccountId: undefined,
          networkId,
          deriveType,
        });
        return result;
      } catch (error) {
        showSwitchAccountSelector();
      }
    }
    return undefined;
  }
}

export default ServiceAccount;
