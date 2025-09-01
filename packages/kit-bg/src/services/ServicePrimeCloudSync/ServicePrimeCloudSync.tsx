import { debounce, isNil, throttle, uniqBy } from 'lodash';

import type { IBrowserBookmark } from '@onekeyhq/kit/src/views/Discovery/types';
import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD,
  EPrimeCloudSyncDataType,
  RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID,
} from '@onekeyhq/shared/src/consts/primeConsts';
import {
  OneKeyError,
  OneKeyErrorPrimeMasterPasswordInvalid,
  OneKeyErrorPrimePaidMembershipRequired,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import systemTimeUtils, {
  ELocalSystemTimeStatus,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market';
import type {
  ICloudSyncCredential,
  ICloudSyncCredentialForLock,
  ICloudSyncRawDataJson,
  ICloudSyncServerDiffItem,
  ICloudSyncServerItem,
  ICloudSyncServerItemByDownloaded,
  IStartServerSyncFlowParams,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type { IPrimeServerUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import type {
  IPrimeConfigFlushInfo,
  IPrimeLockChangedInfo,
} from '@onekeyhq/shared/types/socket';
import type { ICloudSyncCustomToken } from '@onekeyhq/shared/types/token';

import localDb from '../../dbs/local/localDb';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import {
  EIndexedDBBucketNames,
  type IDBAccount,
  type IDBCloudSyncItem,
  type IDBIndexedAccount,
  type IDBWallet,
} from '../../dbs/local/types';
import {
  addressBookPersistAtom,
  devSettingsPersistAtom,
  primeCloudSyncPersistAtom,
  primeMasterPasswordPersistAtom,
  primePersistAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { CloudSyncFlowManagerAccount } from './CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import { CloudSyncFlowManagerAddressBook } from './CloudSyncFlowManager/CloudSyncFlowManagerAddressBook';
import { CloudSyncFlowManagerBrowserBookmark } from './CloudSyncFlowManager/CloudSyncFlowManagerBrowserBookmark';
import { CloudSyncFlowManagerCustomNetwork } from './CloudSyncFlowManager/CloudSyncFlowManagerCustomNetwork';
import { CloudSyncFlowManagerCustomRpc } from './CloudSyncFlowManager/CloudSyncFlowManagerCustomRpc';
import { CloudSyncFlowManagerCustomToken } from './CloudSyncFlowManager/CloudSyncFlowManagerCustomToken';
import { CloudSyncFlowManagerIndexedAccount } from './CloudSyncFlowManager/CloudSyncFlowManagerIndexedAccount';
import { CloudSyncFlowManagerLock } from './CloudSyncFlowManager/CloudSyncFlowManagerLock';
import { CloudSyncFlowManagerMarketWatchList } from './CloudSyncFlowManager/CloudSyncFlowManagerMarketWatchList';
import { CloudSyncFlowManagerWallet } from './CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import cloudSyncItemBuilder from './cloudSyncItemBuilder';

import type { RealmSchemaCloudSyncItem } from '../../dbs/local/realm/schemas/RealmSchemaCloudSyncItem';
import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms';

const nonce = 0;

@backgroundClass()
class ServicePrimeCloudSync extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  syncManagers = {
    wallet: new CloudSyncFlowManagerWallet({
      backgroundApi: this.backgroundApi,
    }),
    account: new CloudSyncFlowManagerAccount({
      backgroundApi: this.backgroundApi,
    }),
    indexedAccount: new CloudSyncFlowManagerIndexedAccount({
      backgroundApi: this.backgroundApi,
    }),
    lock: new CloudSyncFlowManagerLock({
      backgroundApi: this.backgroundApi,
    }),
    browserBookmark: new CloudSyncFlowManagerBrowserBookmark({
      backgroundApi: this.backgroundApi,
    }),
    marketWatchList: new CloudSyncFlowManagerMarketWatchList({
      backgroundApi: this.backgroundApi,
    }),
    customRpc: new CloudSyncFlowManagerCustomRpc({
      backgroundApi: this.backgroundApi,
    }),
    customNetwork: new CloudSyncFlowManagerCustomNetwork({
      backgroundApi: this.backgroundApi,
    }),
    customToken: new CloudSyncFlowManagerCustomToken({
      backgroundApi: this.backgroundApi,
    }),
    addressBook: new CloudSyncFlowManagerAddressBook({
      backgroundApi: this.backgroundApi,
    }),
  };

  getSyncManager(dataType: EPrimeCloudSyncDataType) {
    switch (dataType) {
      case EPrimeCloudSyncDataType.Wallet:
        return this.syncManagers.wallet;
      case EPrimeCloudSyncDataType.Account:
        return this.syncManagers.account;
      case EPrimeCloudSyncDataType.IndexedAccount:
        return this.syncManagers.indexedAccount;
      case EPrimeCloudSyncDataType.Lock:
        return this.syncManagers.lock;
      case EPrimeCloudSyncDataType.BrowserBookmark:
        return this.syncManagers.browserBookmark;
      case EPrimeCloudSyncDataType.MarketWatchList:
        return this.syncManagers.marketWatchList;
      case EPrimeCloudSyncDataType.AddressBook:
        return this.syncManagers.addressBook;
      case EPrimeCloudSyncDataType.CustomRpc:
        return this.syncManagers.customRpc;
      case EPrimeCloudSyncDataType.CustomNetwork:
        return this.syncManagers.customNetwork;
      case EPrimeCloudSyncDataType.CustomToken:
        return this.syncManagers.customToken;
      default: {
        const exhaustiveCheck: never = dataType;
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new OneKeyLocalError(
          `Unsupported data type: ${exhaustiveCheck as string}`,
        );
      }
    }
  }

  @backgroundMethod()
  async apiFetchSyncLock() {
    const client = await this.backgroundApi.servicePrime.getPrimeClient();
    // TODO return pwdHash from server
    const result = await client.get<
      IApiClientResponse<{
        lock: ICloudSyncServerItemByDownloaded;
      }>
    >('/prime/v1/sync/lock');
    console.log('prime cloud sync apiGetSyncLock: ', result?.data?.data);
    return result?.data?.data;
  }

  @backgroundMethod()
  async decodeServerLockItem({
    lockItem,
    serverUserInfo,
  }: {
    lockItem: ICloudSyncServerItemByDownloaded;
    serverUserInfo: IPrimeServerUserInfo;
  }) {
    const item = await this.convertServerItemToLocalItem({
      serverItem: lockItem,
      syncCredential: this.syncManagers.lock.getLockStaticSyncCredential({
        primeAccountSalt: serverUserInfo.salt,
        securityPasswordR1: 'lock',
        masterPasswordUUID: serverUserInfo.pwdHash,
      }),
      shouldDecrypt: true,
      serverPwdHash: serverUserInfo.pwdHash,
    });
    return item;
  }

  @backgroundMethod()
  async apiDownloadItems({
    start,
    limit,
    includeDeleted = false,
    customPwdHash,
  }: {
    start?: number;
    limit?: number;
    includeDeleted?: boolean;
    customPwdHash?: string;
  } = {}) {
    const client = await this.backgroundApi.servicePrime.getPrimeClient();
    const { masterPasswordUUID } = await primeMasterPasswordPersistAtom.get();
    const pwdHash =
      customPwdHash ||
      masterPasswordUUID ||
      RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID;
    const result = await client.post<
      IApiClientResponse<{
        nonce: number; // TODO add nonce here
        serverData: ICloudSyncServerItemByDownloaded[];
        pwdHash: string;
      }>
    >('/prime/v1/sync/download', {
      includeDeleted,
      start,
      limit,
      pwdHash,
    });
    const data = result?.data?.data;
    data.pwdHash = data.pwdHash || pwdHash;
    console.log('prime cloud sync apiDownloadItems: ', data);
    return data;
  }

  @backgroundMethod()
  async apiCheckServerStatus({
    localItems,
    isFullDBChecking,
  }: {
    localItems?: IDBCloudSyncItem[];
    isFullDBChecking?: boolean;
  } = {}) {
    const client = await this.backgroundApi.servicePrime.getPrimeClient();
    const { masterPasswordUUID } = await primeMasterPasswordPersistAtom.get();
    const items = localItems || [];
    // TODO: server needs to filter data based on the submitted localData, not all data
    const result = await client.post<
      IApiClientResponse<{
        deleted: string[]; //
        diff: ICloudSyncServerItem[]; // TODO return server items
        updated: ICloudSyncServerItem[];
        obsoleted: string[]; //
        pwdHash: string;
        serverTime: number | undefined;
      }>
    >('/prime/v1/sync/check', {
      localData: items.map((item) => ({
        key: item.id,
        dataTimestamp: item.dataTime,
        dataType: item.dataType,
      })),
      nonce,
      pwdHash: masterPasswordUUID,
      onlyCheckLocalDataType: isFullDBChecking
        ? [
            EPrimeCloudSyncDataType.Lock,
            EPrimeCloudSyncDataType.Wallet,
            EPrimeCloudSyncDataType.Account,
            EPrimeCloudSyncDataType.IndexedAccount,
          ]
        : Object.values(EPrimeCloudSyncDataType),
    });
    const responseData = result?.data?.data;
    if (!responseData.serverTime) {
      try {
        const serverTimeStr = result?.headers?.date as string | undefined;
        if (serverTimeStr) {
          const serverTime = new Date(serverTimeStr).getTime();
          if (
            serverTime &&
            systemTimeUtils.isTimeValid({
              time: serverTime,
            })
          ) {
            responseData.serverTime = serverTime;
          }
        }
      } catch (error) {
        console.error('prime cloud sync apiCheck: ', error);
      }
    }
    // fix localItems dataTime which is greater than server time
    if (responseData.serverTime) {
      try {
        const wrongTimeItems = localItems?.filter(
          (item) =>
            responseData.serverTime &&
            item.dataTime &&
            item.dataTime > responseData.serverTime,
        );
        if (wrongTimeItems?.length) {
          const fixItemTime = (
            item: IDBCloudSyncItem | RealmSchemaCloudSyncItem,
          ) => {
            if (
              responseData.serverTime &&
              item.dataTime &&
              item.dataTime > responseData.serverTime
            ) {
              item.dataTime = responseData.serverTime;
            }
          };
          wrongTimeItems.forEach((item) => {
            fixItemTime(item);
          });
          await localDb.updateSyncItem({
            ids: wrongTimeItems.map((item) => item.id),
            updater: (item) => {
              fixItemTime(item);
              return item;
            },
          });
        }
      } catch (error) {
        console.error('prime cloud sync apiCheck: ', error);
      }
    }

    responseData.pwdHash = responseData.pwdHash || masterPasswordUUID;
    console.log('prime cloud sync apiCheck: ', responseData);
    return responseData;
  }

  async buildLockItem({
    syncCredential,
    encryptedSecurityPasswordR1ForServer,
  }: {
    syncCredential: ICloudSyncCredentialForLock | undefined;
    encryptedSecurityPasswordR1ForServer: string | undefined;
  }): Promise<IDBCloudSyncItem | undefined> {
    if (!syncCredential) {
      throw new OneKeyError('syncCredential is required for build flush lock');
    }
    if (!encryptedSecurityPasswordR1ForServer) {
      throw new OneKeyError(
        'encryptedSecurityPasswordR1ForServer is required for build flush lock',
      );
    }
    const syncCredentialForLock =
      this.syncManagers.lock.getLockStaticSyncCredential(syncCredential);
    const lockItem = await this.syncManagers.lock.buildSyncItem({
      syncCredential: syncCredentialForLock,
      target: {
        targetId: 'lock',
        dataType: EPrimeCloudSyncDataType.Lock,
        encryptedSecurityPasswordR1ForServer,
      },
      dataTime: await this.timeNow(),
    });
    if (!lockItem?.data) {
      throw new OneKeyError('lockItem.data is not found');
    }
    return lockItem;
  }

  @backgroundMethod()
  async apiUploadItems({
    localItems,
    isFlush,
    isReset,
    skipPrimeStatusCheck,
    setUndefinedTimeToNow,
    syncCredential,
    encryptedSecurityPasswordR1ForServer,
  }: {
    localItems: IDBCloudSyncItem[];
    isFlush?: boolean;
    isReset?: boolean;
    skipPrimeStatusCheck?: boolean;
    setUndefinedTimeToNow?: boolean;
    syncCredential?: ICloudSyncCredential | undefined;
    encryptedSecurityPasswordR1ForServer?: string;
  }) {
    if (!skipPrimeStatusCheck) {
      await this.ensureCloudSyncIsAvailable();
    }

    let pwdHash = '';
    let lockItem: IDBCloudSyncItem | undefined;

    if (isReset) {
      // eslint-disable-next-line no-param-reassign
      localItems = [];
      // eslint-disable-next-line no-param-reassign
      isFlush = true;
      pwdHash = '';
      lockItem = undefined;
      // pwdHash = RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID; // TODO server should clear pwdHash
    } else {
      pwdHash =
        await this.backgroundApi.serviceMasterPassword.getLocalMasterPasswordUUID();

      if (isFlush) {
        // eslint-disable-next-line no-param-reassign
        syncCredential = syncCredential || (await this.getSyncCredentialSafe());
        const syncCredentialForLock = syncCredential
          ? this.syncManagers.lock.getLockStaticSyncCredential(syncCredential)
          : undefined;
        lockItem = await this.buildLockItem({
          syncCredential: syncCredentialForLock,
          encryptedSecurityPasswordR1ForServer,
        });
      }
    }

    if (isFlush) {
      return this._callApiUploadItems({
        localItems,
        isFlush: true,
        pwdHash,
        lockItem,
        setUndefinedTimeToNow,
      });
    }

    return this._callApiUploadItemsDebounceMerge({
      localItems,
      pwdHash,
      setUndefinedTimeToNow,
    });
  }

  async callApiChangeLock({
    lockItem,
    pwdHash,
  }: {
    lockItem: IDBCloudSyncItem;
    pwdHash: string;
  }) {
    const client = await this.backgroundApi.servicePrime.getPrimeClient();
    const lockItemToServer = this.convertLocalItemToServerItem({
      localItem: lockItem,
    });
    const result = await client.post<
      IApiClientResponse<{
        nonce: number;
        created: number;
        updated: number;
      }>
    >('/prime/v1/sync/lock', {
      lock: lockItemToServer,
      pwdHash,
    });

    return result;
  }

  _callApiUploadItems = async ({
    localItems,
    isFlush,
    lockItem,
    pwdHash,
    setUndefinedTimeToNow,
  }: {
    localItems: IDBCloudSyncItem[];
    isFlush: boolean | undefined;
    lockItem: IDBCloudSyncItem | undefined;
    pwdHash: string;
    setUndefinedTimeToNow: boolean | undefined;
  }) => {
    const client = await this.backgroundApi.servicePrime.getPrimeClient();

    const now = await this.timeNow();
    let localData: ICloudSyncServerItem[] = localItems.map((item) => {
      let dataTimestamp = item.dataTime;
      if (setUndefinedTimeToNow && isNil(dataTimestamp)) {
        dataTimestamp = now;
      }
      const serverItem = this.convertLocalItemToServerItem({
        localItem: item,
        dataTimestamp,
      });
      if (process.env.NODE_ENV !== 'production') {
        // @ts-ignore
        serverItem.$$dataTimestampStr = new Date(
          serverItem.dataTimestamp || 0,
        ).toLocaleString();
      }
      return serverItem;
    });
    localData = localData.filter(
      (item) =>
        (item.data || item.isDeleted) && item.pwdHash === pwdHash && pwdHash,
    );

    // TODO save localData to DB if setUndefinedTimeToNow available

    // TODO filter out dataTime is undefined
    if (localData.length === 0 && !isFlush) {
      return undefined;
    }

    if (isFlush) {
      // throw new OneKeyLocalError('Mock flush api error');
    }

    const lockItemToServer =
      isFlush && lockItem
        ? this.convertLocalItemToServerItem({
            localItem: lockItem,
          })
        : undefined;

    if (isFlush && lockItemToServer && !localData.length) {
      // TODO remove server check
      localData.push(lockItemToServer);
    }

    const result = await client.post<
      IApiClientResponse<{
        nonce: number;
        created: number;
        updated: number;
      }>
    >(isFlush ? '/prime/v1/sync/flush' : '/prime/v1/sync/upload', {
      localData,
      nonce,
      pwdHash,
      lock: lockItemToServer,
    });
    void this.updateLastSyncTime();

    console.log('prime cloud sync apiUploadItems: ', result?.data?.data);
    return result?.data?.data;
  };

  uploadItemsToMerge: IDBCloudSyncItem[] = [];

  _callApiUploadItemsDebounceMerge({
    localItems,
    pwdHash,
    setUndefinedTimeToNow,
  }: {
    localItems: IDBCloudSyncItem[];
    pwdHash: string;
    setUndefinedTimeToNow?: boolean;
  }) {
    this.uploadItemsToMerge = uniqBy(
      [...localItems, ...this.uploadItemsToMerge],
      (i: IDBCloudSyncItem) => i.id,
    );
    return this._callApiUploadItemsDebounced({
      pwdHash,
      setUndefinedTimeToNow,
    });
  }

  _callApiUploadItemsDebounced = debounce(
    async ({
      pwdHash,
      setUndefinedTimeToNow,
    }: {
      pwdHash: string;
      setUndefinedTimeToNow?: boolean;
    }) => {
      const localItems = this.uploadItemsToMerge;
      this.uploadItemsToMerge = [];
      if (localItems.length) {
        await this._callApiUploadItems({
          localItems,
          isFlush: false,
          lockItem: undefined,
          pwdHash,
          setUndefinedTimeToNow,
        });
      }
    },
    1000,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  @toastIfError()
  async resetServerData({
    skipPrimeStatusCheck,
  }: {
    skipPrimeStatusCheck?: boolean;
  } = {}) {
    await this.apiUploadItems({
      localItems: [],
      isReset: true,
      skipPrimeStatusCheck,
      encryptedSecurityPasswordR1ForServer: '',
    });
  }

  @backgroundMethod()
  async uploadAllLocalItems({
    isFlush,
    encryptedSecurityPasswordR1ForServer,
  }: {
    isFlush?: boolean;
    encryptedSecurityPasswordR1ForServer?: string;
  } = {}) {
    const localItems = (await this.getAllLocalSyncItems()).items;
    await this.apiUploadItems({
      localItems,
      isFlush,
      encryptedSecurityPasswordR1ForServer,
    });
  }

  @backgroundMethod()
  async syncToSceneByAllPendingItems() {
    if (!(await this.isCloudSyncIsAvailable())) {
      return;
    }
    const syncCredential = await this.getSyncCredentialSafe();
    if (!syncCredential) {
      return;
    }

    const { items } = await this.getAllLocalSyncItems();
    const pendingItems = items.filter((item) =>
      cloudSyncItemBuilder.canLocalItemSyncToScene({
        item,
        syncCredential,
      }),
    );
    return this.syncToSceneWithLocalSyncItems({
      items: pendingItems,
      syncCredential,
    });
  }

  // TODO mutex
  async syncToSceneWithLocalSyncItems({
    items,
    syncCredential,
  }: {
    items: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential;
  }) {
    if (!syncCredential) {
      return;
    }
    if (!(await this.isCloudSyncIsAvailable())) {
      return;
    }
    return this._syncToSceneWithLocalSyncItems({
      items,
      syncCredential,
    });
  }

  async _syncToSceneWithLocalSyncItems({
    items,
    syncCredential,
    forceSync,
  }: {
    items: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential | undefined;
    forceSync?: boolean;
  }) {
    const walletItems: IDBCloudSyncItem[] = [];
    const accountItems: IDBCloudSyncItem[] = [];
    const indexedAccountItems: IDBCloudSyncItem[] = [];
    const browserBookmarkItems: IDBCloudSyncItem[] = [];
    const marketWatchListItems: IDBCloudSyncItem[] = [];
    const customRpcItems: IDBCloudSyncItem[] = [];
    const customNetworkItems: IDBCloudSyncItem[] = [];
    const customTokenItems: IDBCloudSyncItem[] = [];
    const addressBookItems: IDBCloudSyncItem[] = [];

    for (const item of items) {
      switch (item.dataType) {
        case EPrimeCloudSyncDataType.Wallet:
          walletItems.push(item);
          break;
        case EPrimeCloudSyncDataType.Account:
          accountItems.push(item);
          break;
        case EPrimeCloudSyncDataType.IndexedAccount:
          indexedAccountItems.push(item);
          break;
        case EPrimeCloudSyncDataType.Lock:
          // do nothing here
          break;
        case EPrimeCloudSyncDataType.BrowserBookmark:
          browserBookmarkItems.push(item);
          break;
        case EPrimeCloudSyncDataType.MarketWatchList:
          marketWatchListItems.push(item);
          break;
        case EPrimeCloudSyncDataType.CustomRpc:
          customRpcItems.push(item);
          break;
        case EPrimeCloudSyncDataType.CustomNetwork:
          customNetworkItems.push(item);
          break;
        case EPrimeCloudSyncDataType.AddressBook:
          addressBookItems.push(item);
          break;
        case EPrimeCloudSyncDataType.CustomToken:
          customTokenItems.push(item);
          break;
        default: {
          const exhaustiveCheck: never = item.dataType;
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          throw new OneKeyLocalError(
            `Unsupported data type: ${exhaustiveCheck as unknown as string}`,
          );
        }
      }
    }

    const emitEventsStack: (() => Promise<void> | void)[] = [];

    // wallet sync
    await this.syncManagers.wallet.syncToScene({
      syncCredential,
      items: walletItems,
      forceSync,
    });
    if (walletItems?.length) {
      emitEventsStack.push(() => {
        appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
      });
    }

    // account sync
    await this.syncManagers.account.syncToScene({
      syncCredential,
      items: accountItems,
      forceSync,
    });
    await this.syncManagers.indexedAccount.syncToScene({
      syncCredential,
      items: indexedAccountItems,
      forceSync,
    });
    if (accountItems?.length || indexedAccountItems?.length) {
      emitEventsStack.push(() => {
        appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
      });
    }

    // browser bookmark sync
    await this.syncManagers.browserBookmark.syncToScene({
      syncCredential,
      items: browserBookmarkItems,
      forceSync,
    });
    if (browserBookmarkItems?.length) {
      emitEventsStack.push(() => {
        appEventBus.emit(EAppEventBusNames.RefreshBookmarkList, undefined);
      });
    }

    // market watch list sync
    await this.syncManagers.marketWatchList.syncToScene({
      syncCredential,
      items: marketWatchListItems,
      forceSync,
    });
    if (marketWatchListItems?.length) {
      emitEventsStack.push(() => {
        appEventBus.emit(EAppEventBusNames.RefreshMarketWatchList, undefined);
      });
    }

    // custom rpc sync
    await this.syncManagers.customRpc.syncToScene({
      syncCredential,
      items: customRpcItems,
      forceSync,
    });
    if (customRpcItems?.length) {
      emitEventsStack.push(() => {
        appEventBus.emit(EAppEventBusNames.RefreshCustomRpcList, undefined);
      });
    }

    // custom network sync
    await this.syncManagers.customNetwork.syncToScene({
      syncCredential,
      items: customNetworkItems,
      forceSync,
    });
    if (customNetworkItems?.length) {
      emitEventsStack.push(() => {
        appEventBus.emit(EAppEventBusNames.AddedCustomNetwork, undefined);
      });
    }

    // custom token sync
    await this.syncManagers.customToken.syncToScene({
      syncCredential,
      items: customTokenItems,
      forceSync,
    });
    if (customTokenItems?.length) {
      emitEventsStack.push(() => {
        appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
      });
    }

    // address book sync
    await this.syncManagers.addressBook.syncToScene({
      syncCredential,
      items: addressBookItems,
      forceSync,
    });
    if (addressBookItems?.length) {
      emitEventsStack.push(async () => {
        // appEventBus.emit(EAppEventBusNames.RefreshAddressBookList, undefined);
        await addressBookPersistAtom.set((prev) => ({
          ...prev,
          updateTimestamp: Date.now(),
        }));
      });
    }

    setTimeout(async () => {
      for (const fn of emitEventsStack) {
        await timerUtils.wait(100);
        await fn();
      }
    }, 1000);
  }

  async saveServerSyncItemsToLocal({
    serverItems,
    shouldSyncToScene,
    syncCredential,
    serverPwdHash,
  }: {
    serverItems: ICloudSyncServerItem[];
    shouldSyncToScene: boolean;
    syncCredential: ICloudSyncCredential | undefined;
    serverPwdHash: string;
  }) {
    const localSyncItemsPromise: Promise<IDBCloudSyncItem>[] = serverItems.map(
      async (serverItem) =>
        this.convertServerItemToLocalItem({
          serverItem,
          shouldDecrypt: false,
          syncCredential,
          serverPwdHash,
        }),
    );
    const localItems: IDBCloudSyncItem[] = (
      await Promise.all(localSyncItemsPromise)
    ).filter(Boolean);

    return this.updateLocalItemsByServer({
      localItems,
      syncCredential,
      shouldSyncToScene,
    });
  }

  async saveServerDeletedItemsToLocal({
    deletedItemIds,
    shouldSyncToScene,
    syncCredential,
    serverPwdHash,
  }: {
    deletedItemIds: string[];
    shouldSyncToScene: boolean;
    syncCredential: ICloudSyncCredential | undefined;
    serverPwdHash: string;
  }) {
    const { records: items } = await localDb.getRecordsByIds({
      name: ELocalDBStoreNames.CloudSyncItem,
      ids: deletedItemIds,
    });

    await this.updateLocalItemsByServer({
      localItems: items.filter(Boolean).map((item) => {
        const newItem: IDBCloudSyncItem = {
          ...item,
          isDeleted: true,
          pwdHash: item.pwdHash || serverPwdHash,
        };
        cloudSyncItemBuilder.setDefaultPropsOfServerToLocalItem({
          localItem: newItem,
        });
        return newItem;
      }),
      syncCredential,
      shouldSyncToScene,
    });
  }

  async updateLocalItemsByServer({
    localItems,
    syncCredential,
    shouldSyncToScene,
  }: {
    localItems: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential | undefined;
    shouldSyncToScene: boolean;
  }) {
    console.log('updateLocalItemsByServer', localItems);
    await localDb.addAndUpdateSyncItems({
      items: localItems,
      // the data is already from the server, so it doesn't need to be uploaded back to the server
      skipUploadToServer: true,
    });
    console.log('updateLocalItemsByServer sucess', localItems);

    if (shouldSyncToScene && syncCredential) {
      // we need to query from the database again, not use the localSyncItems above, because when updating, the timestamp may not be written if it does not match
      const { records: items } = await localDb.getRecordsByIds({
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: localItems.map((item) => item.id),
      });
      await this.syncToSceneWithLocalSyncItems({
        items: items.filter(Boolean),
        syncCredential,
      });
      const deletedItems = items.filter(Boolean).filter((item) => {
        if (item && item.isDeleted) {
          const manager = this.getSyncManager(item.dataType);
          if (manager) {
            return manager.removeSyncItemIfServerDeleted;
          }
          return true;
        }
        return false;
      });

      if (deletedItems.length) {
        await localDb.removeCloudSyncPoolItems({
          keys: deletedItems.map((item) => item.id),
        });
      }
      void this.updateLastSyncTime();
    }
  }

  @backgroundMethod()
  @toastIfError()
  async startServerSyncFlow({
    isFlush,
    encryptedSecurityPasswordR1ForServer,
    setUndefinedTimeToNow,
    callerName,
  }: Omit<IStartServerSyncFlowParams, 'throwError'> = {}) {
    await this.startServerSyncFlowSilently({
      isFlush,
      encryptedSecurityPasswordR1ForServer,
      setUndefinedTimeToNow,
      throwError: true,
      callerName,
    });
  }

  @backgroundMethod()
  async startServerSyncFlowSilentlyThrottled(
    params: IStartServerSyncFlowParams = {},
  ) {
    await this._startServerSyncFlowSilentlyThrottled(params);
  }

  _startServerSyncFlowSilentlyThrottled = throttle(
    async (params: IStartServerSyncFlowParams = {}) => {
      await this.startServerSyncFlowSilently(params);
    },
    timerUtils.getTimeDurationMs({ minute: 1 }),
    {
      leading: true,
      trailing: false,
    },
  );

  @backgroundMethod()
  async startServerSyncFlowSilently({
    isFlush,
    encryptedSecurityPasswordR1ForServer,
    setUndefinedTimeToNow,
    throwError,
    callerName,
  }: IStartServerSyncFlowParams = {}) {
    try {
      if (!(await this.isCloudSyncIsAvailable())) {
        return;
      }
      await this.ensureCloudSyncIsAvailable({
        callerName,
      });

      // when data is written, because the cached password is missing to encrypt, so data is undefined
      await this.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: true, // will call server sync flow later
      });

      let { items: localItems } = await this.getAllLocalSyncItems();
      const allLocalItems = localItems;
      const totalItemsCount = allLocalItems.length;

      const pwdHash =
        await this.backgroundApi.serviceMasterPassword.getLocalMasterPasswordUUIDSafe();
      if (pwdHash) {
        localItems = allLocalItems.filter((item) => item.pwdHash === pwdHash);
        const availableItemsCount = localItems.length;
        if (availableItemsCount !== totalItemsCount && totalItemsCount > 0) {
          if (process.env.NODE_ENV !== 'production') {
            const invalidItems = allLocalItems.filter(
              (item) => item.pwdHash !== pwdHash,
            );
            console.log('invalidItems', invalidItems);
          }
          const removedItems = allLocalItems.filter(
            (item) => !item.rawData && item.pwdHash && item.pwdHash !== pwdHash,
          );
          if (removedItems.length) {
            void localDb.removeCloudSyncPoolItems({
              keys: removedItems.map((item) => item.id).filter(Boolean),
            });
          }
        }
      }
      // TODO remove pwdHash not matched items

      await this.startServerSyncFlowForItems({
        localItems,
        setUndefinedTimeToNow,
        isFlush,
        encryptedSecurityPasswordR1ForServer,
        isFullDBChecking: true,
      });
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      if (throwError) {
        throw error;
      }
    }

    // the server data has been downloaded, but it may not have been updated to the business scenario, so it needs to be executed again
    // checked by localSceneUpdated field
    await this.syncToSceneByAllPendingItems();

    return true;
  }

  async isCloudSyncIsAvailable() {
    try {
      await this.ensureCloudSyncIsAvailable();
      return true;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return false;
    }
  }

  async ensureCloudSyncIsAvailable({
    callerName = '',
  }: {
    callerName?: string;
  } = {}) {
    const devSettings = await devSettingsPersistAtom.get();
    const prime = await primePersistAtom.get();
    const primeAvailable =
      prime.isEnablePrime === true || devSettings.settings?.showPrimeTest;
    if (!primeAvailable) {
      throw new OneKeyError(`Prime DevSettings is not enabled: ${callerName}`);
    }

    const primeCloudSyncConfig = await primeCloudSyncPersistAtom.get();
    if (!primeCloudSyncConfig.isCloudSyncEnabled) {
      throw new OneKeyError(`Cloud sync is not enabled: ${callerName}`);
    }

    const isPrimeLoggedIn = await this.backgroundApi.servicePrime.isLoggedIn();
    if (!isPrimeLoggedIn) {
      throw new OneKeyError(`Prime is not logged in: ${callerName}`);
    }

    const isPrimeSubscriptionActive =
      await this.backgroundApi.servicePrime.isPrimeSubscriptionActive();
    if (!isPrimeSubscriptionActive) {
      throw new OneKeyError(`Prime subscription is not active: ${callerName}`);
    }
  }

  @backgroundMethod()
  async startServerSyncFlowForItems({
    localItems,
    isFlush,
    setUndefinedTimeToNow,
    encryptedSecurityPasswordR1ForServer,
    isFullDBChecking,
  }: {
    localItems: IDBCloudSyncItem[];
    isFlush?: boolean;
    setUndefinedTimeToNow?: boolean;
    encryptedSecurityPasswordR1ForServer?: string;
    isFullDBChecking?: boolean;
  }) {
    if (!(await this.isCloudSyncIsAvailable())) {
      return;
    }

    await this.ensureCloudSyncIsAvailable();

    // TODO check passcode, syncPassword, accountSalt, isPrime are both available

    const serverStatus = await this.apiCheckServerStatus({
      localItems,
      isFullDBChecking,
    });

    const syncCredential = await this.getSyncCredentialSafe();

    // server obsoleted items, should be uploaded to server
    if (serverStatus.obsoleted.length || isFlush) {
      console.log('serverStatus.obsoleted', serverStatus.obsoleted);
      const itemsToUpload = localItems.filter((item) =>
        serverStatus.obsoleted.includes(item.id),
      );
      await this.apiUploadItems({
        localItems: itemsToUpload,
        isFlush: isFlush ?? false,
        setUndefinedTimeToNow: setUndefinedTimeToNow ?? true,
        syncCredential,
        encryptedSecurityPasswordR1ForServer,
      });
    }

    // server diff items, should be compared with local items
    if (serverStatus.diff.length) {
      console.log('serverStatus.diff', serverStatus.diff);
      // TODO server returns missing data details, only key
      await this.saveServerSyncItemsToLocal({
        serverItems: serverStatus.diff,
        shouldSyncToScene: true,
        syncCredential,
        serverPwdHash: serverStatus.pwdHash,
      });
    }

    // server updated items, should be save to local
    if (serverStatus.updated.length) {
      console.log('serverStatus.updated', serverStatus.updated);
      await this.saveServerSyncItemsToLocal({
        serverItems: serverStatus.updated,
        shouldSyncToScene: true,
        syncCredential,
        serverPwdHash: serverStatus.pwdHash,
      });
    }

    // server deleted items, should be deleted from local
    if (serverStatus.deleted.length) {
      console.log('serverStatus.deleted', serverStatus.deleted);
      await this.saveServerDeletedItemsToLocal({
        deletedItemIds: serverStatus.deleted,
        shouldSyncToScene: true,
        syncCredential,
        serverPwdHash: serverStatus.pwdHash,
      });
    }
  }

  async getSyncCredentialSafe(): Promise<ICloudSyncCredential | undefined> {
    try {
      return await this.getSyncCredentialWithCache();
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return undefined;
    }
  }

  // TODO remove cache when logout, lock, change password/passcode, etc.
  getSyncCredentialWithCache = memoizee(
    async () => {
      const password =
        await this.backgroundApi.servicePassword.getCachedPassword();
      if (!password) {
        throw new OneKeyError('No password in memory');
      }

      const { masterPasswordUUID, encryptedSecurityPasswordR1 } =
        await primeMasterPasswordPersistAtom.get();
      if (!masterPasswordUUID || !encryptedSecurityPasswordR1) {
        void this.showAlertDialogIfLocalPasswordNotSet();
        throw new OneKeyError(
          'No masterPasswordUUID or encryptedSecurityPasswordR1 in atom',
        );
      }

      const securityPasswordR1Info =
        await this.backgroundApi.serviceMasterPassword.getSecurityPasswordR1InfoSafe(
          {
            passcode: password,
          },
        );
      const securityPasswordR1 = securityPasswordR1Info?.securityPasswordR1;
      const accountSalt = securityPasswordR1Info?.accountSalt;

      if (!securityPasswordR1) {
        throw new OneKeyError('Failed to decrypt securityPasswordR1');
      }
      if (!accountSalt) {
        throw new OneKeyError('Failed to get accountSalt');
      }

      return {
        primeAccountSalt: accountSalt,
        securityPasswordR1,
        masterPasswordUUID,
      };
    },
    {
      max: 1,
      maxAge: timerUtils.getTimeDurationMs({ hour: 8 }),
      promise: true,
    },
  );

  clearCachedSyncCredential() {
    return this.getSyncCredentialWithCache.clear();
  }

  @backgroundMethod()
  async setCloudSyncEnabled(
    enabled: boolean,
    {
      skipClearLocalMasterPassword,
    }: {
      skipClearLocalMasterPassword?: boolean;
    } = {},
  ) {
    if (!enabled && !skipClearLocalMasterPassword) {
      await this.backgroundApi.serviceMasterPassword.clearLocalMasterPassword({
        skipDisableCloudSync: true,
      });
    }
    await primeCloudSyncPersistAtom.set((v) => ({
      ...v,
      isCloudSyncEnabled: enabled,
    }));
  }

  @backgroundMethod()
  async updateLastSyncTime() {
    await primeCloudSyncPersistAtom.set(
      (v): IPrimeCloudSyncPersistAtomData => ({
        ...v,
        lastSyncTime: Date.now(),
      }),
    );
  }

  // TODO use jotai for Extension working
  async showMasterPasswordInvalidAlertDialog({
    shouldClearLocalMasterPassword,
    shouldDisableCloudSync,
  }: {
    shouldClearLocalMasterPassword: boolean;
    shouldDisableCloudSync: boolean;
  }) {
    const { isCloudSyncEnabled } = await primeCloudSyncPersistAtom.get();
    if (isCloudSyncEnabled) {
      const isPrimeLoggedIn =
        await this.backgroundApi.servicePrime.isLoggedIn();
      // const isPrimeSubscriptionActive =
      // await this.backgroundApi.servicePrime.isPrimeSubscriptionActive();
      if (isPrimeLoggedIn) {
        appEventBus.emit(
          EAppEventBusNames.PrimeMasterPasswordInvalid,
          undefined,
        );
        if (shouldClearLocalMasterPassword) {
          await this.backgroundApi.serviceMasterPassword.clearLocalMasterPassword(
            {
              skipDisableCloudSync: !shouldDisableCloudSync,
            },
          );
        }
        if (shouldDisableCloudSync) {
          await this.setCloudSyncEnabled(false);
        }
      }
    }
  }

  @backgroundMethod()
  async showAlertDialogIfServerPasswordChanged({
    serverUserInfo,
  }: {
    serverUserInfo: IPrimeServerUserInfo;
  }) {
    const serverPasswordUUID = serverUserInfo?.pwdHash;
    const { masterPasswordUUID } = await primeMasterPasswordPersistAtom.get();

    if (
      serverPasswordUUID &&
      masterPasswordUUID &&
      serverPasswordUUID !== RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID &&
      masterPasswordUUID !== RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID &&
      serverPasswordUUID !== masterPasswordUUID
    ) {
      await this.showMasterPasswordInvalidAlertDialog({
        shouldClearLocalMasterPassword: true,
        shouldDisableCloudSync: true,
      });
    }
  }

  @backgroundMethod()
  async showAlertDialogIfServerPasswordNotSet({
    serverUserInfo,
  }: {
    serverUserInfo: IPrimeServerUserInfo;
  }) {
    if (serverUserInfo.pwdHash) {
      return;
    }
    const { masterPasswordUUID, encryptedSecurityPasswordR1 } =
      await primeMasterPasswordPersistAtom.get();

    if (masterPasswordUUID && encryptedSecurityPasswordR1) {
      await this.showMasterPasswordInvalidAlertDialog({
        shouldClearLocalMasterPassword: false,
        shouldDisableCloudSync: true,
      });
    }
  }

  @backgroundMethod()
  async showAlertDialogIfLocalPasswordNotSet() {
    const { masterPasswordUUID, encryptedSecurityPasswordR1 } =
      await primeMasterPasswordPersistAtom.get();

    if (!masterPasswordUUID || !encryptedSecurityPasswordR1) {
      await this.showMasterPasswordInvalidAlertDialog({
        shouldClearLocalMasterPassword: true,
        shouldDisableCloudSync: true,
      });
    }
  }

  @backgroundMethod()
  async showAlertDialogIfLocalPasswordInvalid({
    error,
  }: {
    error: OneKeyErrorPrimeMasterPasswordInvalid;
  }) {
    if (
      error.className !==
      EOneKeyErrorClassNames.OneKeyErrorPrimeMasterPasswordInvalid
    ) {
      return;
    }
    const { masterPasswordUUID, encryptedSecurityPasswordR1 } =
      await primeMasterPasswordPersistAtom.get();

    if (masterPasswordUUID || encryptedSecurityPasswordR1) {
      await this.showMasterPasswordInvalidAlertDialog({
        shouldClearLocalMasterPassword: true,
        shouldDisableCloudSync: true,
      });
    }
  }

  async onWebSocketMasterPasswordChanged(
    payload: IPrimeConfigFlushInfo | IPrimeLockChangedInfo,
  ) {
    const { masterPasswordUUID } = await primeMasterPasswordPersistAtom.get();
    if (masterPasswordUUID && masterPasswordUUID !== payload.pwdHash) {
      await this.showAlertDialogIfLocalPasswordInvalid({
        error: new OneKeyErrorPrimeMasterPasswordInvalid(),
      });
    }
  }

  async initLocalSyncItemsDBForLegacyIndexedAccount() {
    const { indexedAccounts: allIndexedAccounts } =
      await this.backgroundApi.serviceAccount.getAllIndexedAccounts({});
    console.log('initLocalSyncItemsDBForLegacyIndexedAccount');
    const syncItemsForIndexedAccounts: IDBCloudSyncItem[] =
      await this.syncManagers.indexedAccount._buildInitSyncDBItems({
        dbRecords: allIndexedAccounts,
        syncCredential: undefined,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });
    await localDb.addAndUpdateSyncItems({
      items: syncItemsForIndexedAccounts,
      skipUploadToServer: true, // startSyncFlow() will handle uploading to server
    });
  }

  @backgroundMethod()
  async initLocalSyncItemsDB({
    syncCredential,
    password,
  }: {
    syncCredential: ICloudSyncCredential;
    password?: string;
  }) {
    if (!password) {
      // eslint-disable-next-line no-param-reassign
      ({ password } =
        await this.backgroundApi.servicePassword.promptPasswordVerify({
          reason: ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD
            ? EReasonForNeedPassword.Security
            : undefined,
        }));
    }

    await this.backgroundApi.serviceAccount.generateAllHdAndQrWalletsHashAndXfp(
      {
        password,
      },
    );

    await this.backgroundApi.serviceAccount.mergeDuplicateHDWallets({
      password,
    });

    const { wallets: allWallets, allDevices } =
      await this.backgroundApi.serviceAccount.getAllWallets({
        refillWalletInfo: true,
      });
    // TODO only get watching or imported accounts for better performance
    const { accounts: allAccounts } =
      await this.backgroundApi.serviceAccount.getAllAccounts({});
    const { indexedAccounts: allIndexedAccounts } =
      await this.backgroundApi.serviceAccount.getAllIndexedAccounts({
        allWallets,
      });

    // TODO performance: only build missing sync items
    const syncItemsForWallets: IDBCloudSyncItem[] =
      await this.syncManagers.wallet.buildInitSyncDBItems({
        dbRecords: allWallets,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });
    const syncItemsForAccounts: IDBCloudSyncItem[] =
      await this.syncManagers.account.buildInitSyncDBItems({
        dbRecords: allAccounts,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });
    const syncItemsForIndexedAccounts: IDBCloudSyncItem[] =
      await this.syncManagers.indexedAccount.buildInitSyncDBItems({
        dbRecords: allIndexedAccounts,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });

    const allBookmarks: IBrowserBookmark[] =
      (await this.backgroundApi.serviceDiscovery.getBrowserBookmarksWithFillingSortIndex()) ||
      [];
    const syncItemsForBookmarks: IDBCloudSyncItem[] =
      await this.syncManagers.browserBookmark.buildInitSyncDBItems({
        dbRecords: allBookmarks,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });

    const allMarketWatchList: IMarketWatchListItem[] =
      (
        await this.backgroundApi.serviceMarket.getMarketWatchListWithFillingSortIndex()
      )?.data || [];
    const syncItemsForMarketWatchList: IDBCloudSyncItem[] =
      await this.syncManagers.marketWatchList.buildInitSyncDBItems({
        dbRecords: allMarketWatchList,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });

    const allCustomRpc: IDBCustomRpc[] =
      (await this.backgroundApi.serviceCustomRpc.getAllCustomRpc()) || [];
    const syncItemsForCustomRpc: IDBCloudSyncItem[] =
      await this.syncManagers.customRpc.buildInitSyncDBItems({
        dbRecords: allCustomRpc,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });

    const allCustomNetwork: IServerNetwork[] =
      (await this.backgroundApi.serviceCustomRpc.getAllCustomNetworks()) || [];
    const syncItemsForCustomNetwork: IDBCloudSyncItem[] =
      await this.syncManagers.customNetwork.buildInitSyncDBItems({
        dbRecords: allCustomNetwork,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });

    let syncItemsForAddressBook: IDBCloudSyncItem[] = [];
    const { isSafe, items: safeAddressBookItems } =
      await this.backgroundApi.serviceAddressBook.getSafeRawItems({ password });
    if (isSafe && safeAddressBookItems?.length) {
      syncItemsForAddressBook =
        await this.syncManagers.addressBook.buildInitSyncDBItems({
          dbRecords: safeAddressBookItems,
          allDevices,
          syncCredential,
          // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
          initDataTime: undefined,
        });
    }

    const allHiddenTokens: ICloudSyncCustomToken[] =
      (await this.backgroundApi.serviceCustomToken.getAllHiddenTokens()) || [];
    const syncItemsForHiddenTokens: IDBCloudSyncItem[] =
      await this.syncManagers.customToken.buildInitSyncDBItems({
        dbRecords: allHiddenTokens,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });

    const allCustomTokens: ICloudSyncCustomToken[] =
      (await this.backgroundApi.serviceCustomToken.getAllCustomTokens()) || [];
    const syncItemsForCustomTokens: IDBCloudSyncItem[] =
      await this.syncManagers.customToken.buildInitSyncDBItems({
        dbRecords: allCustomTokens,
        allDevices,
        syncCredential,
        // for legacy data, dateTime must be undefined, so that users can manually resolve conflicts
        initDataTime: undefined,
      });

    const totalItems = [
      ...syncItemsForWallets,
      ...syncItemsForAccounts,
      ...syncItemsForIndexedAccounts,
      ...syncItemsForBookmarks,
      ...syncItemsForMarketWatchList,
      ...syncItemsForCustomRpc,
      ...syncItemsForCustomNetwork,
      ...syncItemsForAddressBook,
      ...syncItemsForHiddenTokens,
      ...syncItemsForCustomTokens,
    ];

    // const totalItemsUniqById = uniqBy(totalItems, (item) => item.id);
    // const totalItemsUniqByDeleted = uniqBy(totalItems, (item) => item.isDeleted);

    await localDb.addAndUpdateSyncItems({
      items: totalItems,
      // as init item dataTime is undefined, server will reject the upload
      skipUploadToServer: true, // startSyncFlow() will handle uploading to server
    });

    // TODO rebuild missing item.data if needed, as data is undefined when credential is not available (prime is inactive)

    return {
      allWallets, // TODO handle same hash HD wallets
      allDevices,
      allAccounts,
      allIndexedAccounts,
    };
  }

  async fillingSyncItemsMissingDataFromRawData({
    skipUploadToServer,
  }: {
    skipUploadToServer: boolean;
  }) {
    const syncCredential = await this.getSyncCredentialSafe();
    if (!syncCredential) {
      return;
    }
    // TODO performance, use cursor to get items
    const { items } = await this.getAllLocalSyncItems();
    const itemsToUpdate: IDBCloudSyncItem[] = [];
    for (const item of items) {
      try {
        if (!item.data && item.rawData) {
          const syncManager = this.getSyncManager(item.dataType);
          const rawDataJson = item.rawData
            ? (JSON.parse(item.rawData) as ICloudSyncRawDataJson | undefined)
            : undefined;

          if (rawDataJson?.payload) {
            let target: any;
            if (item.isDeleted) {
              target = await syncManager.buildSyncTargetByPayload({
                payload: rawDataJson?.payload as any,
              });
            } else {
              target = await syncManager.buildSyncTargetByPayload({
                payload: rawDataJson?.payload as any,
              });
              // const record = await syncManager.getDBRecordBySyncPayload({
              //   payload: rawDataJson?.payload as any,
              // });
              // if (record) {
              //   target = await syncManager.buildSyncTargetByDBQuery({
              //     dbRecord: record as never,
              //   });
              // }
            }
            if (target) {
              const itemToUpdate = await syncManager.buildSyncItem({
                target: target as never,
                dataTime: item.dataTime,
                syncCredential,
                isDeleted: item.isDeleted,
              });
              if (itemToUpdate) itemsToUpdate.push(itemToUpdate);
            }
          }
        }
      } catch (error) {
        console.error('fillingSyncItemsMissingData error', error);
      }
    }
    if (itemsToUpdate.length) {
      await localDb.addAndUpdateSyncItems({
        items: itemsToUpdate,
        skipUploadToServer,
      });
    }
  }

  @backgroundMethod()
  @toastIfError()
  async enableCloudSync(): Promise<{
    success: boolean;
    isServerMasterPasswordSet?: boolean;
    encryptedSecurityPasswordR1ForServer?: string;
    serverDiffItems?: ICloudSyncServerDiffItem[];
  }> {
    if (systemTimeUtils.systemTimeStatus === ELocalSystemTimeStatus.INVALID) {
      throw new OneKeyError(
        appLocale.intl.formatMessage({
          id: ETranslations.prime_time_error_description,
        }),
      );
    }

    const isPrimeLoggedIn = await this.backgroundApi.servicePrime.isLoggedIn();
    if (!isPrimeLoggedIn) {
      throw new OneKeyError('Prime is not logged in');
    }
    const isPrimeSubscriptionActive =
      await this.backgroundApi.servicePrime.isPrimeSubscriptionActive();
    if (!isPrimeSubscriptionActive) {
      throw new OneKeyErrorPrimePaidMembershipRequired();
    }
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify({
        reason: ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD
          ? EReasonForNeedPassword.Security
          : undefined,
        dialogProps: {
          // custom title not working
          title: 'Enable OneKey Cloud',
          description: appLocale.intl.formatMessage({
            id: ETranslations.prime_verify_passcode_enable_cloud,
          }),
        },
      });

    const { isServerMasterPasswordSet, encryptedSecurityPasswordR1ForServer } =
      await this.backgroundApi.serviceMasterPassword.setupMasterPassword({
        passcode: password,
      });

    let syncCredential: ICloudSyncCredential | undefined;

    const shouldManualResolveDiffItems = false;

    const serverStatus = await this.withDialogLoading(
      {
        // title: 'Initializing data',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_processing,
        }),
      },
      async () => {
        syncCredential = await this.getSyncCredentialSafe();
        // verify local password match with server master password
        if (!syncCredential) {
          throw new OneKeyError('Master password set failed');
        }
        await this.initLocalSyncItemsDB({ password, syncCredential });
        let status:
          | {
              deleted: string[];
              diff: ICloudSyncServerItem[];
              updated: ICloudSyncServerItem[];
              obsoleted: string[];
              pwdHash: string;
            }
          | undefined;
        if (shouldManualResolveDiffItems) {
          const { items: localItems } = await this.getAllLocalSyncItems();
          status = await this.apiCheckServerStatus({
            localItems,
            isFullDBChecking: true,
          });
        }
        await timerUtils.wait(1000);
        return status;
      },
    );

    if (shouldManualResolveDiffItems && serverStatus?.diff?.length) {
      const serverDiffItems: ICloudSyncServerDiffItem[] = [];
      for (const serverItem of serverStatus.diff) {
        const serverToLocalItem = await this.convertServerItemToLocalItem({
          serverItem,
          shouldDecrypt: true,
          syncCredential,
          serverPwdHash: serverStatus.pwdHash,
        });
        const syncManager = this.getSyncManager(serverItem.dataType);
        const localItem = await localDb.getSyncItemSafe({
          id: serverItem.key,
        });
        const serverPayload = serverToLocalItem?.rawDataJson?.payload;
        let record: IDBWallet | IDBAccount | IDBIndexedAccount | undefined;
        if (serverPayload) {
          record = await syncManager.getDBRecordBySyncPayload({
            payload: serverPayload as any,
          });
        }
        serverDiffItems.push({
          serverToLocalItem,
          localItem,
          serverPayload,
          record,
        });
      }
      return {
        success: false,
        serverDiffItems, // require manual resolve from UI
      };
    }

    return {
      success: true,
      isServerMasterPasswordSet,
      encryptedSecurityPasswordR1ForServer,
    };
  }

  async getAllLocalSyncItems() {
    const { syncItems } = await localDb.getAllSyncItems();
    return { items: syncItems };
  }

  @backgroundMethod()
  @toastIfError()
  async decryptAllLocalSyncItems() {
    await this.getSyncCredentialWithCache();
    const { items } = await this.getAllLocalSyncItems();
    console.log('getAllLocalSyncItems: ', { localItems: items });
    const syncCredential = await this.getSyncCredentialSafe();
    const result: IDBCloudSyncItem[] = [];
    for (const item of items) {
      try {
        const decryptedData = await cloudSyncItemBuilder.decryptSyncItem({
          item,
          syncCredential,
        });
        if (decryptedData) {
          console.log(
            'decryptAllLocalSyncItems: ',
            decryptedData?.rawDataJson?.payload,
            decryptedData,
          );
        }
        result.push(decryptedData.dbItem || item);
      } catch (error) {
        result.push(item);
        console.error('decryptAllLocalSyncItems error', error, item);
      }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  @backgroundMethod()
  @toastIfError()
  async clearAllLocalSyncItems() {
    await localDb.clearAllSyncItems();
  }

  convertLocalItemToServerItem({
    localItem,
    dataTimestamp,
  }: {
    localItem: IDBCloudSyncItem;
    dataTimestamp?: number;
  }): ICloudSyncServerItem {
    const serverItem: ICloudSyncServerItem = {
      key: localItem.id,
      dataType: localItem.dataType,
      data: localItem.data || '',
      dataTimestamp: dataTimestamp ?? localItem.dataTime,
      isDeleted: localItem.isDeleted,
      pwdHash: localItem.pwdHash,
    };
    return serverItem;
  }

  async convertServerItemToLocalItem({
    serverItem,
    shouldDecrypt,
    syncCredential,
    serverPwdHash,
  }: {
    serverItem: ICloudSyncServerItem;
    shouldDecrypt?: boolean; // decrypt the data to rawDataJson
    syncCredential: ICloudSyncCredential | undefined;
    serverPwdHash: string;
  }): Promise<IDBCloudSyncItem> {
    const localItem: IDBCloudSyncItem = {
      id: serverItem.key,
      rawKey: '',
      rawData: '',
      dataType: serverItem.dataType, // TODO return from server
      data: serverItem.data,
      dataTime: serverItem.dataTimestamp,
      isDeleted: serverItem.isDeleted,

      pwdHash: serverItem.pwdHash || serverPwdHash,

      localSceneUpdated: false, // server item
      serverUploaded: false,
    };
    cloudSyncItemBuilder.setDefaultPropsOfServerToLocalItem({
      localItem,
    });
    if (shouldDecrypt) {
      const decryptedItem = await cloudSyncItemBuilder.decryptSyncItem({
        item: localItem,
        syncCredential,
      });
      if (decryptedItem.dbItem) {
        return decryptedItem.dbItem;
      }
    }
    return localItem;
  }

  @backgroundMethod()
  async timeNow(): Promise<number> {
    return systemTimeUtils.getTimeNow();
  }

  @backgroundMethod()
  async getLocalSystemTimeStatus() {
    return {
      status: systemTimeUtils.systemTimeStatus,

      lastServerTime: systemTimeUtils.lastServerTime,
      lastServerTimeDate: new Date(
        systemTimeUtils.lastServerTime ?? 0,
      ).toISOString(),

      lastLocalTime: systemTimeUtils.lastLocalTime,
      lastLocalTimeDate: new Date(
        systemTimeUtils.lastLocalTime ?? 0,
      ).toISOString(),
    };
  }

  @backgroundMethod()
  @toastIfError()
  async decryptAllServerSyncItems({
    includeDeleted,
  }: {
    includeDeleted?: boolean;
  } = {}) {
    await this.getSyncCredentialWithCache();
    const { serverData: items, pwdHash } = await this.apiDownloadItems({
      includeDeleted,
    });
    const localItems: IDBCloudSyncItem[] = [];
    const syncCredential = await this.getSyncCredentialSafe();
    for (const item of items) {
      const localItem = await this.convertServerItemToLocalItem({
        serverItem: item,
        shouldDecrypt: true,
        syncCredential,
        serverPwdHash: pwdHash,
      });
      localItems.push(localItem);
      if (localItem) {
        console.log(
          'decryptAllServerSyncItems: ',
          localItem?.rawDataJson?.payload,
          localItem,
        );
      }
    }
    return localItems.sort((a, b) => a.id.localeCompare(b.id));
  }

  @backgroundMethodForDev()
  async demoDownloadAllServerSyncItemsAndSaveToLocal() {
    const localItems = await this.decryptAllServerSyncItems();
    await localDb.addAndUpdateSyncItems({
      items: localItems,
      skipUploadToServer: true,
    });
  }

  @backgroundMethodForDev()
  async demoCopyDevice() {
    if (process.env.NODE_ENV !== 'production') {
      const fromDeviceId = '8fe72eee-e6e5-4327-b923-517f960da17d';
      const toDeviceId = '5bb89656-571f-4d24-a2de-2f499775b7a9';
      const device = await localDb.getRecordById({
        name: ELocalDBStoreNames.Device,
        id: fromDeviceId,
      });
      await localDb.withTransaction(
        EIndexedDBBucketNames.account,
        async (tx) => {
          await localDb.txAddRecords({
            tx,
            name: ELocalDBStoreNames.Device,
            skipIfExists: true,
            records: [
              {
                ...device,
                id: toDeviceId,
              },
            ],
          });
        },
      );
    }
  }

  @backgroundMethodForDev()
  async demoClearSyncItemPwdHash() {
    const { syncItems } = await localDb.getAllSyncItems();
    await localDb.withTransaction(
      // EIndexedDBBucketNames.cloudSync,
      EIndexedDBBucketNames.account,
      async (tx) => {
        await localDb.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: syncItems.map((item) => item.id),
          updater: (record) => {
            record.pwdHash = '';
            return record;
          },
        });
      },
    );
  }

  @backgroundMethodForDev()
  async demoTamperingLocalSyncItemData() {
    const { syncItems } = await localDb.getAllSyncItems();
    await localDb.withTransaction(
      // EIndexedDBBucketNames.cloudSync,
      EIndexedDBBucketNames.account,
      async (tx) => {
        await localDb.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: syncItems.map((item) => item.id),
          updater: (record) => {
            record.data = '999999';
            record.localSceneUpdated = false;
            return record;
          },
        });
      },
    );
  }

  @backgroundMethodForDev()
  async demoTamperingLocalSyncItemDataTime() {
    const { syncItems } = await localDb.getAllSyncItems();
    await localDb.withTransaction(
      // EIndexedDBBucketNames.cloudSync,
      EIndexedDBBucketNames.account,
      async (tx) => {
        await localDb.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: syncItems.map((item) => item.id),
          updater: (record) => {
            record.dataTime = 2_000_000_000_000;
            return record;
          },
        });
      },
    );
  }
}

export default ServicePrimeCloudSync;
