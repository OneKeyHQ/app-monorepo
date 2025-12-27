import { EFirmwareType } from '@onekeyfe/hd-shared';
import { Semaphore } from 'async-mutex';
import { ethers } from 'ethers';
import { debounce, isEmpty, isNil, uniq, uniqBy } from 'lodash';

import { convertLtcXpub } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { IBip39RevealableSeedEncryptHex } from '@onekeyhq/core/src/secret';
import {
  decodeSensitiveTextAsync,
  decryptImportedCredential,
  decryptRevealableSeed,
  encryptImportedCredential,
  ensureSensitiveTextEncoded,
  mnemonicFromEntropy,
  revealEntropyToMnemonic,
  revealableSeedFromMnemonic,
  revealableSeedFromTonMnemonic,
  sha256,
  tonMnemonicFromEntropy,
  tonValidateMnemonic,
  validateMnemonic,
} from '@onekeyhq/core/src/secret';
import type {
  EAddressEncodings,
  ICoreCredentialsInfo,
  ICoreHyperLiquidAgentCredential,
  ICoreImportedCredential,
  IExportKeyType,
} from '@onekeyhq/core/src/types';
import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ALL_NETWORK_ACCOUNT_MOCK_ADDRESS } from '@onekeyhq/shared/src/consts/addresses';
import { BTC_FIRST_TAPROOT_PATH } from '@onekeyhq/shared/src/consts/chainConsts';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import type { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  COINTYPE_ALLNETWORKS,
  COINTYPE_STC,
  FIRST_EVM_ADDRESS_PATH,
  IMPL_ALLNETWORKS,
  IMPL_BTC,
  IMPL_EVM,
  IMPL_LTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  InvalidMnemonic,
  OneKeyError,
  OneKeyInternalError,
  OneKeyLocalError,
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
import type {
  IChangeHistoryItem,
  IChangeHistoryUpdateItem,
} from '@onekeyhq/shared/src/types/changeHistory';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import cloudSyncUtils from '@onekeyhq/shared/src/utils/cloudSyncUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import { randomAvatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IBatchCreateAccount,
  IHwQrWalletWithDevice,
  INetworkAccount,
  IQrWalletAirGapAccount,
} from '@onekeyhq/shared/types/account';
import type { IGeneralInputValidation } from '@onekeyhq/shared/types/address';
import type {
  IDeviceSharedCallParams,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';
import {
  EConfirmOnDeviceType,
  EHardwareCallContext,
} from '@onekeyhq/shared/types/device';
import type { IExternalConnectWalletResult } from '@onekeyhq/shared/types/externalWallet.types';
import type {
  IPrimeTransferAccount,
  IPrimeTransferPublicData,
  IPrimeTransferPublicDataWalletDetail,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { EDBAccountType } from '../../dbs/local/consts';
import localDb from '../../dbs/local/localDb';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import {
  EIndexedDBBucketNames,
  type IDBAccount,
  type IDBAddress,
  type IDBCreateHwWalletParams,
  type IDBCreateHwWalletParamsBase,
  type IDBCreateQRWalletParams,
  type IDBCredentialBase,
  type IDBDevice,
  type IDBEnsureAccountNameNotDuplicateParams,
  type IDBExternalAccount,
  type IDBGetWalletsParams,
  type IDBIndexedAccount,
  type IDBRemoveWalletParams,
  type IDBSetAccountNameParams,
  type IDBSetUniversalIndexedAccountNameParams,
  type IDBSetWalletNameAndAvatarParams,
  type IDBUtxoAccount,
  type IDBVariantAccount,
  type IDBWallet,
  type IDBWalletId,
  type IDBWalletIdSingleton,
} from '../../dbs/local/types';
import simpleDb from '../../dbs/simple/simpleDb';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { v4CoinTypeToNetworkId } from '../../migrations/v4ToV5Migration/v4CoinTypeToNetworkId';
import {
  devSettingsPersistAtom,
  hardwareWalletXfpStatusAtom,
  indexedAccountAddressCreationStateAtom,
  primePersistAtom,
} from '../../states/jotai/atoms';
import { hardwareForceTransportAtom } from '../../states/jotai/atoms/desktopBluetooth';
import { vaultFactory } from '../../vaults/factory';
import { getVaultSettings } from '../../vaults/settings';
import ServiceBase from '../ServiceBase';

import type { ISimpleDBAppStatus } from '../../dbs/simple/entity/SimpleDbEntityAppStatus';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
  IHwAllNetworkPrepareAccountsResponse,
  IPrepareHDOrHWAccountChainExtraParams,
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
  createAllDeriveTypes?: boolean;

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
      void this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      void this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.AccountUpdate, () => {
      void this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.RenameDBAccounts, () => {
      void this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.WalletRename, () => {
      void this.clearAccountCache();
    });
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, () => {
      void this.clearAccountCache();
    });
  }

  @backgroundMethod()
  async clearAccountCache() {
    this.getIndexedAccountWithMemo.clear();
    this.getAccountNameFromAddressMemo.clear();
    localDb.clearStoreCachedData();
  }

  @backgroundMethod()
  async resetIndexedAccountAddressCreationState() {
    await indexedAccountAddressCreationStateAtom.set(undefined);
  }

  @backgroundMethod()
  @toastIfError()
  async validateMnemonic(mnemonic: string): Promise<{
    mnemonic: string;
    mnemonicType: EMnemonicType;
  }> {
    ensureSensitiveTextEncoded(mnemonic);
    const realMnemonic = await decodeSensitiveTextAsync({
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

  private async shouldIncludeWalletButNotKeyless(
    wallet: IDBWallet,
  ): Promise<boolean> {
    const isKeylessWallet = accountUtils.isKeylessWallet({
      walletId: wallet.id,
    });
    if (!isKeylessWallet) {
      return true;
    }
    let expectedId: string | undefined;
    if (expectedId === undefined) {
      const { keylessWalletId: packSetId } = await primePersistAtom.get();
      expectedId = packSetId
        ? accountUtils.buildKeylessWalletId({ sharePackSetId: packSetId })
        : undefined;
    }
    if (!expectedId) {
      return false;
    }
    return wallet.id === expectedId;
  }

  @backgroundMethod()
  async getWallet({ walletId }: { walletId: string }): Promise<IDBWallet> {
    const wallet = await localDb.getWallet({ walletId });
    const shouldInclude = await this.shouldIncludeWalletButNotKeyless(wallet);
    if (!shouldInclude) {
      throw new OneKeyError('KeylessWallet not found', {
        code: EOneKeyErrorClassNames.OneKeyError,
      });
    }
    return wallet;
  }

  @backgroundMethod()
  async checkIsWalletNotBackedUp({
    walletId,
  }: {
    walletId: string;
  }): Promise<boolean> {
    try {
      const resp = await new Promise<boolean>((resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        appEventBus.emit(EAppEventBusNames.CheckWalletBackupStatus, {
          promiseId,
          walletId,
        });
      });
      return !resp;
    } catch (e) {
      return true;
    }
  }

  @backgroundMethod()
  async getWalletSafe({
    walletId,
    withoutRefill,
  }: {
    walletId: string;
    withoutRefill?: boolean;
  }): Promise<IDBWallet | undefined> {
    const wallet = await localDb.getWalletSafe({ walletId, withoutRefill });
    if (!wallet) {
      return undefined;
    }
    const shouldInclude = await this.shouldIncludeWalletButNotKeyless(wallet);
    if (!shouldInclude) {
      return undefined;
    }
    return wallet;
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

  async getAllWallets(
    params: { refillWalletInfo?: boolean; excludeKeylessWallet?: boolean } = {},
  ) {
    const { excludeKeylessWallet = false } = params;
    let { wallets } = await localDb.getAllWallets();
    let allDevices: IDBDevice[] | undefined;
    if (params.refillWalletInfo) {
      allDevices = (await this.getAllDevices()).devices;
      const refilledWalletsCache: {
        [walletId: string]: IDBWallet;
      } = {};
      wallets = await Promise.all(
        wallets.map((wallet) =>
          localDb.refillWalletInfo({
            wallet,
            refilledWalletsCache,
            allDevices,
          }),
        ),
      );
    }
    // Filter out keyless wallets if excludeKeylessWallet is true
    if (excludeKeylessWallet) {
      wallets = wallets.filter(
        (wallet) =>
          !accountUtils.isKeylessWallet({
            walletId: wallet.id,
          }),
      );
    }
    return { wallets, allDevices };
  }

  @backgroundMethod()
  async getWallets(options?: IDBGetWalletsParams): Promise<{
    wallets: IDBWallet[];
  }> {
    const r = await localDb.getWallets(options);

    const wallets: IDBWallet[] = [];
    for (const wallet of r.wallets) {
      const shouldInclude = await this.shouldIncludeWalletButNotKeyless(wallet);
      if (shouldInclude) {
        wallets.push(wallet);
      }
    }

    return {
      ...r,
      wallets,
    };
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
  async getAllHwQrWalletWithDevice(params?: {
    filterQrWallet?: boolean;
    filterHiddenWallet?: boolean;
    skipDuplicateDevice?: boolean;
  }) {
    const { wallets, allDevices } = await this.getAllWallets({
      refillWalletInfo: true,
      excludeKeylessWallet: true,
    });

    const filterQrWallet = params?.filterQrWallet ?? false;
    const filterHiddenWallet = params?.filterHiddenWallet ?? false;
    const skipDuplicateDevice = params?.skipDuplicateDevice ?? false;

    const result: {
      [walletId: string]: IHwQrWalletWithDevice;
    } = {};

    // Map of deviceId -> walletId for hardware wallets
    const deviceToHwWalletMap: Record<string, string> = {};

    // Collect all hardware wallet device IDs if skip duplication is enabled
    if (skipDuplicateDevice) {
      for (const wallet of wallets) {
        if (
          accountUtils.isHwWallet({ walletId: wallet.id }) &&
          !accountUtils.isHwHiddenWallet({ wallet }) &&
          wallet.associatedDevice
        ) {
          deviceToHwWalletMap[wallet.associatedDevice] = wallet.id;
        }
      }
    }

    for (const wallet of wallets) {
      const isHiddenWallet = accountUtils.isHwHiddenWallet({ wallet });
      const isHwWallet = accountUtils.isHwWallet({ walletId: wallet.id });
      const isQrWallet = accountUtils.isQrWallet({ walletId: wallet.id });

      // Check if this wallet should be included in the result
      const isValidWalletType = isHwWallet || isQrWallet;
      const passesHiddenWalletFilter = !filterHiddenWallet || !isHiddenWallet;
      const passesQrWalletFilter = !filterQrWallet || !isQrWallet;
      const passesDeviceDuplicationCheck = !(
        skipDuplicateDevice &&
        isQrWallet &&
        wallet.associatedDevice &&
        deviceToHwWalletMap[wallet.associatedDevice]
      );

      // Only add wallet to result if it passes all checks
      if (
        isValidWalletType &&
        passesHiddenWalletFilter &&
        passesQrWalletFilter &&
        passesDeviceDuplicationCheck
      ) {
        const device = (allDevices ?? []).find(
          (d) => d.id === wallet.associatedDevice,
        );
        result[wallet.id] = {
          wallet,
          device,
        };
      }
    }

    return result;
  }

  @backgroundMethod()
  async existsHwStandardWallet({
    connectId,
    deviceId,
  }: {
    connectId: string;
    deviceId: string;
  }) {
    const device = await this.backgroundApi.localDb.getDeviceByQuery({
      connectId,
      featuresDeviceId: deviceId,
    });
    if (!device) {
      return false;
    }

    const standardWallets =
      await this.backgroundApi.localDb.getNormalHwWalletInSameDevice({
        associatedDevice: device.id,
        excludeMocked: true,
      });

    return standardWallets.length > 0;
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
        let accountId = credential.id;
        if (accountUtils.isTonMnemonicCredentialId(credential.id)) {
          accountId = accountUtils.getAccountIdFromTonMnemonicCredentialId({
            credentialId: credential.id,
          });
        }
        const account = await this.getDBAccountSafe({
          accountId,
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
    const rs = await decryptRevealableSeed({
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
    customReceiveAddressPath,
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
    customReceiveAddressPath?: string;
  }) {
    if (!walletId) {
      throw new OneKeyLocalError('walletId is required');
    }
    if (!networkId) {
      throw new OneKeyLocalError('networkId is required');
    }
    if (!deriveType) {
      throw new OneKeyLocalError('deriveType is required');
    }
    const { isHardware, password, deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
        reason: EReasonForNeedPassword.Default,
      });

    const wallet = await this.getWalletSafe({
      walletId,
    });
    if (password && wallet && accountUtils.isHdWallet({ walletId })) {
      if (!accountUtils.isValidWalletXfp({ xfp: wallet.xfp })) {
        setTimeout(async () => {
          await this.generateHDWalletMissingHashAndXfp({
            password,
            hdWallets: [wallet].filter(Boolean),
          });
        }, 1000);
      }
    }

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

    const chainExtraParams = await this.prepareHDOrHWAccountChainExtraParams({
      networkId,
      indexedAccountId,
      deriveType,
      customReceiveAddressPath,
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
        chainExtraParams,
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
    indexedAccountNames,
    skipEventEmit,
  }: {
    walletId: string;
    networkId: string;
    account: IBatchCreateAccount;
    indexedAccountNames?: {
      [index: number]: string;
    };
    skipEventEmit?: boolean;
  }) {
    const {
      addressDetail: _addressDetail,
      existsInDb: _existsInDb,
      displayAddress: _displayAddress,
      ...dbAccount
    } = account;
    if (isNil(dbAccount.pathIndex)) {
      throw new OneKeyLocalError(
        'addBatchCreatedHdOrHwAccount ERROR: pathIndex is required',
      );
    }
    await this.addIndexedAccount({
      walletId,
      indexes: [dbAccount.pathIndex],
      skipIfExists: true,
      names: indexedAccountNames,
    });
    await localDb.addAccountsToWallet({
      allAccountsBelongToNetworkId: networkId,
      walletId,
      accounts: [dbAccount],
      skipEventEmit,
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
    const wallet = await this.getWalletSafe({ walletId });
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
    const { existsAccounts } = await localDb.addAccountsToWallet({
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
        const isAccountExists = existsAccounts.some(
          (existsAccount) => existsAccount.id === account.id,
        );
        if (!isAccountExists) {
          if (wallet?.xfp && account.indexedAccountId) {
            await this.setUniversalIndexedAccountName({
              name: account.name,
              indexedAccountId: account.indexedAccountId,
              index: accountUtils.parseIndexedAccountId({
                indexedAccountId: account.indexedAccountId,
              }).index,
              walletXfp: wallet.xfp,
            });
          } else {
            await this.setAccountName({
              name: account.name,
              indexedAccountId: account.indexedAccountId,
            });
          }
        }
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
  }: {
    accountId: string | undefined;
    indexedAccountId: string | undefined;
    networkId: string;
    deriveType: IAccountDeriveTypes | undefined;
    exportType: IExportKeyType;
    accountName: string | undefined;
  }) {
    if (!accountId && !indexedAccountId) {
      throw new OneKeyLocalError('accountId or indexedAccountId is required');
    }
    if (accountId && indexedAccountId) {
      throw new OneKeyLocalError(
        'accountId and indexedAccountId can not be used at the same time',
      );
    }
    let dbAccountId = accountId;
    if (indexedAccountId) {
      if (!deriveType) {
        throw new OneKeyLocalError('deriveType required');
      }
      dbAccountId = await this.getDbAccountIdFromIndexedAccountId({
        indexedAccountId,
        networkId,
        deriveType,
      });
    }
    if (!dbAccountId) {
      throw new OneKeyLocalError('dbAccountId required');
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
      throw new OneKeyLocalError(
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
      // throw new OneKeyLocalError(
      //   appLocale.intl.formatMessage({
      //     id: ETranslations.hardware_not_support,
      //   }),
      // );
      throw new OneKeyLocalError('Export keyType not found for the network');
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
    throw new OneKeyLocalError(
      `exportType not supported: ${String(exportType)}`,
    );
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
        throw new OneKeyLocalError(
          'exportAccountPublicKey ERROR: account not found',
        );
      }
      let publicKey: string | undefined;
      if (keyType === ECoreApiExportedSecretKeyType.publicKey) {
        publicKey = account?.pub;
      }
      if (keyType === ECoreApiExportedSecretKeyType.xpub) {
        publicKey = (account as IDBUtxoAccount | undefined)?.xpub;
      }
      if (!publicKey) {
        throw new OneKeyLocalError('publicKey not found');
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
      const { prepareParams } = await this.getPrepareHDOrHWAccountsParams({
        walletId,
        networkId,
        indexedAccountId,
        deriveType,
        confirmOnDevice: EConfirmOnDeviceType.EveryItem,
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

  async prepareHyperLiquidAgentCredential(
    params: ICoreHyperLiquidAgentCredential,
  ) {
    ensureSensitiveTextEncoded(params.privateKey);
    const decodedPrivateKey = await decodeSensitiveTextAsync({
      encodedText: params.privateKey,
    });
    const agentWallet = new ethers.Wallet(decodedPrivateKey);
    const credential: ICoreHyperLiquidAgentCredential = {
      userAddress: params.userAddress,
      agentName: params.agentName,
      privateKey: decodedPrivateKey,
      agentAddress: agentWallet.address,
      validUntil: params.validUntil,
    };
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify({
        reason: EReasonForNeedPassword.Default,
      });
    return {
      credential,
      password,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async addOrUpdateHyperLiquidAgentCredential(
    params: ICoreHyperLiquidAgentCredential,
  ): Promise<{
    credentialId: string;
  }> {
    try {
      return await this.addHyperLiquidAgentCredential(params);
    } catch (error) {
      return this.updateHyperLiquidAgentCredential(params);
    }
  }

  @backgroundMethod()
  @toastIfError()
  async addHyperLiquidAgentCredential(
    params: ICoreHyperLiquidAgentCredential,
  ): Promise<{
    credentialId: string;
  }> {
    const { credential, password } =
      await this.prepareHyperLiquidAgentCredential(params);
    const { credentialId } = await localDb.addHyperLiquidAgentCredential({
      credential,
      password,
    });
    return {
      credentialId,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async updateHyperLiquidAgentCredential(
    params: ICoreHyperLiquidAgentCredential,
  ): Promise<{
    credentialId: string;
  }> {
    const { credential, password } =
      await this.prepareHyperLiquidAgentCredential(params);
    const { credentialId } = await localDb.updateHyperLiquidAgentCredential({
      credential,
      password,
    });
    return {
      credentialId,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async getHyperLiquidAgentCredential({
    userAddress,
    agentName,
  }: {
    userAddress: string;
    agentName: EHyperLiquidAgentName;
  }): Promise<ICoreHyperLiquidAgentCredential | undefined> {
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify({
        reason: EReasonForNeedPassword.Default,
      });
    return localDb.getHyperLiquidAgentCredential({
      userAddress,
      agentName,
      password,
    });
  }

  private extractUserAddressFromCredentialId(credentialId: string): string {
    // Format: hyperliquid-agent--{userAddress}--{agentName}
    const parts = credentialId.split('--');
    if (
      parts.length !== 3 ||
      parts[0] !==
        accountUtils.HYPERLIQUID_AGENT_CREDENTIAL_PREFIX.replace('--', '')
    ) {
      throw new OneKeyLocalError(
        `Invalid HyperLiquid agent credential ID format: ${credentialId}`,
      );
    }
    return parts[1]; // userAddress
  }

  private async shouldDeleteCredential({
    addressRecord,
    deletedInfo,
  }: {
    addressRecord: IDBAddress | null;
    deletedInfo: {
      walletId?: string;
      indexedAccountId?: string;
      accountId?: string;
    };
  }): Promise<boolean> {
    if (!addressRecord) {
      return false;
    }

    // Check if the deleted wallet is in the address record's wallets
    if (deletedInfo.walletId && addressRecord.wallets[deletedInfo.walletId]) {
      return true;
    }

    // Check if any of the wallet values match deleted account/indexedAccount IDs
    if (deletedInfo.accountId || deletedInfo.indexedAccountId) {
      const walletValues = Object.values(addressRecord.wallets);
      if (
        (deletedInfo.accountId &&
          walletValues.includes(deletedInfo.accountId)) ||
        (deletedInfo.indexedAccountId &&
          walletValues.includes(deletedInfo.indexedAccountId))
      ) {
        return true;
      }
    }

    return false;
  }

  @backgroundMethod()
  async cleanupOrphanedHyperLiquidAgentCredentials({
    walletId,
    indexedAccountId,
    accountId,
  }: {
    walletId?: string;
    indexedAccountId?: string;
    accountId?: string;
  }): Promise<void> {
    try {
      await timerUtils.wait(1000);
      if (indexedAccountId || accountId) {
        // eslint-disable-next-line no-param-reassign
        walletId = undefined;
      }
      const deletedInfo = {
        walletId,
        indexedAccountId,
        accountId,
      };
      // Get all HyperLiquid agent credentials
      const allCredentials = await localDb.getAllHyperLiquidAgentCredentials();

      const credentialsToDelete: IDBCredentialBase[] = [];
      // Process each credential
      for (const credential of allCredentials) {
        try {
          // Extract userAddress from credential ID
          const userAddress = this.extractUserAddressFromCredentialId(
            credential.id,
          );

          // Use existing address lookup table to check if address still exists
          const addressRecord = await localDb.getAddressByNetworkImpl({
            networkId: PERPS_NETWORK_ID,
            normalizedAddress: userAddress.toLowerCase(),
          });

          // Check if this credential should be deleted
          if (
            await this.shouldDeleteCredential({
              addressRecord,
              deletedInfo,
            })
          ) {
            credentialsToDelete.push(credential);
          }
        } catch (error) {
          // Log error but continue processing other credentials
          console.warn(
            `Failed to process HyperLiquid agent credential ${credential.id}:`,
            error,
          );
        }
      }

      if (credentialsToDelete.length) {
        await localDb.removeCredentials({ credentials: credentialsToDelete });
      }
    } catch (error) {
      // Log error but don't throw to avoid breaking main deletion flow
      console.error('Failed to cleanup HyperLiquid agent credentials:', error);
    }
  }

  @backgroundMethod()
  @toastIfError()
  async addImportedAccountWithCredential({
    credential,
    networkId,
    deriveType,
    name,
    fallbackName,
    shouldCheckDuplicateName,
    skipAddIfNotEqualToAddress,
    skipEventEmit,
  }: {
    name?: string;
    fallbackName?: string;
    shouldCheckDuplicateName?: boolean;
    credential: string;
    networkId: string;
    deriveType: IAccountDeriveTypes | undefined;
    skipAddIfNotEqualToAddress?: string;
    skipEventEmit?: boolean;
  }): Promise<{
    networkId: string;
    walletId: string;
    accounts: IDBAccount[];
    isOverrideAccounts: boolean;
  }> {
    if (platformEnv.isWebDappMode) {
      throw new OneKeyLocalError(
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

    const privateKeyDecoded = await decodeSensitiveTextAsync({
      encodedText: credential,
    });

    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
        hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
      });
    const credentialEncrypt = await encryptImportedCredential({
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
      accounts?.[0]?.address?.toLowerCase() !==
        skipAddIfNotEqualToAddress?.toLowerCase()
    ) {
      return {
        networkId,
        walletId,
        accounts: [],
        isOverrideAccounts: false,
      };
    }

    const { isOverrideAccounts, existsAccounts } =
      await localDb.addAccountsToWallet({
        skipEventEmit,
        allAccountsBelongToNetworkId: networkId,
        walletId,
        accounts,
        importedCredential: credentialEncrypt,
        accountNameBuilder: ({ nextAccountId }) => {
          if (fallbackName) {
            return fallbackName;
          }
          return accountUtils.buildBaseAccountName({ nextAccountId });
        },
      });

    void this.fixAccountName({
      account: existsAccounts?.[0],
      name,
      fallbackName,
    });

    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);

    if (isOverrideAccounts && existsAccounts.length) {
      void this.addAccountNameChangeHistory({
        accounts,
        existsAccounts,
      });
    }

    return {
      networkId,
      walletId,
      accounts,
      isOverrideAccounts,
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
          connectionInfoRaw: stringUtils.stableStringify(connectionInfo),
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
        connectionInfoRaw: stringUtils.stableStringify(connectionInfo),
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

  async fixAccountName({
    account,
    name,
    fallbackName,
  }: {
    account: IDBAccount | undefined;
    name?: string;
    fallbackName?: string;
  }) {
    if (!account) {
      return;
    }
    const newName = name || fallbackName;
    if (newName && account.name !== newName) {
      await this.setAccountName({
        accountId: account.id,
        name: newName,
      });
    }
  }

  @backgroundMethod()
  @toastIfError()
  async addWatchingAccount({
    input,
    networkId,
    deriveType,
    name,
    fallbackName,
    shouldCheckDuplicateName,
    isUrlAccount,
    skipAddIfNotEqualToAddress,
    skipEventEmit,
  }: {
    input: string;
    networkId: string;
    name?: string;
    fallbackName?: string;
    shouldCheckDuplicateName?: boolean;
    deriveType?: IAccountDeriveTypes;
    isUrlAccount?: boolean;
    skipAddIfNotEqualToAddress?: string;
    skipEventEmit?: boolean;
  }): Promise<{
    networkId: string;
    walletId: string;
    accounts: IDBAccount[];
    isOverrideAccounts: boolean;
  }> {
    // eslint-disable-next-line no-param-reassign
    input = await this.backgroundApi.servicePassword.decodeSensitiveText({
      encodedText: input,
    });
    if (!input) {
      throw new OneKeyLocalError('addWatchingAccount ERROR: input not valid');
    }
    if (networkUtils.isAllNetwork({ networkId })) {
      throw new OneKeyLocalError(
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

    // eslint-disable-next-line spellcheck/spell-checker
    // /evm/0x63ac73816EeB38514DaE6c46008baf55f1c59C9e
    if (networkId === IMPL_EVM) {
      // eslint-disable-next-line no-param-reassign
      networkId = getNetworkIdsMap().eth;
    }

    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    if (!network) {
      throw new OneKeyLocalError('addWatchingAccount ERROR: network not found');
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
      throw new OneKeyLocalError('input not valid');
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
        throw new OneKeyLocalError(
          'addWatchingAccount ERROR: deriveType not correct',
        );
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
      accounts?.[0]?.address?.toLowerCase() !==
        skipAddIfNotEqualToAddress?.toLowerCase()
    ) {
      console.error('addWatchingAccount skipAddIfNotEqualToAddress', {
        skipAddIfNotEqualToAddress,
        address: accounts?.[0]?.address,
      });
      return {
        networkId,
        walletId,
        accounts: [],
        isOverrideAccounts: false,
      };
    }

    const { isOverrideAccounts, existsAccounts } =
      await localDb.addAccountsToWallet({
        skipEventEmit,
        allAccountsBelongToNetworkId: networkId,
        walletId,
        accounts,
        accountNameBuilder: ({ nextAccountId }) => {
          if (isUrlAccount) {
            return `Url Account ${Date.now()}`;
          }
          if (fallbackName) {
            return fallbackName;
          }
          return accountUtils.buildBaseAccountName({ nextAccountId });
        },
      });

    void this.fixAccountName({
      account: existsAccounts?.[0],
      name,
      fallbackName,
    });

    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);

    if (isOverrideAccounts && existsAccounts.length) {
      void this.addAccountNameChangeHistory({
        accounts,
        existsAccounts,
      });
    }
    return {
      networkId,
      walletId,
      accounts,
      isOverrideAccounts,
    };
  }

  async addAccountNameChangeHistory({
    accounts,
    existsAccounts,
  }: {
    accounts: IDBAccount[];
    existsAccounts: IDBAccount[];
  }) {
    const items: IChangeHistoryUpdateItem[] = accounts
      .map((account) => {
        const oldName =
          existsAccounts.find((item) => item.id === account.id)?.name || '';
        const newName = account.name || '';
        if (!newName || !oldName) {
          return null;
        }
        return {
          entityType: EChangeHistoryEntityType.Account,
          entityId: account.id,
          contentType: EChangeHistoryContentType.Name,
          oldValue: oldName,
          value: newName,
        };
      })
      .filter(Boolean);

    // Record the name change history
    await simpleDb.changeHistory.addChangeHistory({
      items,
    });
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
    let { accounts, removedAccountIds } =
      await localDb.getSingletonAccountsOfWallet({
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
    if (removedAccountIds?.length) {
      void localDb.removeAccountsByIds({
        ids: removedAccountIds,
      });
    }
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
    if (accountUtils.isAllNetworkMockAccount({ accountId })) {
      return undefined;
    }
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

  @backgroundMethod()
  async clearAccountNameFromAddressCache() {
    this.getAccountNameFromAddressMemo.clear();
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
    indexedAccountId,
  }: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
    indexedAccountId?: string;
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
          throw new OneKeyLocalError(
            'getAccount ERROR: realNetworkId can not be allnetwork',
          );
        }
        return this.getAccount({
          dbAccount: dbAccountUsed,
          accountId,
          networkId: checkIsDefined(realNetworkId),
        });
      }
      const newIndexedAccountId =
        indexedAccountId ||
        accountUtils.buildAllNetworkIndexedAccountIdFromAccountId({
          accountId,
        });
      const allNetworkAccount = await this.getMockedAllNetworkAccount({
        indexedAccountId: newIndexedAccountId,
      });
      if (allNetworkAccount.id !== accountId) {
        throw new OneKeyLocalError(
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
        throw new OneKeyLocalError('deriveType is required');
      }
      const { accounts } = await this.getAccountsByIndexedAccounts({
        networkId,
        deriveType,
        indexedAccountIds: [indexedAccountId],
        allDbAccounts: [dbAccount].filter(Boolean),
      });
      if (accounts[0]) {
        return accounts[0];
      }
      throw new OneKeyLocalError(
        `indexedAccounts not found: ${indexedAccountId}`,
      );
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
    let accounts: IDBAccount[] = [];

    // filter accounts match to available wallets, some account wallet or indexedAccount may be deleted
    ({ accounts } = await localDb.getAllAccounts({ ids }));

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

    let allWallets: IDBWallet[] | undefined;
    let indexedAccounts: IDBIndexedAccount[] = [];
    let indexedAccountsRemoved: IDBIndexedAccount[] = [];
    let allDevices: IDBDevice[] | undefined;

    if (filterRemoved) {
      const allWalletsResult = await this.getAllWallets({
        refillWalletInfo: true,
      });
      allWallets = allWalletsResult.wallets;
      allDevices = allWalletsResult.allDevices;
      ({ indexedAccounts, indexedAccountsRemoved } =
        await this.getAllIndexedAccounts({
          allWallets,
          filterRemoved: true,
        }));

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
              const wallet: IDBWallet | undefined = allWallets?.find(
                (o) => o.id === walletId,
              );
              if (!wallet && allWallets) {
                removedWallet[walletId] = true;
                pushRemovedAccount();
                return null;
              }
              if (wallet && localDb.isTempWalletRemoved({ wallet })) {
                removedHiddenWallet[walletId] = true;
                pushRemovedAccount();
                return null;
              }
            }
            let indexedAccount: IDBIndexedAccount | undefined;
            if (indexedAccountId) {
              if (removedIndexedAccount[indexedAccountId]) {
                pushRemovedAccount();
                return null;
              }
              indexedAccount = indexedAccounts.find(
                (o) => o.id === indexedAccountId,
              );
              if (!indexedAccount) {
                removedIndexedAccount[indexedAccountId] = true;
                pushRemovedAccount();
                return null;
              }
            }
            localDb.refillAccountInfo({ account, indexedAccount });
            return account;
          }),
        )
      ).filter(Boolean);
    }

    return {
      accounts: accountsFiltered,
      accountsRemoved,
      allWallets,
      allDevices,
      allIndexedAccounts: indexedAccounts,
      indexedAccountsRemoved,
    };
  }

  @backgroundMethod()
  async getAccountCreatedNetworkId({
    account,
  }: {
    account: {
      createAtNetwork?: string | undefined;
      networks?: string[] | undefined;
      impl: string | undefined;
      coinType: string | undefined;
    };
  }) {
    let networkId = account?.createAtNetwork || account?.networks?.[0];
    if (!networkId && account.impl) {
      const { networkIds } =
        await this.backgroundApi.serviceNetwork.getNetworkIdsByImpls({
          impls: [account.impl],
        });
      networkId = networkIds?.[0];
    }
    if (!networkId && account?.coinType) {
      networkId = v4CoinTypeToNetworkId[account.coinType];
    }
    return networkId;
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
  }): Promise<{
    accounts: IDBAccount[];
    allDbAccounts: IDBAccount[];
  }> {
    const result = await localDb.getAccountsInSameIndexedAccountId({
      indexedAccountId,
    });

    return result;
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
    allDbAccounts,
    skipDbQueryIfNotFoundFromAllDbAccounts,
    indexedAccountIds,
    networkId,
    deriveType,
  }: {
    allDbAccounts?: IDBAccount[];
    skipDbQueryIfNotFoundFromAllDbAccounts?: boolean;
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
        let dbAccount: IDBAccount | undefined;
        if (allDbAccounts?.length) {
          dbAccount = allDbAccounts?.find((o) => o.id === realDBAccountId);
          if (skipDbQueryIfNotFoundFromAllDbAccounts && !dbAccount) {
            return dbAccount;
          }
        }
        return this.getAccount({
          accountId: realDBAccountId,
          networkId,
          dbAccount,
        });
      }),
    );
    return {
      accounts: accounts.filter(Boolean),
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
    const { accountId, indexedAccountId, name } = params;

    let account: IDBAccount | undefined;
    let indexedAccount: IDBIndexedAccount | undefined;

    // Get the old name before updating
    let oldName = '';
    if (name) {
      if (accountId) {
        account = await this.getDBAccountSafe({ accountId });
        oldName = account?.name || '';
      } else if (indexedAccountId) {
        indexedAccount = await this.getIndexedAccountSafe({
          id: indexedAccountId,
        });
        oldName = indexedAccount?.name || '';
      }
    }

    if (!account && !indexedAccount) {
      return;
    }
    if (!name) {
      return;
    }
    if (oldName && name && oldName === name) {
      return;
    }

    const r = await localDb.setAccountName(params);
    if (!params.skipEventEmit) {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    }

    // Only proceed if the name is actually changing
    if (oldName && name && oldName !== name) {
      const entityType: EChangeHistoryEntityType = accountId
        ? EChangeHistoryEntityType.Account
        : EChangeHistoryEntityType.IndexedAccount;

      const entityId = accountId || indexedAccountId || '';
      // Record the name change history
      await simpleDb.changeHistory.addChangeHistory({
        items: [
          {
            entityType,
            entityId,
            contentType: EChangeHistoryContentType.Name,
            oldValue: oldName,
            value: name,
          },
        ],
      });
    }

    return r;
  }

  @backgroundMethod()
  @toastIfError()
  async setUniversalIndexedAccountName(
    params: IDBSetUniversalIndexedAccountNameParams,
  ) {
    const { index, walletXfp, name, ...others } = params;
    let wallets: IDBWallet[] = [];
    if (walletXfp) {
      wallets = await localDb.getWalletsByXfp({ xfp: walletXfp });
    } else if (params.indexedAccountId) {
      const { walletId } = accountUtils.parseIndexedAccountId({
        indexedAccountId: params.indexedAccountId,
      });
      const wallet = await this.getWalletSafe({
        walletId,
      });
      if (wallet) {
        wallets.push(wallet);
      }
    }

    if (params.shouldCheckDuplicate && params.indexedAccountId) {
      // if it is manually triggered, call the non-try-catch modification once first to ensure that the duplicate name detection takes effect and terminates the function with an error
      await this.setAccountName({
        name,
        ...others,
        indexedAccountId: params.indexedAccountId,
        skipEventEmit: true,
        skipSaveLocalSyncItem: params.skipSaveLocalSyncItem,
        shouldCheckDuplicate: params.shouldCheckDuplicate,
      });
    }

    for (const wallet of wallets) {
      try {
        const indexedAccountId = accountUtils.buildIndexedAccountId({
          walletId: wallet.id,
          index,
        });
        const isSelfAccount = indexedAccountId === params.indexedAccountId;
        await this.setAccountName({
          name,
          ...others,
          indexedAccountId,
          skipEventEmit: true,
          skipSaveLocalSyncItem: isSelfAccount
            ? params.skipSaveLocalSyncItem
            : true,
          shouldCheckDuplicate: isSelfAccount
            ? params.shouldCheckDuplicate
            : false,
        });
      } catch (e) {
        console.error('setUniversalIndexedAccountName ERROR', e);
      }
    }
    if (wallets.length && !params.skipEventEmit) {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    }
  }

  @backgroundMethod()
  async getWalletDeviceParams({
    walletId,
    hardwareCallContext,
  }: {
    walletId: string;
    hardwareCallContext: EHardwareCallContext;
  }): Promise<IDeviceSharedCallParams | undefined> {
    if (!accountUtils.isHwWallet({ walletId })) {
      return undefined;
    }

    const wallet = await this.getWallet({ walletId });
    const dbDevice = await this.getWalletDevice({ walletId });

    // Ensure connectId is compatible for the current transport type
    if (dbDevice.connectId) {
      try {
        dbDevice.connectId =
          await this.backgroundApi.serviceHardware.getCompatibleConnectId({
            connectId: dbDevice.connectId,
            featuresDeviceId: dbDevice.deviceId,
            features: dbDevice.featuresInfo,
            hardwareCallContext,
          });
      } catch (error) {
        // If getCompatibleConnectId fails, use the original connectId
        console.warn('Failed to get compatible connectId:', error);
        throw error;
      }
    }

    return {
      confirmOnDevice: EConfirmOnDeviceType.LastItem,
      dbDevice,
      dbWallet: wallet,
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
    isAttachPinMode?: boolean;
  }) {
    const dbDevice = await this.getWalletDevice({ walletId });
    const { connectId } = dbDevice;
    const compatibleConnectId =
      await this.backgroundApi.serviceHardware.getCompatibleConnectId({
        connectId,
        featuresDeviceId: dbDevice.deviceId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });

    // createHWHiddenWallet
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const passphraseState =
          await this.backgroundApi.serviceHardware.getPassphraseState({
            connectId: compatibleConnectId,
            forceInputPassphrase: true,
          });

        if (!passphraseState) {
          const deviceNotOpenedPassphraseError = new DeviceNotOpenedPassphrase({
            payload: {
              connectId: compatibleConnectId,
              deviceId: dbDevice.deviceId ?? undefined,
            },
          });
          throw deviceNotOpenedPassphraseError;
        }

        // TODO save remember states
        const features = await this.backgroundApi.serviceHardware.getFeatures({
          connectId: compatibleConnectId,
        });
        const dbWallet = await this.createHWWalletBase({
          device: deviceUtils.dbDeviceToSearchDevice(dbDevice),
          features: features || dbDevice.featuresInfo || ({} as any),
          passphraseState,
          fillingXfpByCallingSdk: true,
        });

        if (dbWallet?.wallet.id) {
          const hiddenWalletImmediately =
            await this.backgroundApi.serviceSetting.getHiddenWalletImmediately();
          await this.setWalletTempStatus({
            walletId: dbWallet.wallet.id,
            isTemp: !hiddenWalletImmediately,
          });
        }

        defaultLogger.account.wallet.walletAdded({
          status: 'success',
          addMethod: 'ConnectHWWallet',
          details: {
            deviceType: dbDevice.featuresInfo
              ? await deviceUtils.getDeviceTypeFromFeatures({
                  features: dbDevice.featuresInfo,
                })
              : undefined,
            hardwareWalletType: 'Hidden',
          },
          isSoftwareWalletOnlyUser:
            await this.backgroundApi.serviceAccountProfile.isSoftwareWalletOnlyUser(),
        });

        return {
          ...dbWallet,
          isAttachPinMode: features.unlocked_attach_pin,
        };
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
    const fullXfp = this.buildQrWalletFullXfp({
      shortXfp: params.qrDevice.xfp,
      airGapAccounts: params.airGapAccounts,
    });
    // const { name, deviceId, xfp, version } = qrDevice;
    const result = await localDb.createQrWallet({ ...params, fullXfp });
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async createHWWallet(params: IDBCreateHwWalletParamsBase) {
    // createHWWallet
    // Get forceTransportType from global atom first, otherwise fallback to current transport type setting
    const hardwareForceTransportAtomState =
      await hardwareForceTransportAtom.get();
    const transportType =
      hardwareForceTransportAtomState.forceTransportType ||
      (await this.backgroundApi.serviceSetting.getHardwareTransportType());

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      () =>
        this.createHWWalletBase({
          ...params,
          fillingXfpByCallingSdk: true,
          transportType,
        }),
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
    const {
      features,
      passphraseState,
      fillingXfpByCallingSdk,
      isMockedStandardHwWallet,
      transportType,
    } = params;
    if (!features) {
      throw new OneKeyLocalError(
        'createHWWalletBase ERROR: features is required',
      );
    }
    const compatibleConnectId =
      await this.backgroundApi.serviceHardware.getCompatibleConnectId({
        connectId: params.device.connectId ?? '',
        featuresDeviceId: params.device.deviceId ?? '',
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    const searchDeviceId = params.device.deviceId ?? '';
    const deviceId = deviceUtils.getRawDeviceId({
      device: params.device,
      features,
    });

    console.log('createHWWalletBase paramsInfo', {
      connectId: compatibleConnectId,
      deviceId,
      searchDeviceId,
    });

    let xfp: string | undefined;
    if (fillingXfpByCallingSdk && !isMockedStandardHwWallet) {
      xfp = await this.backgroundApi.serviceHardware.buildHwWalletXfp({
        connectId: compatibleConnectId,
        deviceId,
        passphraseState,
        throwError: true,
        withUserInteraction: true,
      });
      console.log('createHWWalletBase xfp', xfp, compatibleConnectId, deviceId);
    }
    // if the connectId is not compatible, maybe the device is new bluetooth connection device, refresh the device info
    if (compatibleConnectId !== params.device.connectId) {
      const refreshedDevice = await localDb.getDeviceByQuery({
        connectId: params.device.connectId || compatibleConnectId,
        featuresDeviceId: deviceId,
      });
      if (refreshedDevice) {
        params.device = refreshedDevice;
      }
    }
    const result = await localDb.createHwWallet({
      ...params,
      xfp,
      passphraseState: passphraseState || '',
      getFirstEvmAddressFn: async (): Promise<string | null> => {
        if (isMockedStandardHwWallet) {
          return '';
        }
        const r: string | null =
          await this.backgroundApi.serviceHardware.getEvmAddressByStandardWallet(
            {
              connectId: compatibleConnectId,
              deviceId,
              path: FIRST_EVM_ADDRESS_PATH,
            },
          );
        return r;
      },
      transportType,
    });
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    return result;
  }

  hdWalletHashAndXfpBuilder = async (options: {
    realMnemonic: string;
  }): Promise<{
    hash: string;
    xfp: string;
  }> => {
    const text = `${options.realMnemonic}--4863FBE1-7B9B-4006-91D0-24212CCCC375`;
    const buff = await sha256(bufferUtils.toBuffer(text, 'utf8'));
    const hash = bufferUtils.bytesToHex(buff);

    const { fullXfp: fulXfp } = await coreChainApi.btc.hd.buildXfpFromMnemonic({
      mnemonic: options.realMnemonic,
    });
    return { hash, xfp: fulXfp };
  };

  @backgroundMethod()
  async createHDWallet({
    name,
    mnemonic,
    isWalletBackedUp,
    avatarInfo,
  }: {
    mnemonic: string;
    name?: string;
    isWalletBackedUp?: boolean;
    avatarInfo?: IAvatarInfo;
  }) {
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.CreateOrRemoveWallet,
    });

    ensureSensitiveTextEncoded(mnemonic); // TODO also add check for imported account

    const { mnemonic: realMnemonic, mnemonicType } =
      await this.validateMnemonic(mnemonic);

    if (mnemonicType === EMnemonicType.TON) {
      throw new OneKeyLocalError('TON mnemonic is not supported');
    }

    await this.generateAllHdAndQrWalletsHashAndXfp({ password });

    const walletHashAndXfp = await this.hdWalletHashAndXfpBuilder({
      realMnemonic,
    });

    let rs: IBip39RevealableSeedEncryptHex | undefined;
    try {
      rs = await revealableSeedFromMnemonic(realMnemonic, password);
    } catch {
      throw new InvalidMnemonic();
    }
    const mnemonicFromRs = await mnemonicFromEntropy(rs, password);
    if (realMnemonic !== mnemonicFromRs) {
      throw new InvalidMnemonic();
    }

    return this.createHDWalletWithRs({
      rs,
      password,
      name,
      walletHash: walletHashAndXfp.hash,
      walletXfp: walletHashAndXfp.xfp,
      isWalletBackedUp,
      avatarInfo,
    });
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
      throw new OneKeyLocalError('saveTonMnemonic ERROR: Not a TON mnemonic');
    }
    let rs: IBip39RevealableSeedEncryptHex | undefined;
    try {
      rs = await revealableSeedFromTonMnemonic(realMnemonic, password);
    } catch {
      throw new InvalidMnemonic();
    }

    const tonMnemonicFromRs = await tonMnemonicFromEntropy(rs, password);
    if (realMnemonic !== tonMnemonicFromRs) {
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
    walletXfp,
    isWalletBackedUp,
  }: {
    rs: string;
    password: string;
    avatarInfo?: IAvatarInfo;
    name?: string;
    walletHash: string;
    walletXfp: string;
    isWalletBackedUp?: boolean;
  }): Promise<{
    wallet: IDBWallet;
    indexedAccount?: IDBIndexedAccount;
    isOverrideWallet?: boolean;
  }> {
    if (platformEnv.isWebDappMode) {
      throw new OneKeyLocalError(
        'createHDWallet ERROR: Not supported in Dapp mode',
      );
    }
    ensureSensitiveTextEncoded(password);

    let shouldCheckDuplicate = true;

    const devSettings = await devSettingsPersistAtom.get();
    if (devSettings.enabled && devSettings.settings?.allowAddSameHDWallet) {
      shouldCheckDuplicate = false;
    }

    if (walletHash && shouldCheckDuplicate) {
      // TODO performance issue
      const { wallets } = await this.getAllWallets({
        excludeKeylessWallet: true,
      });
      const existsSameHashWallet = wallets.find(
        (item) => walletHash && item.hash && item.hash === walletHash,
      );
      if (existsSameHashWallet) {
        const indexedAccounts = await this.addIndexedAccount({
          walletId: existsSameHashWallet.id,
          indexes: [0],
          skipIfExists: true,
        });
        // localDb.buildCreateHDAndHWWalletResult({
        //   walletId: existsSameHashWallet.id,
        //   addedHdAccountIndex:
        // })
        // DO NOT throw error, just return the exists wallet, so v4 migration can continue
        // throw new OneKeyLocalError('Wallet with the same mnemonic hash already exists');
        return {
          wallet: existsSameHashWallet,
          isOverrideWallet: true,
          indexedAccount: indexedAccounts[0],
        };
      }
    }

    const result = await localDb.createHDWallet({
      password,
      rs,
      backuped: !!isWalletBackedUp,
      avatar: avatarInfo ?? randomAvatar(),
      name,
      walletHash,
      walletXfp,
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
    const { walletId, name } = params;

    let oldName = '';
    // Get the old name before updating
    if (name) {
      const wallet = await this.getWalletSafe({
        walletId,
        withoutRefill: true,
      });
      oldName = wallet?.name || '';
    }

    const result = await localDb.setWalletNameAndAvatar(params);

    if (!params.skipEmitEvent) {
      appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
      appEventBus.emit(EAppEventBusNames.WalletRename, {
        walletId: params.walletId,
      });
    }

    // Only proceed if the name is actually changing
    if (name && oldName && oldName !== name) {
      // Record the name change history
      await simpleDb.changeHistory.addChangeHistory({
        items: [
          {
            entityType: EChangeHistoryEntityType.Wallet,
            entityId: walletId,
            contentType: EChangeHistoryContentType.Name,
            oldValue: oldName,
            value: name,
          },
        ],
      });
    }

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

    // Cleanup orphaned HyperLiquid agent credentials
    void this.cleanupOrphanedHyperLiquidAgentCredentials({
      accountId: account?.id,
      indexedAccountId: indexedAccount?.id,
    });

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

    if (account) {
      void this.backgroundApi.serviceDBBackup.removeBackupImportedAccount({
        accountId: account.id,
      });
    }
  }

  @backgroundMethod()
  @toastIfError()
  async removeWallet({
    walletId,
    skipBackupWalletRemove,
    isRemoveToMocked,
  }: Omit<IDBRemoveWalletParams, 'password' | 'isHardware'>) {
    if (!walletId) {
      throw new OneKeyLocalError('walletId is required');
    }
    if (accountUtils.isOthersWallet({ walletId })) {
      throw new OneKeyLocalError(
        'Remove non-hd and non-hw wallet is not allowed',
      );
    }
    await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
      walletId,
      hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
    });
    const result = await localDb.removeWallet({
      walletId,
      isRemoveToMocked,
    });

    // WARNING:
    // Use setTimeout to change React Native's render scheduling to avoid exceptions penetrating the scheduler and causing crashes.
    // If using React 19, it should not crash in React Native. Need to wait for RN upgrade to 0.79 to remove this code.
    if (platformEnv.isNative) {
      await timerUtils.wait(1500);
    }
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    await this.backgroundApi.serviceDApp.removeDappConnectionAfterWalletRemove({
      walletId,
    });

    // Cleanup orphaned HyperLiquid agent credentials
    void this.cleanupOrphanedHyperLiquidAgentCredentials({
      walletId,
    });

    if (!skipBackupWalletRemove) {
      void this.backgroundApi.serviceDBBackup.removeBackupHDWallet({
        walletId,
      });
    }
    return result;
  }

  async buildAccountXpubOrAddress({
    getAccountXpubFn,
    getAccountAddressFn,
    addressToLowerCase = true,
  }: {
    getAccountXpubFn: () => Promise<string | undefined>;
    getAccountAddressFn: () => Promise<string | undefined>;
    addressToLowerCase?: boolean;
  }): Promise<string | null> {
    let accountXpubOrAddress: string | undefined;

    let accountXpub: string | undefined;
    try {
      accountXpub = await getAccountXpubFn();
    } catch (error) {
      console.error(error);
    }
    if (accountXpub) {
      accountXpubOrAddress = accountXpub;
    } else {
      let accountAddress: string | undefined;
      try {
        accountAddress = await getAccountAddressFn();
      } catch (error) {
        console.error(error);
      }
      if (accountAddress) {
        accountXpubOrAddress = accountAddress;
        if (addressToLowerCase) {
          accountXpubOrAddress = accountXpubOrAddress?.toLowerCase();
        }
      }
    }

    return accountXpubOrAddress || null;
  }

  getAccountXpubOrAddressWithMemo = memoizee(
    async ({
      accountId,
      networkId,
      addressToLowerCase = true,
    }: {
      accountId: string | undefined;
      networkId: string | undefined;
      addressToLowerCase?: boolean;
    }): Promise<string | null> => {
      // console.log('getAccountXpubOrAddressWithMemo', accountId, networkId);
      if (!networkId || !accountId) {
        return null;
      }

      return this.buildAccountXpubOrAddress({
        addressToLowerCase,
        getAccountXpubFn: () =>
          this.getAccountXpub({
            networkId,
            accountId,
          }),
        getAccountAddressFn: () =>
          this.getAccountAddressForApi({
            networkId,
            accountId,
          }),
      });
    },
    {
      max: 100,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 5 }),
      promise: true,
    },
  );

  @backgroundMethod()
  async getAccountXpubOrAddress({
    accountId,
    networkId,
    addressToLowerCase = true,
  }: {
    accountId: string | undefined;
    networkId: string | undefined;
    addressToLowerCase?: boolean;
  }): Promise<string | null> {
    // Because all EVM networks use the same address, so the networkId is unified to eth to better utilize the cache
    if (networkUtils.isEvmNetwork({ networkId })) {
      // eslint-disable-next-line no-param-reassign
      networkId = getNetworkIdsMap().eth;
    }

    return this.getAccountXpubOrAddressWithMemo({
      accountId,
      networkId,
      addressToLowerCase,
    });
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
    const info = await this.getAccountAddressInfoForApi({
      dbAccount,
      accountId,
      networkId,
    });
    return info.address;
  }

  @backgroundMethod()
  async getAccountAddressInfoForApi({
    dbAccount,
    accountId,
    networkId,
  }: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
  }): Promise<{ address: string; account: INetworkAccount }> {
    const account: INetworkAccount = await this.getAccount({
      accountId,
      networkId,
      dbAccount,
    });

    if (networkUtils.isAllNetwork({ networkId })) {
      return { address: ALL_NETWORK_ACCOUNT_MOCK_ADDRESS, account };
    }

    if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
      return { address: account.addressDetail.normalizedAddress, account };
    }
    return { address: account.address, account };
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
      throw new OneKeyLocalError(
        'getHDAccountMnemonic ERROR: Not a HD account',
      );
    }
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByWallet({
        walletId,
        reason,
        hardwareCallContext: EHardwareCallContext.BACKGROUND_TASK,
      });
    const credential = await localDb.getCredential(walletId);
    const mnemonicRaw = await mnemonicFromEntropy(
      credential.credential,
      password,
    );
    const mnemonic =
      await this.backgroundApi.servicePassword.encodeSensitiveText({
        text: mnemonicRaw,
      });
    return { mnemonic };
  }

  @backgroundMethod()
  async getTonImportedAccountMnemonic({ accountId }: { accountId: string }) {
    if (!accountUtils.isImportedAccount({ accountId })) {
      throw new OneKeyLocalError(
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
    const mnemonicRaw = await tonMnemonicFromEntropy(
      credential.credential,
      password,
    );
    const mnemonic =
      await this.backgroundApi.servicePassword.encodeSensitiveText({
        text: mnemonicRaw,
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
    customReceiveAddressPath?: string;
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
        throw new OneKeyLocalError(
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
    const { accounts: dbAccounts } =
      await this.getAccountsInSameIndexedAccountId({
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
    allDbAccounts,
    skipDbQueryIfNotFoundFromAllDbAccounts,
    networkId,
    indexedAccountId,
    excludeEmptyAccount,
  }: {
    allDbAccounts?: IDBAccount[];
    skipDbQueryIfNotFoundFromAllDbAccounts?: boolean;
    networkId: string;
    indexedAccountId: string;
    excludeEmptyAccount?: boolean;
  }) {
    const { serviceNetwork } = this.backgroundApi;
    const network = await serviceNetwork.getNetworkSafe({ networkId });
    if (!network) {
      throw new OneKeyLocalError('Network not found');
    }
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const vaultSettings = await vault.getVaultSettings();
    const accountDeriveTypes = Object.entries(
      vaultSettings.accountDeriveInfo,
    ).map(([deriveType, deriveInfo]) => ({
      deriveType: deriveType as IAccountDeriveTypes,
      deriveInfo,
    }));
    let networkAccounts = await Promise.all(
      accountDeriveTypes.map(async (item) => {
        let resp: { accounts: INetworkAccount[] } | undefined;
        try {
          resp = await this.getAccountsByIndexedAccounts({
            allDbAccounts,
            skipDbQueryIfNotFoundFromAllDbAccounts,
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

    if (excludeEmptyAccount) {
      networkAccounts = networkAccounts.filter((item) => item.account);
    }

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
      throw new OneKeyLocalError('accountId or indexedAccountId is required');
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

  @backgroundMethod()
  async clearAllWalletHashAndXfp() {
    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        allHdWalletsHashAndXfpGenerated: false,
        allQrWalletsXfpGenerated: false,
      }),
    );
    await localDb.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      const { recordPairs } = await localDb.txGetAllRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
      });
      await localDb.txUpdateRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        recordPairs,
        updater: (record) => {
          if (
            accountUtils.isHdWallet({ walletId: record.id }) ||
            accountUtils.isHwWallet({ walletId: record.id }) ||
            accountUtils.isQrWallet({ walletId: record.id })
          ) {
            record.hash = undefined;
            if (accountUtils.isQrWallet({ walletId: record.id })) {
              record.xfp = accountUtils.getShortXfp({ xfp: record.xfp || '' });
            } else {
              record.xfp = undefined;
            }
          }
          return record;
        },
      });
    });
  }

  generateAllHdAndQrWalletsHashAndXfpMutex = new Semaphore(1);

  @backgroundMethod()
  async generateAllHdAndQrWalletsHashAndXfp({
    password,
    skipLocalSync,
    skipAppStatusCheck,
  }: {
    password: string;
    skipLocalSync?: boolean;
    skipAppStatusCheck?: boolean;
  }) {
    await this.generateAllHdAndQrWalletsHashAndXfpMutex.runExclusive(
      async () => {
        if (!skipAppStatusCheck) {
          const appStatus = await simpleDb.appStatus.getRawData();
          if (appStatus?.allHdWalletsHashAndXfpGenerated) {
            return;
          }
        }

        const { wallets } = await this.getAllWallets({
          refillWalletInfo: false,
          excludeKeylessWallet: true,
        });
        const hdWallets = wallets.filter((wallet) =>
          accountUtils.isHdWallet({ walletId: wallet.id }),
        );
        await this.generateAllQrWalletsMissingXfp({ skipLocalSync: true });
        await this.generateHDWalletMissingHashAndXfp({
          password,
          hdWallets,
        });

        await simpleDb.appStatus.setRawData(
          (v): ISimpleDBAppStatus => ({
            ...v,
            allHdWalletsHashAndXfpGenerated: true,
            allQrWalletsXfpGenerated: true,
          }),
        );

        if (!skipLocalSync) {
          console.log('generateAllHdAndQrWalletsHashAndXfp', {
            skipAppStatusCheck,
          });
          await this.runLocalSyncForIndexedAccount({
            reason: 'generateAllHdAndQrWalletsHashAndXfp',
          });
        }
      },
    );
  }

  @backgroundMethod()
  async generateHDWalletMissingHashAndXfp({
    password,
    hdWallets,
  }: {
    password: string;
    hdWallets: IDBWallet[];
  }) {
    if (!hdWallets?.length) {
      return;
    }
    const walletsHashXfpMap: {
      [walletId: string]: { hash: string; xfp: string };
    } = {};
    for (const wallet of hdWallets) {
      const isKeylessWallet = accountUtils.isKeylessWallet({
        walletId: wallet.id,
      });
      if (isKeylessWallet) {
        // eslint-disable-next-line no-continue
        continue;
      }
      try {
        const isHdWallet = accountUtils.isHdWallet({ walletId: wallet.id });
        if (isHdWallet) {
          const credentialInfo = await localDb.getCredential(wallet.id);
          if (!credentialInfo) {
            // eslint-disable-next-line no-continue
            continue;
          }
          const realMnemonic = await mnemonicFromEntropy(
            credentialInfo.credential,
            password,
          );
          const walletHashXfp = await this.hdWalletHashAndXfpBuilder({
            realMnemonic,
          });
          walletsHashXfpMap[wallet.id] = walletHashXfp;
        }
      } catch (error) {
        console.error(error);
      }
    }
    await localDb.updateWalletsHashAndXfp(walletsHashXfpMap);
  }

  generateHwWalletsMissingXfpFn = async ({
    wallet,
    connectId,
    deviceId,
    withUserInteraction,
    throwError,
  }: {
    wallet: IDBWallet | undefined;
    connectId: string | undefined;
    deviceId: string | undefined;
    withUserInteraction: boolean;
    throwError?: boolean;
  }) => {
    if (!wallet?.id) {
      return;
    }
    if (!accountUtils.isHwWallet({ walletId: wallet?.id })) {
      return;
    }
    if (wallet && accountUtils.isValidWalletXfp({ xfp: wallet?.xfp })) {
      console.log('wallet already has xfp', wallet.xfp);
      return;
    }
    if (!connectId) {
      const device = await localDb.getWalletDeviceSafe({
        dbWallet: wallet,
        walletId: wallet?.id,
      });
      // eslint-disable-next-line no-param-reassign
      connectId = device?.connectId;
      // eslint-disable-next-line no-param-reassign
      deviceId = device?.deviceId;
    }

    const xfp = await this.backgroundApi.serviceHardware.buildHwWalletXfp({
      connectId,
      deviceId,
      passphraseState: wallet?.passphraseState,
      throwError: throwError ?? false,
      withUserInteraction,
    });
    if (xfp) {
      await localDb.updateWalletsHashAndXfp({
        [wallet?.id]: {
          xfp,
        },
      });
    }
    console.log('generateHwWalletsMissingXfp', { xfp, connectId, deviceId });
  };

  generateHwWalletsMissingXfpDebounced = debounce(
    this.generateHwWalletsMissingXfpFn,
    3000,
    {
      leading: false,
      trailing: true,
    },
  );

  buildQrWalletFullXfp({
    shortXfp,
    airGapAccounts,
  }: {
    shortXfp: string;
    airGapAccounts: IQrWalletAirGapAccount[];
  }) {
    if (!airGapAccounts?.length) {
      return;
    }
    const firstTaprootAccount = airGapAccounts.find(
      (item) => item.path === BTC_FIRST_TAPROOT_PATH,
    );
    if (!firstTaprootAccount) {
      return;
    }
    const xpub = firstTaprootAccount.extendedPublicKey;
    if (xpub && shortXfp) {
      const fullXfp = accountUtils.buildFullXfp({
        xfp: shortXfp,
        firstTaprootXpub: xpub,
      });
      return fullXfp;
    }
  }

  @backgroundMethod()
  async generateAllQrWalletsMissingXfp({
    skipLocalSync,
  }: {
    skipLocalSync?: boolean;
  } = {}) {
    const appStatus = await simpleDb.appStatus.getRawData();
    if (appStatus?.allQrWalletsXfpGenerated) {
      return;
    }

    const { wallets } = await this.getAllWallets({
      refillWalletInfo: true,
      excludeKeylessWallet: true,
    });
    const qrWallets = wallets.filter((wallet) =>
      accountUtils.isQrWallet({ walletId: wallet.id }),
    );
    if (!qrWallets?.length) {
      return;
    }
    await Promise.all(
      qrWallets.map(async (wallet) => {
        if (!wallet?.id) {
          return;
        }
        if (!accountUtils.isQrWallet({ walletId: wallet?.id })) {
          return;
        }
        if (wallet && accountUtils.isValidWalletXfp({ xfp: wallet?.xfp })) {
          console.log('wallet already has xfp', wallet.xfp);
          return;
        }
        const shortXfp = wallet.xfp;
        const airGapAccounts = wallet.airGapAccountsInfo?.accounts;
        if (shortXfp && airGapAccounts?.length) {
          // TODO airGapAccounts missing firstTaprootAccount, show QR code to add if current wallet is self
          const fullXfp = this.buildQrWalletFullXfp({
            shortXfp,
            airGapAccounts,
          });
          if (fullXfp) {
            await localDb.updateWalletsHashAndXfp({
              [wallet?.id]: { xfp: fullXfp },
            });
          }
        }
      }),
    );

    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        allQrWalletsXfpGenerated: true,
      }),
    );
    if (!skipLocalSync) {
      await this.runLocalSyncForIndexedAccount({
        reason: 'generateAllQrWalletsMissingXfp',
      });
    }
  }

  @backgroundMethod()
  async generateHwWalletsMissingXfp({
    wallet,
    connectId,
    deviceId,
    withUserInteraction,
  }: {
    wallet: IDBWallet | undefined;
    connectId: string;
    deviceId: string | undefined;
    withUserInteraction: boolean;
  }) {
    await this.generateHwWalletsMissingXfpDebounced({
      wallet,
      connectId,
      deviceId,
      withUserInteraction,
    });
  }

  @backgroundMethod()
  async generateWalletsMissingMetaSilently({ walletId }: { walletId: string }) {
    let canCallSilently = false;
    let cachePassword: string | undefined;

    if (walletId) {
      if (accountUtils.isHdWallet({ walletId })) {
        cachePassword =
          await this.backgroundApi.servicePassword.getCachedPassword();
        if (cachePassword) {
          canCallSilently = true;
        }
      }
      if (accountUtils.isQrWallet({ walletId })) {
        canCallSilently = true;
      }

      const isHwWallet = accountUtils.isHwWallet({ walletId });
      if (isHwWallet) {
        const wallet = await localDb.getWalletSafe({ walletId });
        if (
          wallet &&
          !wallet?.deprecated &&
          !accountUtils.isValidWalletXfp({ xfp: wallet.xfp })
        ) {
          await hardwareWalletXfpStatusAtom.set((v) => ({
            ...v,
            [walletId]: {
              ...(v?.[walletId] || {}),
              xfpMissing: true,
            },
          }));
        }

        const hardwareWalletXfpStatus = await hardwareWalletXfpStatusAtom.get();
        if (
          hardwareWalletXfpStatus?.[walletId]?.xfpMissing &&
          wallet &&
          accountUtils.isValidWalletXfp({ xfp: wallet.xfp })
        ) {
          await hardwareWalletXfpStatusAtom.set((v) => ({
            ...v,
            [walletId]: {
              ...(v?.[walletId] || {}),
              xfpMissing: false,
            },
          }));
        }
      }
    }

    if (canCallSilently) {
      try {
        await this.generateWalletsMissingMetaWithUserInteraction({ walletId });
      } catch (error) {
        console.error(error);
      }
    }
  }

  @backgroundMethod()
  @toastIfError()
  async generateWalletsMissingMetaWithUserInteraction({
    walletId,
    cachePassword,
  }: {
    walletId: string;
    cachePassword?: string;
  }) {
    if (!walletId) {
      throw new OneKeyLocalError('walletId is required');
    }
    const wallet = await localDb.getWalletSafe({ walletId });
    if (!wallet) {
      throw new OneKeyLocalError('wallet not found');
    }

    let walletUpdated = false;

    const isHdWallet = accountUtils.isHdWallet({ walletId: wallet.id });
    if (isHdWallet) {
      if (wallet.hash && accountUtils.isValidWalletXfp({ xfp: wallet.xfp })) {
        return;
      }
      const password =
        cachePassword ||
        (await this.backgroundApi.servicePassword.promptPasswordVerify({}))
          ?.password;
      if (!password) {
        return;
      }
      await this.generateAllHdAndQrWalletsHashAndXfp({
        password,
        skipLocalSync: true,
      });
      walletUpdated = true;
    }

    const isHwWallet = accountUtils.isHwWallet({ walletId: wallet.id });
    if (isHwWallet) {
      if (accountUtils.isValidWalletXfp({ xfp: wallet.xfp })) {
        return;
      }
      const device = await localDb.getWalletDeviceSafe({
        dbWallet: wallet,
        walletId: wallet?.id,
      });
      if (!device) {
        throw new OneKeyLocalError('wallet associated device not found');
      }
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          await timerUtils.wait(1000);
          await this.generateHwWalletsMissingXfpFn({
            wallet,
            connectId: device?.connectId || '',
            deviceId: device?.deviceId || '',
            throwError: true,
            withUserInteraction: true,
          });
          await timerUtils.wait(1000);
          walletUpdated = true;
        },
        {
          deviceParams: {
            dbDevice: device,
          },
        },
      );
    }

    const isQrWallet = accountUtils.isQrWallet({ walletId: wallet.id });
    if (isQrWallet) {
      if (accountUtils.isValidWalletXfp({ xfp: wallet.xfp })) {
        return;
      }
      await this.generateAllQrWalletsMissingXfp({ skipLocalSync: true });
      walletUpdated = true;
    }

    if (walletUpdated) {
      if (isHwWallet) {
        await hardwareWalletXfpStatusAtom.set((v) => ({
          ...v,
          [walletId]: {
            ...(v?.[walletId] || {}),
            xfpMissing: false,
          },
        }));
      }
      await this.runLocalSyncForIndexedAccount({
        reason: 'generateWalletsMissingMetaWithUserInteraction',
      });
    }
  }

  async runLocalSyncForIndexedAccount({ reason }: { reason?: string } = {}) {
    console.log('runLocalSyncForIndexedAccount', reason);
    try {
      const { servicePrimeCloudSync } = this.backgroundApi;
      await servicePrimeCloudSync.initLocalSyncItemsDBForLegacyIndexedAccount();

      // TODO syncToSceneWithLocalSyncItems migrate and merge hd accounts
      let { items } = await servicePrimeCloudSync.getAllLocalSyncItems();
      items = items.filter(
        (item) =>
          item.dataType === EPrimeCloudSyncDataType.IndexedAccount &&
          cloudSyncUtils.canSyncWithoutServer(item.dataType),
      );
      await servicePrimeCloudSync._syncToSceneWithLocalSyncItems({
        items,
        syncCredential: undefined,
        forceSync: true,
      });
    } catch (error) {
      console.error(error);
    }
  }

  @backgroundMethod()
  async updateWalletsDeprecatedState(params: {
    willUpdateDeprecateMap: Record<string, boolean>;
  }) {
    const { willUpdateDeprecateMap } = params;

    if (
      !willUpdateDeprecateMap ||
      Object.keys(willUpdateDeprecateMap).length === 0
    ) {
      return true;
    }

    try {
      for (const [walletId, isDeprecated] of Object.entries(
        willUpdateDeprecateMap,
      )) {
        await localDb.setWalletDeprecated({
          walletId,
          isDeprecated,
        });
      }
      return true;
    } catch (error) {
      console.error(
        `updateWalletsDeprecatedState failed: `,
        error instanceof Error ? error.message : String(error),
      );
    }
    return false;
  }

  async getLocalSameHDWallets({
    password,
    skipAppStatusCheck,
  }: {
    password: string;
    skipAppStatusCheck?: boolean;
  }) {
    await this.generateAllHdAndQrWalletsHashAndXfp({
      password,
      skipAppStatusCheck,
    });
    const { wallets: allWallets } = await this.getAllWallets({
      refillWalletInfo: true,
      excludeKeylessWallet: true,
    });
    const sameWalletsMap: {
      [walletHash: string]: IDBWallet[];
    } = {};
    for (const wallet of allWallets) {
      const walletHash = wallet.hash;
      if (walletHash) {
        sameWalletsMap[walletHash] = sameWalletsMap[walletHash] || [];
        sameWalletsMap[walletHash].push(wallet);
      }
    }
    const sameWallets: Array<{ walletHash: string; wallets: IDBWallet[] }> = [];
    Object.entries(sameWalletsMap).forEach(([walletHash, wallets]) => {
      if (wallets.length >= 2) {
        sameWallets.push({ walletHash, wallets });
      }
    });
    return sameWallets;
  }

  @backgroundMethod()
  async mergeDuplicateHDWallets({
    password,
    skipAppStatusCheck,
  }: {
    password: string;
    skipAppStatusCheck?: boolean;
  }) {
    if (!skipAppStatusCheck) {
      const appStatus = await simpleDb.appStatus.getRawData();
      if (appStatus?.allHdDuplicateWalletsMerged && !skipAppStatusCheck) {
        return;
      }
    }

    try {
      const sameWallets = await this.getLocalSameHDWallets({
        password,
        skipAppStatusCheck,
      });

      if (sameWallets?.length) {
        const walletsToRemove: string[] = [];

        const { accounts: allAccounts } = await this.getAllAccounts();

        for (const sameWallet of sameWallets) {
          let walletToKeep: IDBWallet | undefined;
          const accountsToAddParams: {
            oldIndexedAccountId: string;
            deriveType: IAccountDeriveTypes;
            networkId: string;
            index: number;
            name: string;
          }[] = [];
          const walletNames: string[] = [];
          const indexedAccountNames: {
            indexedAccountId: string;
            name: string;
          }[] = [];

          for (let i = 0; i < sameWallet.wallets.length; i += 1) {
            const wallet = sameWallet.wallets[i];
            if (i === 0) {
              walletToKeep = wallet;
            } else {
              walletsToRemove.push(wallet.id);
              walletNames.push(wallet.name);
              try {
                const changeHistory =
                  await this.backgroundApi.simpleDb.changeHistory.getChangeHistory(
                    {
                      entityType: EChangeHistoryEntityType.Wallet,
                      entityId: wallet.id,
                      contentType: EChangeHistoryContentType.Name,
                    },
                  );
                if (changeHistory?.length) {
                  walletNames.push(...changeHistory.map((item) => item.value));
                }
              } catch (e) {
                console.error(e);
              }

              await Promise.all(
                allAccounts
                  .filter(
                    (item) =>
                      item?.id &&
                      wallet?.id &&
                      accountUtils.parseAccountId({ accountId: item?.id })
                        ?.walletId === wallet?.id,
                  )
                  // eslint-disable-next-line no-loop-func, @typescript-eslint/no-loop-func
                  .map(async (item) => {
                    let networkIds: string[] = [];
                    if (item.impl === IMPL_EVM) {
                      networkIds = [getNetworkIdsMap().eth];
                    } else {
                      ({ networkIds } =
                        await this.backgroundApi.serviceNetwork.getNetworkIdsByImpls(
                          {
                            impls: [item.impl],
                          },
                        ));
                    }
                    for (const networkId of networkIds) {
                      const { deriveType } =
                        await this.backgroundApi.serviceNetwork.getDeriveTypeByTemplate(
                          {
                            accountId: item.id,
                            networkId,
                            template: item.template,
                          },
                        );
                      let indexedAccount: IDBIndexedAccount | undefined;
                      try {
                        indexedAccount = await this.getIndexedAccountByAccount({
                          account: item,
                        });
                      } catch (e) {
                        console.error(e);
                      }
                      if (
                        indexedAccount &&
                        !isNil(item.pathIndex) &&
                        indexedAccount?.name
                      ) {
                        accountsToAddParams.push({
                          oldIndexedAccountId: indexedAccount.id,
                          networkId,
                          deriveType,
                          index: item.pathIndex,
                          name: indexedAccount?.name,
                        });

                        if (walletToKeep?.id && item.pathIndex >= 0) {
                          const indexedAccountIdToAdd =
                            accountUtils.buildIndexedAccountId({
                              walletId: walletToKeep?.id,
                              index: item.pathIndex,
                            });
                          if (indexedAccountIdToAdd) {
                            const indexedAccountNameChangeHistory =
                              await this.backgroundApi.simpleDb.changeHistory.getChangeHistory(
                                {
                                  entityType:
                                    EChangeHistoryEntityType.IndexedAccount,
                                  entityId: indexedAccount?.id,
                                  contentType: EChangeHistoryContentType.Name,
                                },
                              );

                            indexedAccountNames.push(
                              ...indexedAccountNameChangeHistory.map(
                                (info: IChangeHistoryItem) => ({
                                  indexedAccountId: indexedAccountIdToAdd,
                                  name: info.value,
                                }),
                              ),
                            );
                          }
                        }
                      }
                    }
                  }),
              );
            }
          }

          if (walletToKeep && walletToKeep?.id && accountsToAddParams?.length) {
            for (const accountToAddParam of accountsToAddParams) {
              const indexedAccountIdToAdd = accountUtils.buildIndexedAccountId({
                walletId: walletToKeep?.id,
                index: accountToAddParam.index,
              });
              const existingIndexedAccount = await this.getIndexedAccountSafe({
                id: indexedAccountIdToAdd,
              });
              try {
                await this.addHDOrHWAccounts({
                  walletId: walletToKeep?.id,
                  networkId: accountToAddParam.networkId,
                  deriveType: accountToAddParam.deriveType,
                  indexes: [accountToAddParam.index],
                  names: [accountToAddParam.name],
                  indexedAccountId: undefined,
                });
              } catch (e) {
                console.error(e);
              }
              indexedAccountNames.push({
                indexedAccountId: indexedAccountIdToAdd,
                name: accountToAddParam.name,
              });
              if (existingIndexedAccount?.name) {
                indexedAccountNames.push({
                  indexedAccountId: indexedAccountIdToAdd,
                  name: existingIndexedAccount?.name,
                });
              }
            }
          }

          const indexedAccountNamesUnique = uniqBy(
            indexedAccountNames,
            (item) => item.indexedAccountId + item.name,
          );

          try {
            await this.backgroundApi.simpleDb.changeHistory.addChangeHistory({
              items: indexedAccountNamesUnique.map(
                ({ indexedAccountId, name }) => ({
                  entityType: EChangeHistoryEntityType.IndexedAccount,
                  entityId: indexedAccountId,
                  contentType: EChangeHistoryContentType.Name,
                  oldValue: '',
                  value: name,
                }),
              ),
            });
          } catch (e) {
            console.error(e);
          }
          if (walletToKeep) {
            try {
              await this.backgroundApi.simpleDb.changeHistory.addChangeHistory({
                items: [
                  {
                    entityType: EChangeHistoryEntityType.Wallet,
                    entityId: walletToKeep?.id,
                    contentType: EChangeHistoryContentType.Name,
                    oldValue: '',
                    value: walletToKeep?.name,
                  },
                  ...uniq(walletNames).map((name) => ({
                    entityType: EChangeHistoryEntityType.Wallet,
                    entityId: walletToKeep?.id,
                    contentType: EChangeHistoryContentType.Name,
                    oldValue: '',
                    value: name,
                  })),
                ],
              });
            } catch (e) {
              console.error(e);
            }
          }
        }

        for (const walletId of walletsToRemove) {
          try {
            await this.removeWallet({
              walletId,
              // skipBackupWalletRemove: true
            });
          } catch (e) {
            console.error(e);
          }
        }

        // await timerUtils.wait(3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      await simpleDb.appStatus.setRawData(
        (v): ISimpleDBAppStatus => ({
          ...v,
          allHdDuplicateWalletsMerged: true,
        }),
      );
    }
  }

  @backgroundMethod()
  @toastIfError()
  async updateWalletBackupStatus({
    walletId,
    isBackedUp,
  }: {
    walletId: string;
    isBackedUp: boolean;
  }): Promise<void> {
    if (!walletId) {
      return;
    }

    const wallet = await this.getWalletSafe({ walletId });
    if (!wallet) {
      throw new OneKeyLocalError(
        'updateWalletBackupStatus ERROR: wallet not found',
      );
    }
    await localDb.updateWalletsBackupStatus({
      [walletId]: {
        isBackedUp,
      },
    });
    appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
  }

  @backgroundMethod()
  @toastIfError()
  async updateHdWalletsBackedUpStatusForCloudBackup({
    publicData,
  }: {
    publicData: IPrimeTransferPublicData | undefined;
  }) {
    const cloudBackupedWallets: IPrimeTransferPublicDataWalletDetail[] =
      Object.values(publicData?.walletDetails || {});
    if (!cloudBackupedWallets?.length) {
      return;
    }

    const { wallets } = await this.getWallets();
    const walletsBackedUpStatusMap: {
      [walletId: string]: {
        isBackedUp: boolean;
      };
    } = {};

    for (const wallet of wallets) {
      if (wallet.type === WALLET_TYPE_HD && !wallet.backuped && wallet.xfp) {
        if (
          cloudBackupedWallets.find((item) => item.walletXfp === wallet.xfp)
        ) {
          walletsBackedUpStatusMap[wallet.id] = {
            isBackedUp: true,
          };
        }
      }
    }
    await localDb.updateWalletsBackupStatus(walletsBackedUpStatusMap);

    if (Object.keys(walletsBackedUpStatusMap).length > 0) {
      appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    }
  }

  @backgroundMethod()
  async migrateHdWalletsBackedUpStatus() {
    const appStatus = await simpleDb.appStatus.getRawData();
    if (appStatus?.hdWalletsBackupMigrated) {
      console.log('migrateHdWalletsBackedUpStatus: already migrated');
      return;
    }
    const { wallets } = await this.getWallets();
    const walletsBackedUpStatusMap: {
      [walletId: string]: {
        isBackedUp: boolean;
      };
    } = {};
    for (const wallet of wallets) {
      if (wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
        walletsBackedUpStatusMap[wallet.id] = {
          isBackedUp: true,
        };
      }
    }
    await localDb.updateWalletsBackupStatus(walletsBackedUpStatusMap);

    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        hdWalletsBackupMigrated: true,
      }),
    );

    if (Object.keys(walletsBackedUpStatusMap).length > 0) {
      appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    }
  }

  @backgroundMethod()
  async migrateHardwareLtcXPub() {
    const appStatus = await simpleDb.appStatus.getRawData();
    if (appStatus?.fixHardwareLtcXPubMigrated) {
      console.log('migrateLtcXPub: already migrated');
      return;
    }

    const { accounts } = await this.getAllAccounts();
    const hwLtcAccounts = accounts
      .filter((item) => accountUtils.isHwAccount({ accountId: item?.id }))
      .filter((item) => item.impl === IMPL_LTC);

    const fixedAccounts: {
      [accountId: string]: {
        xpub: string;
        xpubSegwit: string;
      };
    } = {};

    for (const account of hwLtcAccounts) {
      // IDBUtxoAccount
      if ('xpub' in account && 'xpubSegwit' in account) {
        const xpub = account.xpub;

        const parts = account.path?.split('/');
        if (xpub && xpub.length > 0 && parts && parts.length > 2) {
          const newXpub = await convertLtcXpub({
            purpose: parts[1],
            xpub,
          });

          if (newXpub && newXpub !== xpub) {
            fixedAccounts[account.id] = {
              xpub: newXpub,
              xpubSegwit: newXpub,
            };
          }
        }
      }
    }

    if (Object.keys(fixedAccounts).length > 0) {
      await localDb.updateAccountXpub(fixedAccounts);
    }

    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        fixHardwareLtcXPubMigrated: true,
      }),
    );
  }

  async getExportedPrivateKeyOfImportedAccount({
    importedAccount,
    encryptedCredential,
    password,
    credentialDecrypted,
    networkId,
  }: {
    importedAccount: IPrimeTransferAccount;
    password: string;
    encryptedCredential: string;
    credentialDecrypted?: ICoreImportedCredential | undefined;
    networkId: string | undefined;
  }) {
    if (!networkId) {
      throw new OneKeyLocalError('NetworkId is required');
    }
    if (!password) {
      throw new OneKeyLocalError(
        'getExportedPrivateKeyOfImportedAccount Error: Password is required',
      );
    }
    if (!credentialDecrypted) {
      if (!encryptedCredential) {
        throw new OneKeyLocalError(
          'getExportedPrivateKeyOfImportedAccount Error: Encrypted credential is required',
        );
      }
    }
    let privateKey: string | undefined;
    if (credentialDecrypted) {
      privateKey = credentialDecrypted.privateKey;
    } else {
      ({ privateKey } = await decryptImportedCredential({
        credential: encryptedCredential,
        password,
        allowRawPassword: true,
      }));
    }
    if (!privateKey) {
      throw new OneKeyLocalError(
        'getExportedPrivateKeyOfImportedAccount Error: Private key is required',
      );
    }
    const coreApi = this.backgroundApi.serviceNetwork.getCoreApiByNetwork({
      networkId,
    });
    const chainId = networkUtils.getNetworkChainId({
      networkId,
      hex: false,
    });
    const credentials: ICoreCredentialsInfo = {
      imported: await encryptImportedCredential({
        credential: {
          privateKey,
        },
        password,
      }),
    };
    // TODO try catch
    let exportedPrivateKey = await coreApi.imported.getExportedSecretKey({
      networkInfo: { chainId } as any, // only works for HD

      password,
      credentials,

      account: { ...importedAccount, path: importedAccount.path || '' },

      keyType:
        importedAccount.type === EDBAccountType.UTXO
          ? ECoreApiExportedSecretKeyType.xprvt
          : ECoreApiExportedSecretKeyType.privateKey,
      addressEncoding: undefined,
    });
    if (
      !exportedPrivateKey &&
      privateKey &&
      importedAccount?.coinType === COINTYPE_STC
    ) {
      exportedPrivateKey = hexUtils.addHexPrefix(privateKey);
    }
    return { exportedPrivateKey, privateKey };
  }

  async restoreImportedAccountByInput({
    importedAccount,
    input,
    privateKey,
    networkId,
    skipEventEmit,
  }: {
    importedAccount: IPrimeTransferAccount;
    input: string;
    privateKey: string;
    networkId: string;
    skipEventEmit?: boolean;
  }) {
    let addedAccounts: IDBAccount[] = [];
    try {
      const { serviceAccount, serviceNetwork, servicePassword } =
        this.backgroundApi;

      let deriveTypes: IAccountDeriveTypes[] = [];
      if (importedAccount?.address) {
        try {
          const deriveType = await serviceNetwork.getDeriveTypeByAddress({
            networkId,
            address: importedAccount.address,
          });
          if (deriveType) {
            deriveTypes.push(deriveType);
          }
        } catch (e) {
          console.error('getDeriveTypeByAddress error', e);
        }
      }

      if (!deriveTypes?.length) {
        try {
          deriveTypes = await serviceNetwork.getAccountImportingDeriveTypes({
            accountId: importedAccount.id,
            networkId,
            input: await servicePassword.encodeSensitiveText({
              text: input,
            }),
            validatePrivateKey: true,
            validateXprvt: true,
            template: importedAccount.template,
          });
        } catch (e) {
          console.error('getAccountImportingDeriveTypes error', e);
        }
      }

      if (!deriveTypes?.length) {
        deriveTypes = ['default'];
      }

      const skipAddIfNotEqualToAddress =
        deriveTypes.length > 1 ? importedAccount.address : undefined;
      for (const deriveType of deriveTypes) {
        try {
          const { accounts } =
            await serviceAccount.addImportedAccountWithCredential({
              skipEventEmit,
              credential: await servicePassword.encodeSensitiveText({
                text: privateKey,
              }),
              fallbackName: importedAccount.name,
              networkId,
              name: importedAccount.name,
              deriveType,
              skipAddIfNotEqualToAddress,
            });
          addedAccounts = [...addedAccounts, ...(accounts || [])];
        } catch (e) {
          console.error('addImportedAccountByInput error', e);
        }
      }
    } catch (e) {
      console.error('addImportedAccountByInput error', e);
    }
    return { addedAccounts };
  }

  async restoreWatchingAccountByInput({
    watchingAccount,
    input,
    networkId,
    skipEventEmit,
  }: {
    watchingAccount: IPrimeTransferAccount;
    input: string;
    networkId: string;
    skipEventEmit?: boolean;
  }): Promise<{
    addedAccounts: IDBAccount[];
  }> {
    let addedAccounts: IDBAccount[] = [];
    try {
      const { serviceAccount, serviceNetwork, servicePassword } =
        this.backgroundApi;

      let deriveTypes: IAccountDeriveTypes[] = [];
      if (watchingAccount?.address) {
        try {
          const deriveType = await serviceNetwork.getDeriveTypeByAddress({
            networkId,
            address: watchingAccount.address,
          });
          if (deriveType) {
            deriveTypes.push(deriveType);
          }
        } catch (e) {
          console.error('getDeriveTypeByAddress error', e);
        }
      }

      if (!deriveTypes?.length) {
        try {
          deriveTypes = await serviceNetwork.getAccountImportingDeriveTypes({
            accountId: watchingAccount.id,
            networkId: networkId || '',
            input: await servicePassword.encodeSensitiveText({
              text: input,
            }),
            validateAddress: true,
            validateXpub: true,
            template: watchingAccount.template,
          });
        } catch (e) {
          console.error('getAccountImportingDeriveTypes error', e);
        }
      }

      if (!deriveTypes?.length) {
        deriveTypes = ['default'];
      }

      const skipAddIfNotEqualToAddress =
        deriveTypes.length > 1 ? watchingAccount.address : undefined;
      for (const deriveType of deriveTypes) {
        try {
          const { accounts } = await serviceAccount.addWatchingAccount({
            skipEventEmit,
            input,
            fallbackName: watchingAccount.name,
            networkId: networkId || '',
            name: watchingAccount.name,
            deriveType,
            isUrlAccount: false,
            skipAddIfNotEqualToAddress,
          });
          addedAccounts = [...addedAccounts, ...(accounts || [])];
        } catch (e) {
          console.error('addWatchingAccountByInput error', e);
        }
      }
    } catch (e) {
      console.error('addWatchingAccountByInput error', e);
    }
    return { addedAccounts };
  }

  @backgroundMethod()
  async getMasterAddress({
    networkAccount,
    allNetworkAccountInfo,
    networkId,
  }: {
    networkAccount: INetworkAccount | undefined;
    allNetworkAccountInfo: IAllNetworkAccountInfo | undefined;
    networkId: string;
  }): Promise<{
    masterAddress: string;
  }> {
    const enableBTCFreshAddress =
      await this.backgroundApi.serviceSetting.getEnableBTCFreshAddress();
    if (!networkUtils.isBTCNetwork(networkId) || !enableBTCFreshAddress) {
      if (networkAccount) {
        return {
          masterAddress: networkAccount.address || '',
        };
      }
      if (allNetworkAccountInfo) {
        return {
          masterAddress: allNetworkAccountInfo.apiAddress || '',
        };
      }
    }

    let account: INetworkAccount | undefined = networkAccount;
    if (!networkAccount && allNetworkAccountInfo) {
      account = await this.getAccount({
        accountId: allNetworkAccountInfo.accountId,
        networkId,
      });
    }

    return {
      masterAddress:
        account?.addressDetail.masterAddress || account?.address || '',
    };
  }

  @backgroundMethod()
  async prepareHDOrHWAccountChainExtraParams({
    networkId,
    indexedAccountId,
    deriveType,
    customReceiveAddressPath,
  }: {
    networkId: string;
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes;
    customReceiveAddressPath: string | undefined;
  }): Promise<IPrepareHDOrHWAccountChainExtraParams | undefined> {
    if (!networkUtils.isBTCNetwork(networkId)) {
      return undefined;
    }
    if (customReceiveAddressPath) {
      return { receiveAddressPath: customReceiveAddressPath };
    }
    if (!indexedAccountId) {
      return undefined;
    }
    const enabledBTCFreshAddress =
      await this.backgroundApi.serviceSetting.getEnableBTCFreshAddress();
    if (!enabledBTCFreshAddress) {
      return undefined;
    }
    try {
      const account = await this.getNetworkAccount({
        indexedAccountId,
        deriveType,
        networkId,
        accountId: undefined,
      });
      if (!account) {
        return undefined;
      }
      return {
        receiveAddressPath: account.addressDetail.receiveAddressPath,
      };
    } catch {
      return undefined;
    }
  }

  isBtcOnlyFirmwareByWalletIdMemoized = memoizee(
    async ({
      walletId,
      featuresInfo,
    }: {
      walletId: string;
      featuresInfo?: IOneKeyDeviceFeatures;
    }) => {
      let firmwareType: EFirmwareType | undefined;
      if (featuresInfo) {
        firmwareType = await deviceUtils.getFirmwareType({
          features: featuresInfo,
        });
      } else {
        const walletDevice =
          await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
            walletId,
          });
        if (walletDevice) {
          firmwareType = await deviceUtils.getFirmwareType({
            features: walletDevice.featuresInfo,
          });
        }
      }

      return firmwareType === EFirmwareType.BitcoinOnly;
    },
    {
      promise: true,
      primitive: true,
      normalizer: ([options]) => {
        const fwVendor = options.featuresInfo?.fw_vendor || '';
        const capabilities =
          options.featuresInfo?.capabilities?.join(',') ?? '';
        return `${options.walletId}-${fwVendor}-${capabilities}`;
      },
      maxAge: timerUtils.getTimeDurationMs({ seconds: 60 }),
      max: 5,
    },
  );

  /**
   * Check if the wallet is a Bitcoin Only firmware
   * @param walletId - wallet id
   * @param featuresInfo - Optional: avoids redundant device queries
   * @returns {boolean} if the wallet is a Bitcoin Only firmware
   */
  @backgroundMethod()
  async isBtcOnlyFirmwareByWalletId({
    walletId,
    featuresInfo,
  }: {
    walletId: string;
    featuresInfo?: IOneKeyDeviceFeatures;
  }): Promise<boolean> {
    if (
      accountUtils.isHwWallet({ walletId }) ||
      accountUtils.isQrWallet({ walletId })
    ) {
      return this.isBtcOnlyFirmwareByWalletIdMemoized({
        walletId,
        featuresInfo,
      });
    }

    return false;
  }

  /**
   * Check if the account network is supported by the wallet
   *
   * @param accountId - Optional: account ID (either accountId or walletId must be provided)
   * @param walletId - Optional: wallet ID (either accountId or walletId must be provided)
   * @param accountImpl - Optional: account implementation, avoids DB query if already known
   * @param featuresInfo - Optional: device features, avoids redundant device queries
   * @param activeNetworkId - Required: active network ID to check
   *
   * @throws {OneKeyInternalError} if neither accountId nor walletId is provided
   * @returns {object | undefined} Returns { networkImpl } if network is not supported, undefined otherwise
   */
  @backgroundMethod()
  async checkAccountNetworkNotSupported({
    accountId,
    walletId,
    accountImpl,
    featuresInfoCache,
    activeNetworkId,
  }: {
    accountId?: string;
    walletId?: string;
    accountImpl?: string;
    featuresInfoCache?: IOneKeyDeviceFeatures;
    activeNetworkId: string;
  }): Promise<
    | {
        networkImpl: string;
      }
    | undefined
  > {
    // Validate: at least one of accountId or walletId must be provided
    if (!accountId && !walletId) {
      throw new OneKeyInternalError(
        'checkAccountNetworkNotSupported: either accountId or walletId must be provided',
      );
    }

    // Determine walletId
    let finalWalletId = walletId;
    if (!finalWalletId && accountId) {
      finalWalletId = accountUtils.getWalletIdFromAccountId({ accountId });
    }

    // Early returns for watching wallet
    if (finalWalletId === WALLET_TYPE_WATCHING) {
      return undefined;
    }

    const { impl: activeNetworkImpl } = networkUtils.parseNetworkId({
      networkId: activeNetworkId ?? '',
    });

    // other account maybe not have accountId only have walletId
    if (accountId && accountUtils.isOthersAccount({ accountId })) {
      let currentAccountImpl = accountImpl;
      if (!currentAccountImpl) {
        const account = await this.getDBAccountSafe({ accountId });
        if (!account) {
          return undefined;
        }
        currentAccountImpl = account.impl;
      }

      const isAllNetwork =
        currentAccountImpl === IMPL_ALLNETWORKS ||
        activeNetworkImpl === IMPL_ALLNETWORKS;

      if (isAllNetwork || currentAccountImpl === activeNetworkImpl) {
        return undefined;
      }

      return {
        networkImpl: activeNetworkImpl,
      };
    }

    // other account maybe not have accountId only have walletId
    if (
      !accountId &&
      finalWalletId &&
      accountUtils.isOthersWallet({ walletId: finalWalletId })
    ) {
      return {
        networkImpl: activeNetworkImpl,
      };
    }

    if (!finalWalletId) {
      return undefined;
    }

    if (activeNetworkImpl === IMPL_ALLNETWORKS) {
      return undefined;
    }

    const isBtcOnlyFirmware = await this.isBtcOnlyFirmwareByWalletId({
      walletId: finalWalletId,
      featuresInfo: featuresInfoCache,
    });

    if (isBtcOnlyFirmware && activeNetworkImpl !== IMPL_BTC) {
      return {
        networkImpl: activeNetworkImpl,
      };
    }

    return undefined;
  }
}

export default ServiceAccount;
