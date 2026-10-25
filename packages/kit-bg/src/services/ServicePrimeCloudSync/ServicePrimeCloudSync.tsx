/* eslint-disable no-continue */
import { Semaphore } from 'async-mutex';
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
  CLOUD_SYNC_ID_SUNSET_REMINDER_TOAST_ID,
  EPrimeCloudSyncDataType,
  RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID,
} from '@onekeyhq/shared/src/consts/primeConsts';
import {
  OneKeyError,
  OneKeyErrorPrimeMasterPasswordInvalid,
  OneKeyErrorPrimePaidMembershipRequired,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  ECustomCloudSyncError,
  EOneKeyErrorClassNames,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import systemTimeUtils, {
  ECloudSyncDataTimeSource,
  ELocalSystemTimeStatus,
  type ICloudSyncCorrectedTime,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';
import type {
  ICloudSyncAccountIssueUpdate,
  ICloudSyncAccountStatusCounts,
  ICloudSyncReconciliationPersistState,
} from '@onekeyhq/shared/types/prime/cloudSyncReconciliationState';
import type {
  ICloudSyncBotWalletRecord,
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCheckServerStatusResult,
  ICloudSyncCredential,
  ICloudSyncCredentialForLock,
  ICloudSyncDBRecord,
  ICloudSyncDownloadPostData,
  ICloudSyncDownloadResult,
  ICloudSyncRawDataJson,
  ICloudSyncServerDiffItem,
  ICloudSyncServerItem,
  ICloudSyncServerItemByDownloaded,
  ICloudSyncUploadPostData,
  ICloudSyncUploadResult,
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
  type IDBCloudSyncItem,
  type IDBWallet,
} from '../../dbs/local/types';
import simpleDb from '../../dbs/simple/simpleDb';
import {
  addressBookPersistAtom,
  devSettingsPersistAtom,
  primeCloudSyncPersistAtom,
  primeMasterPasswordPersistAtom,
  primePersistAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { filterBotWalletRecordsByCurrentKeylessSyncScope } from './botWalletCloudSyncUtils';
import { buildOnlyCheckLocalDataTypes } from './cloudSyncCheckUtils';
import { CloudSyncFlowManagerAccount } from './CloudSyncFlowManager/CloudSyncFlowManagerAccount';
import { CloudSyncFlowManagerAddressBook } from './CloudSyncFlowManager/CloudSyncFlowManagerAddressBook';
import { CloudSyncFlowManagerBotWallet } from './CloudSyncFlowManager/CloudSyncFlowManagerBotWallet';
import { CloudSyncFlowManagerBrowserBookmark } from './CloudSyncFlowManager/CloudSyncFlowManagerBrowserBookmark';
import { CloudSyncFlowManagerCustomNetwork } from './CloudSyncFlowManager/CloudSyncFlowManagerCustomNetwork';
import { CloudSyncFlowManagerCustomRpc } from './CloudSyncFlowManager/CloudSyncFlowManagerCustomRpc';
import { CloudSyncFlowManagerCustomToken } from './CloudSyncFlowManager/CloudSyncFlowManagerCustomToken';
import { CloudSyncFlowManagerIndexedAccount } from './CloudSyncFlowManager/CloudSyncFlowManagerIndexedAccount';
import { CloudSyncFlowManagerLock } from './CloudSyncFlowManager/CloudSyncFlowManagerLock';
import { CloudSyncFlowManagerMarketWatchList } from './CloudSyncFlowManager/CloudSyncFlowManagerMarketWatchList';
import { CloudSyncFlowManagerWallet } from './CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import { splitCloudSyncUploadPostData } from './cloudSyncUploadBatching';
import keylessCloudSyncUtils from './keylessCloudSyncUtils';
import {
  PUBLIC_ACCOUNT_SNAPSHOT_PREFIX,
  PublicAccountSnapshotUnsupportedError,
  normalizePublicAccountSnapshotRecord,
} from './publicAccountSnapshot';
import {
  isRejectedPublicAccountSnapshotWrite,
  rememberPublicAccountSnapshotWrite,
} from './publicAccountSnapshotWriteGuard';

import type { RealmSchemaCloudSyncItem } from '../../dbs/local/realm/schemas/RealmSchemaCloudSyncItem';
import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms';
import type { AxiosResponse } from 'axios';

const nonceZero = 0;

type IApiUploadItemsParams = {
  localItems: IDBCloudSyncItem[];
  isFlush?: boolean;
  isReset?: boolean;
  skipPrimeStatusCheck?: boolean;
  setUndefinedTimeToNow?: boolean;
  syncCredential?: ICloudSyncCredential | undefined;
  encryptedSecurityPasswordR1ForServer?: string;
  noDebounceUpload?: boolean;
};

type IApiUploadFreshItemsParams = IApiUploadItemsParams;

type ICloudSyncDataTimeParams = {
  syncItemKey?: string;
  existingDataTime?: number;
  explicitHistoricalTime?: number;
  allowHistoricalTime?: boolean;
};

// Guard for the first-enable window: server pwdHash can be temporarily empty
// before initial flush/lock upload finishes.
let oneKeyIdCloudSyncEnableFlowCount = 0;

const CLOUD_SYNC_DATA_TIME_FUTURE_TOLERANCE_MS = timerUtils.getTimeDurationMs({
  minute: 10,
});
const CLOUD_SYNC_LAST_ISSUED_DATA_TIME_MAX_ENTRIES = 1000;
const CLOUD_SYNC_LAST_ISSUED_DATA_TIME_TTL_MS = timerUtils.getTimeDurationMs({
  minute: 30,
});

@backgroundClass()
class ServicePrimeCloudSync extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private _lastSunsetReminderTime = 0;

  private _lastIssuedCloudSyncDataTimeByKey = new Map<
    string,
    { dataTime: number; updatedAt: number }
  >();

  private cleanupLastIssuedCloudSyncDataTimeByKey() {
    if (
      this._lastIssuedCloudSyncDataTimeByKey.size <=
      CLOUD_SYNC_LAST_ISSUED_DATA_TIME_MAX_ENTRIES
    ) {
      return;
    }

    const now = Date.now();
    for (const [key, item] of this._lastIssuedCloudSyncDataTimeByKey) {
      if (now - item.updatedAt > CLOUD_SYNC_LAST_ISSUED_DATA_TIME_TTL_MS) {
        this._lastIssuedCloudSyncDataTimeByKey.delete(key);
      }
    }

    if (
      this._lastIssuedCloudSyncDataTimeByKey.size >
      CLOUD_SYNC_LAST_ISSUED_DATA_TIME_MAX_ENTRIES
    ) {
      this._lastIssuedCloudSyncDataTimeByKey.clear();
    }
  }

  private isCloudSyncDataTimeFuturePoisoned({
    dataTime,
    correctedNow,
  }: {
    dataTime: number | undefined;
    correctedNow?: ICloudSyncCorrectedTime;
  }) {
    return systemTimeUtils.isCloudSyncDataTimeFuturePoisoned({
      dataTime,
      correctedNow,
      tolerance: CLOUD_SYNC_DATA_TIME_FUTURE_TOLERANCE_MS,
    });
  }

  @backgroundMethod()
  async getCloudSyncDataTime({
    syncItemKey,
    existingDataTime,
    explicitHistoricalTime,
    allowHistoricalTime,
  }: ICloudSyncDataTimeParams = {}): Promise<number> {
    let correctedNow: ICloudSyncCorrectedTime;
    if (!systemTimeUtils.hasFreshServerTimeInCurrentProcess()) {
      void systemTimeUtils.ensureFreshServerTime().catch((error) => {
        errorUtils.autoPrintErrorIgnore(error);
      });
      correctedNow =
        systemTimeUtils.systemTimeStatus === ELocalSystemTimeStatus.INVALID
          ? systemTimeUtils.getCorrectedCloudSyncNow()
          : {
              time: Date.now(),
              source: ECloudSyncDataTimeSource.LocalFallback,
            };
    } else {
      correctedNow = systemTimeUtils.getCorrectedCloudSyncNow();
    }

    if (allowHistoricalTime && !isNil(explicitHistoricalTime)) {
      if (correctedNow.source === ECloudSyncDataTimeSource.AppBuild) {
        return explicitHistoricalTime;
      }
      return Math.min(explicitHistoricalTime, correctedNow.time);
    }

    let dataTime = correctedNow.time;
    const lastIssued = syncItemKey
      ? this._lastIssuedCloudSyncDataTimeByKey.get(syncItemKey)?.dataTime
      : undefined;

    const existingFuturePoisoned = this.isCloudSyncDataTimeFuturePoisoned({
      dataTime: existingDataTime,
      correctedNow,
    });
    const lastIssuedFuturePoisoned = this.isCloudSyncDataTimeFuturePoisoned({
      dataTime: lastIssued,
      correctedNow,
    });

    const monotonicFloor = Math.max(
      existingFuturePoisoned ? 0 : (existingDataTime ?? 0),
      lastIssuedFuturePoisoned ? 0 : (lastIssued ?? 0),
    );

    if (dataTime <= monotonicFloor) {
      dataTime = monotonicFloor + 1;
    }

    if (syncItemKey) {
      this._lastIssuedCloudSyncDataTimeByKey.set(syncItemKey, {
        dataTime,
        updatedAt: Date.now(),
      });
      this.cleanupLastIssuedCloudSyncDataTimeByKey();
    }

    return dataTime;
  }

  private async notifyOnekeyIdSyncSunset() {
    const now = Date.now();
    const ONE_DAY = timerUtils.getTimeDurationMs({ day: 1 });
    if (now - this._lastSunsetReminderTime < ONE_DAY) return;

    const { isCloudSyncEnabled } = await primeCloudSyncPersistAtom.get();
    if (!isCloudSyncEnabled) return;

    this._lastSunsetReminderTime = now;

    void this.backgroundApi.serviceApp.showToast({
      method: 'warning',
      title: appLocale.intl.formatMessage({
        id: ETranslations.switch_to_keyless_wallet_sync__title,
      }),
      message: appLocale.intl.formatMessage({
        id: ETranslations.switch_to_keyless_wallet_sync__desc,
      }),
      toastId: CLOUD_SYNC_ID_SUNSET_REMINDER_TOAST_ID,
      errorCode: ECustomCloudSyncError.OnekeyIdSyncSunsetReminder,
    });
  }

  syncManagers = {
    wallet: new CloudSyncFlowManagerWallet({
      backgroundApi: this.backgroundApi,
    }),
    botWallet: new CloudSyncFlowManagerBotWallet({
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

  // ============ Keyless Cloud Sync Methods ============
  async getKeylessWallet(): Promise<IDBWallet | null> {
    return this.backgroundApi.serviceKeylessCloudSync.getKeylessWallet();
  }

  async getKeylessCloudSyncCredential(): Promise<IKeylessCloudSyncCredential | null> {
    return this.backgroundApi.serviceKeylessCloudSync.getKeylessCloudSyncCredential();
  }

  @backgroundMethod()
  async getActiveSyncMode(): Promise<ECloudSyncMode> {
    return this.backgroundApi.serviceKeylessCloudSync.getActiveSyncMode();
  }

  async getKeylessSyncAuth<T extends Record<string, unknown>>({
    postData,
  }: {
    postData: T;
  }): Promise<{
    publicKey: string;
    signatureHeader: string;
    pwdHash: string | undefined;
    fullPostData: T & { pwdHash: string | undefined };
  } | null> {
    return this.backgroundApi.serviceKeylessCloudSync.getKeylessSyncAuth({
      postData,
    });
  }

  async apiCheckServerStatusKeyless({
    postData,
    requestOptions,
  }: {
    postData: ICloudSyncCheckServerStatusPostData;
    requestOptions?: { signal?: AbortSignal; timeout?: number };
  }) {
    return this.backgroundApi.serviceKeylessCloudSync.apiCheckServerStatusKeyless(
      {
        postData,
        requestOptions,
      },
    );
  }

  async apiDownloadItemsKeyless({
    postData,
  }: {
    postData: ICloudSyncDownloadPostData;
  }) {
    return this.backgroundApi.serviceKeylessCloudSync.apiDownloadItemsKeyless({
      postData,
    });
  }

  async apiUploadItemsKeyless({
    postData,
    urlPath,
    requestOptions,
  }: {
    postData: ICloudSyncUploadPostData;
    urlPath: string;
    requestOptions?: { signal?: AbortSignal; timeout?: number };
  }) {
    return this.backgroundApi.serviceKeylessCloudSync.apiUploadItemsKeyless({
      postData,
      urlPath,
      requestOptions,
    });
  }

  computePwdHashForMode(
    syncCredential: ICloudSyncCredential | undefined,
    targetMode: ECloudSyncMode,
  ): string {
    return this.backgroundApi.serviceKeylessCloudSync.computePwdHashForMode(
      syncCredential,
      targetMode,
    );
  }

  buildCredentialForTargetMode(
    syncCredential: ICloudSyncCredential | undefined,
    targetMode: ECloudSyncMode,
  ): ICloudSyncCredential | undefined {
    return this.backgroundApi.serviceKeylessCloudSync.buildCredentialForTargetMode(
      syncCredential,
      targetMode,
    );
  }

  async convertSyncItemsForModeSwitch({
    items,
    targetMode,
    syncCredential,
  }: {
    items: IDBCloudSyncItem[];
    targetMode: ECloudSyncMode;
    syncCredential: ICloudSyncCredential | undefined;
  }): Promise<IDBCloudSyncItem[]> {
    return this.backgroundApi.serviceKeylessCloudSync.convertSyncItemsForModeSwitch(
      {
        items,
        targetMode,
        syncCredential,
      },
    );
  }

  async handleModeSwitchConversion(newMode: ECloudSyncMode): Promise<void> {
    return this.backgroundApi.serviceKeylessCloudSync.handleModeSwitchConversion(
      newMode,
    );
  }

  // ============ End of Keyless Cloud Sync Methods ============

  getSyncManager(dataType: EPrimeCloudSyncDataType) {
    switch (dataType) {
      case EPrimeCloudSyncDataType.Wallet:
        return this.syncManagers.wallet;
      case EPrimeCloudSyncDataType.BotWallet:
        return this.syncManagers.botWallet;
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

  private publicAccountSnapshotImportGeneration = 0;

  private reconciliationAbortController: AbortController | undefined;

  private cloudSyncItemAbortControllers = new Set<AbortController>();

  private reconciliationTimer: ReturnType<typeof setTimeout> | undefined;

  private fullSyncPromise: Promise<boolean | undefined> | undefined;

  private fullSyncRequested = false;

  private localReplayPromise: Promise<void> | undefined;

  private boundedCheckUnsupported = false;

  private assertCloudSyncGeneration(generation: number) {
    if (
      generation !== this.publicAccountSnapshotImportGeneration ||
      this.reconciliationAbortController?.signal.aborted
    ) {
      throw new OneKeyLocalError(
        'Cloud sync was cancelled. Pending data has been preserved.',
      );
    }
  }

  private clearReconciliationTimer() {
    if (this.reconciliationTimer) clearTimeout(this.reconciliationTimer);
    this.reconciliationTimer = undefined;
  }

  private scheduleReconciliation(nextRetryAt: number) {
    this.clearReconciliationTimer();
    this.reconciliationTimer = setTimeout(
      () => {
        this.reconciliationTimer = undefined;
        void this.resumeCloudSyncReconciliation({ reason: 'timer' }).catch(
          (error) => errorUtils.autoPrintErrorIgnore(error),
        );
      },
      Math.max(1000, nextRetryAt - Date.now()),
    );
  }

  @backgroundMethod()
  async resumeCloudSyncReconciliation({
    reason,
  }: {
    reason:
      | 'startup'
      | 'unlock'
      | 'network'
      | 'foreground'
      | 'timer'
      | 'manual';
  }) {
    if (await this.backgroundApi.serviceApp.isAppLocked()) return;
    if (!(await this.isCloudSyncIsAvailable())) return;
    const credential = await this.getSyncCredentialSafe();
    const spaceId = cloudSyncItemBuilder.getPwdHash(credential);
    if (!spaceId) return;
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const isCurrent = () =>
      generation === this.publicAccountSnapshotImportGeneration &&
      keyGeneration ===
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const config = await primeCloudSyncPersistAtom.get();
    const state =
      config.cloudSyncReconciliation?.spaceId === spaceId
        ? config.cloudSyncReconciliation
        : undefined;
    if (
      state &&
      !state.unfinished &&
      config.cloudSyncAccountApplyVersion === 2 &&
      state?.status !== 'partial'
    )
      return;
    if (state?.nextRetryAt && state.nextRetryAt > Date.now()) {
      const nextRetryAt = Math.min(state.nextRetryAt, Date.now() + 30 * 60_000);
      if (nextRetryAt !== state.nextRetryAt)
        await primeCloudSyncPersistAtom.set((value) => ({
          ...value,
          cloudSyncReconciliation:
            value.cloudSyncReconciliation?.spaceId === state.spaceId
              ? { ...value.cloudSyncReconciliation, nextRetryAt }
              : value.cloudSyncReconciliation,
        }));
      if (state.reason !== 'backend-unverified')
        this.scheduleReconciliation(nextRetryAt);
      return;
    }
    if (state?.status === 'partial' && !state.unfinished) {
      if (!this.localReplayPromise) {
        const replay =
          this.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock(
            async () => {
              if (!isCurrent()) return;
              const selected = await this.getSyncCredentialSafe();
              if (
                !isCurrent() ||
                cloudSyncItemBuilder.getPwdHash(selected) !== spaceId
              )
                return;
              await this.syncPendingItemsToScene({ isCurrent });
              if (!isCurrent()) return;
              await primeCloudSyncPersistAtom.set((value) => {
                if (
                  value.cloudSyncReconciliation?.spaceId !== spaceId ||
                  value.cloudSyncReconciliation.unfinished
                )
                  return value;
                const issues = value.publicAccountSnapshotStatus;
                const pending =
                  !!issues &&
                  issues.needsUpdate +
                    issues.pending +
                    issues.conflicts +
                    issues.rejected >
                    0;
                return {
                  ...value,
                  cloudSyncReconciliation: {
                    ...value.cloudSyncReconciliation,
                    status: pending ? 'partial' : 'complete',
                    updatedAt: Date.now(),
                  },
                };
              });
            },
          );
        this.localReplayPromise = replay;
        void replay
          .finally(() => {
            if (this.localReplayPromise === replay)
              this.localReplayPromise = undefined;
          })
          .catch((error) => errorUtils.autoPrintErrorIgnore(error));
      }
      return this.localReplayPromise;
    }
    if (reason === 'timer' && state?.reason === 'backend-unverified') return;
    return this.startServerSyncFlowSilently({
      callerName: `Cloud reconciliation ${reason}`,
    });
  }

  @backgroundMethod()
  async getCloudSyncReconciliationState() {
    return (await primeCloudSyncPersistAtom.get()).cloudSyncReconciliation;
  }

  getPublicAccountSnapshotImportGeneration(): number {
    return this.publicAccountSnapshotImportGeneration;
  }

  @backgroundMethod()
  async cancelPublicAccountSnapshotImport() {
    this.publicAccountSnapshotImportGeneration += 1;
    this._startServerSyncFlowForItemsDebounced.cancel();
    this.reconciliationAbortController?.abort();
    for (const controller of this.cloudSyncItemAbortControllers)
      controller.abort();
    this.clearReconciliationTimer();
    try {
      const config = await primeCloudSyncPersistAtom.get();
      if (config.cloudSyncReconciliation?.unfinished) {
        await primeCloudSyncPersistAtom.set((value) => ({
          ...value,
          cloudSyncReconciliation: value.cloudSyncReconciliation?.unfinished
            ? {
                ...value.cloudSyncReconciliation,
                status: 'waiting',
                reason: 'cancelled',
                updatedAt: Date.now(),
              }
            : value.cloudSyncReconciliation,
        }));
      }
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
    }
  }

  async publishPublicAccountSnapshotStatus({
    syncCredential,
    updates,
    counts,
  }: {
    syncCredential: ICloudSyncCredential;
    updates: ICloudSyncAccountIssueUpdate[];
    counts: ICloudSyncAccountStatusCounts;
  }) {
    const spaceId = cloudSyncItemBuilder.getPwdHash(syncCredential);
    const generation = this.publicAccountSnapshotImportGeneration;
    if (!spaceId) return;
    const selected = await this.getSyncCredentialSafe();
    if (cloudSyncItemBuilder.getPwdHash(selected) !== spaceId) return;
    const issues = await simpleDb.cloudSyncAccountIssues.updateIssues({
      spaceId,
      updates,
    });
    if (generation !== this.publicAccountSnapshotImportGeneration) return;
    await primeCloudSyncPersistAtom.set((value) => ({
      ...value,
      publicAccountSnapshotStatus: { ...counts, ...issues },
    }));
  }

  @backgroundMethod()
  async apiFetchSyncLock() {
    // NOTE: Lock/Reset/Flush endpoints are OneKey ID only; Keyless mode never calls them.
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
  } = {}): Promise<ICloudSyncDownloadResult> {
    const postData: ICloudSyncDownloadPostData = {
      includeDeleted,
      start,
      limit,
    };

    let data: ICloudSyncDownloadResult | undefined;
    let pwdHash: string | undefined;

    if ((await this.getActiveSyncMode()) === ECloudSyncMode.Keyless) {
      const keylessResult = await this.apiDownloadItemsKeyless({
        postData,
      });
      data = keylessResult.data;
      pwdHash = keylessResult.pwdHash;
    } else {
      const client = await this.backgroundApi.servicePrime.getPrimeClient();
      const { masterPasswordUUID } = await primeMasterPasswordPersistAtom.get();
      pwdHash =
        customPwdHash ||
        masterPasswordUUID ||
        RESET_CLOUD_SYNC_MASTER_PASSWORD_UUID;
      const result = await client.post<
        IApiClientResponse<ICloudSyncDownloadResult>
      >('/prime/v1/sync/download', {
        ...postData,
        pwdHash,
      });
      data = result?.data?.data;
    }

    data.pwdHash = data?.pwdHash || pwdHash || '';
    console.log('prime cloud sync apiDownloadItems: ', data);
    return data;
  }

  @backgroundMethod()
  async apiCheckServerStatus(
    params: {
      localItems?: IDBCloudSyncItem[];
      isFullDBChecking?: boolean;
    } = {},
  ): Promise<ICloudSyncCheckServerStatusResult> {
    return this.checkServerStatusWithRequestOptions(params);
  }

  // Internal request options never cross the UI/background RPC boundary.
  async checkServerStatusWithRequestOptions(
    {
      localItems,
      isFullDBChecking,
    }: {
      localItems?: IDBCloudSyncItem[];
      isFullDBChecking?: boolean;
    },
    requestOptions: {
      signal?: AbortSignal;
      timeout?: number;
      reconciliation?: ICloudSyncCheckServerStatusPostData['reconciliation'];
    } = {},
  ): Promise<ICloudSyncCheckServerStatusResult> {
    const items = localItems || [];
    const onlyCheckLocalDataType = buildOnlyCheckLocalDataTypes({
      isFullDBChecking,
    });
    const postData: ICloudSyncCheckServerStatusPostData = {
      localData: items.map((item) => ({
        key: item.id,
        dataTimestamp: item.dataTime,
        dataType: item.dataType,
      })),
      onlyCheckLocalDataType,
      nonce: nonceZero,
      pwdHash: undefined,
      ...(requestOptions.reconciliation
        ? { reconciliation: requestOptions.reconciliation }
        : {}),
    };

    let response:
      | AxiosResponse<
          IApiClientResponse<ICloudSyncCheckServerStatusResult>,
          any
        >
      | undefined;
    let pwdHash: string | undefined;
    let masterPasswordUUID: string | undefined;

    if ((await this.getActiveSyncMode()) === ECloudSyncMode.Keyless) {
      const checkResult = await this.apiCheckServerStatusKeyless({
        postData,
        requestOptions: {
          signal: requestOptions.signal,
          timeout: requestOptions.timeout,
        },
      });
      response = checkResult.response;
      pwdHash = checkResult.pwdHash;
    } else {
      const client = await this.backgroundApi.servicePrime.getPrimeClient();
      ({ masterPasswordUUID } = await primeMasterPasswordPersistAtom.get());
      // TODO: server needs to filter data based on the submitted localData, not all data
      response = await client.post<
        IApiClientResponse<ICloudSyncCheckServerStatusResult>
      >(
        '/prime/v1/sync/check',
        {
          ...postData,
          pwdHash: masterPasswordUUID,
        },
        { signal: requestOptions.signal, timeout: requestOptions.timeout },
      );
    }
    if (requestOptions.signal?.aborted)
      throw new OneKeyLocalError('Cloud sync request was cancelled');
    const responseData = response?.data?.data;
    const serverTimeStr = response?.headers?.date as string | undefined;

    if (!responseData?.serverTime) {
      try {
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
      systemTimeUtils.updateServerTime({
        serverTime: responseData.serverTime,
        source: 'cloud-sync',
      });
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
              if (requestOptions.signal?.aborted)
                throw new OneKeyLocalError('Cloud sync request was cancelled');
              fixItemTime(item);
              return item;
            },
          });
        }
      } catch (error) {
        console.error('prime cloud sync apiCheck: ', error);
      }
    }

    responseData.pwdHash =
      responseData.pwdHash || pwdHash || masterPasswordUUID || '';
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
      dataTime: undefined,
    });
    if (!lockItem?.data) {
      throw new OneKeyError('lockItem.data is not found');
    }
    return lockItem;
  }

  @backgroundMethod()
  async apiUploadItems(params: IApiUploadItemsParams) {
    return this.uploadItemsWithRequestOptions(params);
  }

  private async uploadItemsWithRequestOptions(
    {
      localItems,
      isFlush,
      isReset,
      skipPrimeStatusCheck,
      setUndefinedTimeToNow,
      syncCredential,
      encryptedSecurityPasswordR1ForServer,
      noDebounceUpload,
    }: IApiUploadItemsParams,
    requestOptions?: { signal?: AbortSignal; timeout?: number },
  ) {
    const devSettings = await devSettingsPersistAtom.get();
    const activeMode = await this.getActiveSyncMode();
    if (!skipPrimeStatusCheck) {
      await this.ensureCloudSyncIsAvailable();
    }
    if (requestOptions?.signal?.aborted)
      throw new OneKeyLocalError('Cloud sync was cancelled');
    // NOTE: Lock/Reset/Flush endpoints are OneKey ID only; Keyless mode never calls them.
    if (
      activeMode === ECloudSyncMode.Keyless &&
      (isReset || isFlush) &&
      !devSettings?.enabled
    ) {
      return undefined;
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
      // eslint-disable-next-line no-param-reassign
      syncCredential = syncCredential || (await this.getSyncCredentialSafe());
      pwdHash =
        syncCredential?.keylessCredential?.pwdHash ||
        syncCredential?.masterPasswordUUID ||
        '';
      if (isFlush && !syncCredential?.keylessCredential) {
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
        requestOptions,
      });
    }

    if (requestOptions) {
      return this.uploadItemsMutex.runExclusive(() =>
        this._callApiUploadItems({
          localItems,
          isFlush: false,
          lockItem: undefined,
          pwdHash,
          setUndefinedTimeToNow,
          requestOptions,
        }),
      );
    }

    return this._callApiUploadItemsDebounceMerge({
      localItems,
      pwdHash,
      setUndefinedTimeToNow,
      noDebounceUpload,
    });
  }

  @backgroundMethod()
  async apiUploadFreshItems(params: IApiUploadFreshItemsParams) {
    return this.apiUploadItems(params);
  }

  async callApiChangeLock({
    lockItem,
    pwdHash,
  }: {
    lockItem: IDBCloudSyncItem;
    pwdHash: string;
  }) {
    // NOTE: Lock/Reset/Flush endpoints are OneKey ID only; Keyless mode never calls them.
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
    requestOptions,
  }: {
    localItems: IDBCloudSyncItem[];
    isFlush: boolean | undefined;
    lockItem: IDBCloudSyncItem | undefined;
    pwdHash: string;
    setUndefinedTimeToNow: boolean | undefined;
    requestOptions?: { signal?: AbortSignal; timeout?: number };
  }) => {
    const uploadGeneration = this.publicAccountSnapshotImportGeneration;
    const now = await this.getCloudSyncDataTime();
    const localData: ICloudSyncServerItem[] = localItems
      .filter((item) => !isRejectedPublicAccountSnapshotWrite(item))
      .map((item) => {
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
            serverItem?.dataTimestamp || 0,
          ).toLocaleString();
        }
        return serverItem;
      })
      .filter(Boolean);

    const filteredLocalData = localData.filter((item) => {
      const pwdMatched = item.pwdHash === pwdHash && pwdHash;
      return (item.data || item.isDeleted) && !!pwdMatched;
    });

    // TODO save localData to DB if setUndefinedTimeToNow available

    // TODO filter out dataTime is undefined
    if (filteredLocalData.length === 0 && !isFlush) {
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

    if (isFlush && lockItemToServer && !filteredLocalData.length) {
      // TODO remove server check
      filteredLocalData.push(lockItemToServer);
    }
    const postData: ICloudSyncUploadPostData = {
      localData: filteredLocalData,
      nonce: nonceZero,
      pwdHash,
      lock: lockItemToServer,
    };

    let uploadResult: ICloudSyncUploadResult | undefined;
    const urlPath = isFlush ? '/prime/v1/sync/flush' : '/prime/v1/sync/upload';
    const postDataBatches = isFlush
      ? [postData]
      : splitCloudSyncUploadPostData({ postData });
    const activeMode = await this.getActiveSyncMode();
    for (const batch of postDataBatches) {
      if (
        requestOptions?.signal?.aborted ||
        (!isFlush &&
          uploadGeneration !== this.publicAccountSnapshotImportGeneration)
      ) {
        throw new OneKeyLocalError(
          'Cloud sync was cancelled. Pending data has been preserved.',
        );
      }
      let batchResult: ICloudSyncUploadResult | undefined;
      if (activeMode === ECloudSyncMode.Keyless) {
        batchResult = await this.apiUploadItemsKeyless({
          postData: batch,
          urlPath,
          requestOptions,
        });
      } else {
        const client = await this.backgroundApi.servicePrime.getPrimeClient();
        const result = await client.post<
          IApiClientResponse<ICloudSyncUploadResult>
        >(urlPath, batch, requestOptions);
        console.log('prime cloud sync apiUploadItems: ', result?.data?.data);
        batchResult = result?.data?.data;
      }
      if (requestOptions?.signal?.aborted)
        throw new OneKeyLocalError('Cloud sync was cancelled');
      if (batchResult) {
        uploadResult = {
          ...batchResult,
          created: (uploadResult?.created || 0) + batchResult.created,
          updated: (uploadResult?.updated || 0) + batchResult.updated,
        };
      }
    }

    void this.updateLastSyncTime();

    return uploadResult;
  };

  uploadItemsToMerge: IDBCloudSyncItem[] = [];

  private uploadItemsMutex = new Semaphore(1);

  _callApiUploadItemsDebounceMerge({
    localItems,
    pwdHash,
    setUndefinedTimeToNow,
    noDebounceUpload,
  }: {
    localItems: IDBCloudSyncItem[];
    pwdHash: string;
    setUndefinedTimeToNow?: boolean;
    noDebounceUpload?: boolean;
  }) {
    this.uploadItemsToMerge = uniqBy(
      [...localItems, ...this.uploadItemsToMerge],
      (i: IDBCloudSyncItem) => i.id,
    );
    if (noDebounceUpload || this.uploadItemsToMerge.length >= 500) {
      return this._callApiUploadItemsInstantly({
        pwdHash,
        setUndefinedTimeToNow,
      });
    }
    return this._callApiUploadItemsDebounced({
      pwdHash,
      setUndefinedTimeToNow,
    });
  }

  _callApiUploadItemsInstantly = async ({
    pwdHash,
    setUndefinedTimeToNow,
  }: {
    pwdHash: string;
    setUndefinedTimeToNow?: boolean;
  }) => {
    return this.uploadItemsMutex.runExclusive(async () => {
      const localItems = [...this.uploadItemsToMerge];
      this.uploadItemsToMerge = [];
      if (localItems.length) {
        try {
          await this._callApiUploadItems({
            localItems,
            isFlush: false,
            lockItem: undefined,
            pwdHash,
            setUndefinedTimeToNow,
          });
        } catch (error) {
          // Newer queued writes win. Acknowledged batches may be retried;
          // persistent sync items remain the source of truth after a restart.
          this.uploadItemsToMerge = uniqBy(
            [...this.uploadItemsToMerge, ...localItems],
            (item) => item.id,
          );
          throw error;
        }
      }
    });
  };

  _callApiUploadItemsDebounced = debounce(
    this._callApiUploadItemsInstantly,
    1000,
    {
      leading: false,
      trailing: true,
      maxWait: 5000,
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
  async syncToSceneByAllPendingItems({
    forceSync,
  }: { forceSync?: boolean } = {}) {
    return this.syncPendingItemsToScene({ forceSync });
  }

  async syncPendingItemsToScene({
    forceSync,
    isCurrent,
  }: {
    forceSync?: boolean;
    isCurrent?: () => boolean;
  } = {}) {
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
        forceSync,
      }),
    );
    return this.syncToSceneWithLocalSyncItems({
      items: pendingItems,
      syncCredential,
      forceSync,
      isCurrent,
    });
  }

  // TODO mutex
  async syncToSceneWithLocalSyncItems({
    items,
    syncCredential,
    forceSync,
    isCurrent,
  }: {
    items: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential;
    forceSync?: boolean;
    isCurrent?: () => boolean;
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
      forceSync,
      isCurrent,
    });
  }

  async _syncToSceneWithLocalSyncItems({
    items,
    syncCredential,
    forceSync,
    isCurrent,
  }: {
    items: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential | undefined;
    forceSync?: boolean;
    isCurrent?: () => boolean;
  }) {
    const walletItems: IDBCloudSyncItem[] = [];
    const botWalletItems: IDBCloudSyncItem[] = [];
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
        case EPrimeCloudSyncDataType.BotWallet:
          botWalletItems.push(item);
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
    const assertCurrent = () => {
      if (isCurrent && !isCurrent())
        throw new OneKeyLocalError('Cloud sync was cancelled');
    };
    assertCurrent();

    // wallet sync
    await this.syncManagers.wallet.syncToScene({
      syncCredential,
      items: walletItems,
      forceSync,
    });
    assertCurrent();
    await this.syncManagers.botWallet.syncToScene({
      syncCredential,
      items: botWalletItems,
      forceSync,
    });
    assertCurrent();
    if (walletItems?.length || botWalletItems?.length) {
      emitEventsStack.push(() => {
        appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
      });
    }

    // account sync
    await this.syncManagers.account.syncToScene({
      syncCredential,
      items: accountItems,
      forceSync,
      isCurrent,
    });
    assertCurrent();
    await this.syncManagers.indexedAccount.syncToScene({
      syncCredential,
      items: indexedAccountItems,
      forceSync,
    });
    assertCurrent();
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
    assertCurrent();
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
    assertCurrent();
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
    assertCurrent();
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
    assertCurrent();
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
    assertCurrent();
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
    assertCurrent();
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
    isCurrent,
  }: {
    serverItems: ICloudSyncServerItem[];
    shouldSyncToScene: boolean;
    syncCredential: ICloudSyncCredential | undefined;
    serverPwdHash: string;
    isCurrent?: () => boolean;
  }) {
    const generation = this.publicAccountSnapshotImportGeneration;
    const guard = () => {
      this.assertCloudSyncGeneration(generation);
      if (isCurrent && !isCurrent())
        throw new OneKeyLocalError('Cloud sync was cancelled');
    };
    const localItems: IDBCloudSyncItem[] = [];
    for (let offset = 0; offset < serverItems.length; offset += 50) {
      guard();
      const converted = await Promise.all(
        serverItems.slice(offset, offset + 50).map((serverItem) =>
          this.convertServerItemToLocalItem({
            serverItem,
            shouldDecrypt: false,
            syncCredential,
            serverPwdHash,
          }),
        ),
      );
      localItems.push(
        ...converted.filter((item): item is IDBCloudSyncItem => Boolean(item)),
      );
      if (offset + 50 < serverItems.length) await timerUtils.wait(0);
    }
    guard();

    return this.updateLocalItemsByServer({
      localItems,
      syncCredential,
      shouldSyncToScene,
      isCurrent,
    });
  }

  async saveServerDeletedItemsToLocal({
    deletedItemIds,
    shouldSyncToScene,
    syncCredential,
    serverPwdHash,
    isCurrent,
  }: {
    deletedItemIds: string[];
    shouldSyncToScene: boolean;
    syncCredential: ICloudSyncCredential | undefined;
    serverPwdHash: string;
    isCurrent?: () => boolean;
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
      isCurrent,
    });
  }

  async updateLocalItemsByServer({
    localItems,
    syncCredential,
    shouldSyncToScene,
    isCurrent,
  }: {
    localItems: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential | undefined;
    shouldSyncToScene: boolean;
    isCurrent?: () => boolean;
  }) {
    console.log('updateLocalItemsByServer', localItems.length);
    await this.writeCloudSyncPoolInBatches({
      items: localItems,
      skipUploadToServer: true,
      isCurrent,
    });
    console.log('updateLocalItemsByServer sucess', localItems.length);

    if (shouldSyncToScene && syncCredential) {
      // we need to query from the database again, not use the localSyncItems above, because when updating, the timestamp may not be written if it does not match
      const { records: items } = await localDb.getRecordsByIds({
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: localItems.map((item) => item.id),
      });
      await this.syncToSceneWithLocalSyncItems({
        items: items.filter(Boolean),
        syncCredential,
        isCurrent,
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

  async writeCloudSyncPoolInBatches({
    items,
    skipUploadToServer,
    isCurrent,
  }: {
    items: IDBCloudSyncItem[];
    skipUploadToServer: boolean;
    isCurrent?: () => boolean;
  }) {
    const generation = this.publicAccountSnapshotImportGeneration;
    const guard = () => {
      this.assertCloudSyncGeneration(generation);
      if (isCurrent && !isCurrent())
        throw new OneKeyLocalError('Cloud sync was cancelled');
    };
    for (let offset = 0; offset < items.length; offset += 50) {
      guard();
      await localDb.addAndUpdateSyncItems({
        items: items.slice(offset, offset + 50),
        skipUploadToServer,
        fn: async () => guard(),
      });
      if (offset + 50 < items.length) await timerUtils.wait(0);
    }
    guard();
  }

  @backgroundMethod()
  @toastIfError()
  async startServerSyncFlow({
    isFlush,
    encryptedSecurityPasswordR1ForServer,
    setUndefinedTimeToNow,
    callerName,
    noDebounceUpload,
    forceSync,
  }: Omit<IStartServerSyncFlowParams, 'throwError'> = {}) {
    return this.startServerSyncFlowSilently({
      isFlush,
      encryptedSecurityPasswordR1ForServer,
      setUndefinedTimeToNow,
      throwError: true,
      callerName,
      noDebounceUpload,
      forceSync,
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
      void this.backgroundApi.serviceNotification.updateClientBasicAppInfoDebounced();
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
    noDebounceUpload,
    forceSync,
  }: IStartServerSyncFlowParams = {}) {
    if (this.fullSyncPromise) {
      this.fullSyncRequested = true;
      return this.fullSyncPromise;
    }
    const generation = this.publicAccountSnapshotImportGeneration;
    const run =
      this.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock(() =>
        generation === this.publicAccountSnapshotImportGeneration
          ? this.startServerSyncFlowWithSelectedKey({
              isFlush,
              encryptedSecurityPasswordR1ForServer,
              setUndefinedTimeToNow,
              throwError,
              callerName,
              noDebounceUpload,
              forceSync,
            })
          : Promise.resolve(undefined),
      );
    this.fullSyncPromise = run;
    try {
      return await run;
    } finally {
      if (this.fullSyncPromise === run) this.fullSyncPromise = undefined;
      const requested = this.fullSyncRequested;
      this.fullSyncRequested = false;
      if (
        requested &&
        generation === this.publicAccountSnapshotImportGeneration
      ) {
        const state = (await primeCloudSyncPersistAtom.get())
          .cloudSyncReconciliation;
        if (
          state?.unfinished &&
          state.reason !== 'backend-unverified' &&
          state.reason !== 'cancelled'
        ) {
          this.scheduleReconciliation(state.nextRetryAt ?? Date.now() + 1000);
        }
      }
    }
  }

  private async runFullCloudReconciliation({
    forceSync,
  }: {
    forceSync?: boolean;
  }) {
    const credential = await this.getSyncCredentialSafe();
    const spaceId = cloudSyncItemBuilder.getPwdHash(credential);
    if (!credential || !spaceId) return false;
    if (await this.backgroundApi.serviceApp.isAppLocked()) return false;
    const config = await primeCloudSyncPersistAtom.get();
    const previous =
      config.cloudSyncReconciliation?.spaceId === spaceId
        ? config.cloudSyncReconciliation
        : undefined;
    if (
      previous?.unfinished &&
      previous.nextRetryAt &&
      previous.nextRetryAt > Date.now()
    ) {
      const nextRetryAt = Math.min(
        previous.nextRetryAt,
        Date.now() + 30 * 60_000,
      );
      if (nextRetryAt !== previous.nextRetryAt)
        await primeCloudSyncPersistAtom.set((value) => ({
          ...value,
          cloudSyncReconciliation:
            value.cloudSyncReconciliation?.spaceId === spaceId
              ? { ...value.cloudSyncReconciliation, nextRetryAt }
              : value.cloudSyncReconciliation,
        }));
      if (previous.reason !== 'backend-unverified')
        this.scheduleReconciliation(nextRetryAt);
      return false;
    }
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const controller = new AbortController();
    this.reconciliationAbortController = controller;
    const isCurrent = () =>
      !controller.signal.aborted &&
      generation === this.publicAccountSnapshotImportGeneration &&
      keyGeneration ===
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const baseline: ICloudSyncReconciliationPersistState = {
      version: 1,
      spaceId,
      status: 'running',
      unfinished: true,
      failures: previous?.unfinished ? previous.failures : 0,
      requests: previous?.unfinished ? previous.requests : 0,
      rounds: previous?.unfinished ? previous.rounds : 0,
      received: previous?.unfinished ? previous.received : 0,
      applied: previous?.unfinished ? previous.applied : 0,
      uploaded: previous?.unfinished ? previous.uploaded : 0,
      updatedAt: Date.now(),
    };
    await primeCloudSyncPersistAtom.set((value) => ({
      ...value,
      cloudSyncReconciliation: baseline,
    }));
    let networkRequests = 0;
    let latestItems: IDBCloudSyncItem[] = [];
    let activeApply: Promise<{ applied: number }> | undefined;
    let activeUpload: Promise<{ uploaded: number }> | undefined;
    try {
      if (!previous)
        await this.publishPublicAccountSnapshotStatus({
          syncCredential: credential,
          updates: [],
          counts: {
            needsUpdate: 0,
            pending: 0,
            conflicts: 0,
            rejected: 0,
            added: 0,
            unchanged: 0,
          },
        });
      await this.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: true,
        isCurrent,
      });
      const { runCloudSyncReconciliation } =
        await import('./cloudSyncReconciliation');
      const result = await runCloudSyncReconciliation({
        signal: controller.signal,
        adapter: {
          isCurrent,
          now: () => Date.now(),
          isBoundedCheckVerified: (contract) => contract.version === 1,
          pause: ({ delayMs, signal }) =>
            new Promise<void>((resolve, reject) => {
              const timer: { handle?: ReturnType<typeof setTimeout> } = {};
              const abort = () => {
                clearTimeout(timer.handle);
                reject(new OneKeyLocalError('Cloud sync was cancelled'));
              };
              timer.handle = setTimeout(() => {
                signal.removeEventListener('abort', abort);
                resolve();
              }, delayMs);
              if (signal.aborted) abort();
              else signal.addEventListener('abort', abort, { once: true });
            }),
          getFullSummary: async ({ signal }) => {
            if (!isCurrent() || signal.aborted)
              throw new OneKeyLocalError('Cloud sync was cancelled');
            const all = await this.getAllLocalSyncItems();
            latestItems = all.items.filter((item) => item.pwdHash === spaceId);
            return latestItems.map((item) => ({
              key: item.id,
              dataTimestamp: item.dataTime,
              dataType: item.dataType,
            }));
          },
          check: async ({ reconciliation, signal, timeoutMs }) => {
            const firstRequest = networkRequests === 0;
            networkRequests += 1;
            try {
              return await this.checkServerStatusWithRequestOptions(
                { localItems: latestItems, isFullDBChecking: true },
                {
                  signal,
                  timeout: timeoutMs,
                  reconciliation: this.boundedCheckUnsupported
                    ? undefined
                    : reconciliation,
                },
              );
            } catch (error) {
              const status = (error as { response?: { status?: number } })
                ?.response?.status;
              if (
                !firstRequest ||
                signal.aborted ||
                !isCurrent() ||
                ![400, 422].includes(status ?? 0)
              )
                throw error;
              // A strict legacy backend may reject the optional capability field.
              // Authentication errors never enter this compatibility fallback.
              this.boundedCheckUnsupported = true;
              networkRequests += 1;
              return this.checkServerStatusWithRequestOptions(
                { localItems: latestItems, isFullDBChecking: true },
                { signal, timeout: timeoutMs },
              );
            }
          },
          uploadObsoleted: ({ keys, signal }) => {
            const work = (async () => {
              if (!isCurrent() || signal.aborted)
                throw new OneKeyLocalError('Cloud sync was cancelled');
              const keySet = new Set(keys);
              const localItems = latestItems.filter((item) =>
                keySet.has(item.id),
              );
              const uploaded = await this.uploadItemsMutex.runExclusive(() =>
                this._callApiUploadItems({
                  localItems,
                  isFlush: false,
                  lockItem: undefined,
                  pwdHash: spaceId,
                  setUndefinedTimeToNow: true,
                  requestOptions: { signal, timeout: 10_000 },
                }),
              );
              return {
                uploaded: (uploaded?.created ?? 0) + (uploaded?.updated ?? 0),
              };
            })();
            activeUpload = work;
            return work;
          },
          apply: ({ response, signal }) => {
            const work = (async () => {
              const operationIsCurrent = () => isCurrent() && !signal.aborted;
              if (!isCurrent() || signal.aborted)
                throw new OneKeyLocalError('Cloud sync was cancelled');
              const ids = Array.from(
                new Set([
                  ...response.diff.map((item) => item.key),
                  ...response.updated.map((item) => item.key),
                  ...response.deleted,
                ]),
              );
              const before = new Map(
                latestItems.map((item) => [item.id, item]),
              );
              for (const serverItems of [response.diff, response.updated]) {
                if (!isCurrent() || signal.aborted)
                  throw new OneKeyLocalError('Cloud sync was cancelled');
                if (serverItems.length)
                  await this.saveServerSyncItemsToLocal({
                    serverItems,
                    shouldSyncToScene: true,
                    syncCredential: credential,
                    serverPwdHash: response.pwdHash,
                    isCurrent: operationIsCurrent,
                  });
              }
              if (!isCurrent() || signal.aborted)
                throw new OneKeyLocalError('Cloud sync was cancelled');
              if (response.deleted.length)
                await this.saveServerDeletedItemsToLocal({
                  deletedItemIds: response.deleted,
                  shouldSyncToScene: true,
                  syncCredential: credential,
                  serverPwdHash: response.pwdHash,
                  isCurrent: operationIsCurrent,
                });
              let applied = 0;
              for (let offset = 0; offset < ids.length; offset += 50) {
                if (!isCurrent() || signal.aborted)
                  throw new OneKeyLocalError('Cloud sync was cancelled');
                const { records } = await localDb.getRecordsByIds({
                  name: ELocalDBStoreNames.CloudSyncItem,
                  ids: ids.slice(offset, offset + 50),
                });
                for (const item of records) {
                  const old = item ? before.get(item.id) : undefined;
                  if (
                    item &&
                    (!old ||
                      item.dataTime !== old.dataTime ||
                      item.data !== old.data ||
                      item.isDeleted !== old.isDeleted ||
                      item.pwdHash !== old.pwdHash)
                  )
                    applied += 1;
                }
                if (offset + 50 < ids.length) await timerUtils.wait(0);
              }
              return { applied };
            })();
            activeApply = work;
            return work;
          },
        },
      });
      // Aborting the runner does not abandon an in-flight transaction. Keep
      // the source lock until its cancellation gate has rolled it back.
      if (activeApply) await activeApply.catch(() => undefined);
      if (activeUpload) await activeUpload.catch(() => undefined);
      const shouldReplay =
        isCurrent() &&
        ['complete', 'backend-unverified'].includes(result.status);
      if (shouldReplay) {
        await this.syncPendingItemsToScene({
          forceSync:
            forceSync || !previous || config.cloudSyncAccountApplyVersion !== 2,
          isCurrent,
        });
      }
      if (generation !== this.publicAccountSnapshotImportGeneration)
        return false;
      const currentConfig = await primeCloudSyncPersistAtom.get();
      if (currentConfig.cloudSyncReconciliation?.spaceId !== spaceId)
        return false;
      const issues = currentConfig.publicAccountSnapshotStatus;
      const hasIssues =
        !!issues &&
        issues.needsUpdate +
          issues.pending +
          issues.conflicts +
          issues.rejected >
          0;
      let failures = baseline.failures;
      if (result.status === 'blocked') failures += 1;
      else if (result.progress) failures = 0;
      let nextRetryAt = result.nextRetryAt;
      if (result.status === 'blocked')
        nextRetryAt =
          Date.now() +
          Math.min(30 * 60_000, 30_000 * 2 ** Math.min(failures - 1, 6));
      else if (result.status === 'backend-unverified')
        nextRetryAt = Date.now() + 60_000;
      let status: ICloudSyncReconciliationPersistState['status'] = 'blocked';
      if (result.status === 'complete')
        status = hasIssues ? 'partial' : 'complete';
      else if (result.status === 'waiting' || result.status === 'cancelled')
        status = 'waiting';
      const state: ICloudSyncReconciliationPersistState = {
        ...baseline,
        status,
        reason:
          result.status === 'backend-unverified'
            ? 'backend-unverified'
            : result.reason,
        unfinished: result.unfinished,
        nextRetryAt,
        failures,
        requests: baseline.requests + networkRequests,
        rounds: baseline.rounds + result.rounds,
        received: baseline.received + result.received,
        applied: baseline.applied + result.applied,
        uploaded: baseline.uploaded + result.uploaded,
        updatedAt: Date.now(),
      };
      await primeCloudSyncPersistAtom.set((value) => ({
        ...value,
        cloudSyncReconciliation: state,
        cloudSyncAccountApplyVersion:
          shouldReplay && isCurrent() ? 2 : value.cloudSyncAccountApplyVersion,
      }));
      if (
        state.unfinished &&
        state.nextRetryAt &&
        result.status !== 'backend-unverified' &&
        result.status !== 'cancelled'
      )
        this.scheduleReconciliation(state.nextRetryAt);
      if (!state.unfinished) await this.updateLastSyncTime();
      return state.status === 'complete';
    } catch (error) {
      if (generation === this.publicAccountSnapshotImportGeneration) {
        const failures = baseline.failures + 1;
        const nextRetryAt =
          Date.now() +
          Math.min(30 * 60_000, 30_000 * 2 ** Math.min(failures - 1, 6));
        await primeCloudSyncPersistAtom.set((value) => ({
          ...value,
          cloudSyncReconciliation: {
            ...baseline,
            status: 'blocked',
            reason: 'local-processing',
            failures,
            nextRetryAt,
            updatedAt: Date.now(),
          },
        }));
        this.scheduleReconciliation(nextRetryAt);
      }
      throw error;
    } finally {
      if (this.reconciliationAbortController === controller)
        this.reconciliationAbortController = undefined;
    }
  }

  private async startServerSyncFlowWithSelectedKey({
    isFlush,
    encryptedSecurityPasswordR1ForServer,
    setUndefinedTimeToNow,
    throwError,
    callerName,
    noDebounceUpload,
    forceSync,
  }: IStartServerSyncFlowParams) {
    try {
      // const syncMode = await this.getActiveSyncMode();

      if (!(await this.isCloudSyncIsAvailable())) {
        return;
      }
      await this.ensureCloudSyncIsAvailable({
        callerName,
      });

      if (!isFlush) return await this.runFullCloudReconciliation({ forceSync });

      // when data is written, because the cached password is missing to encrypt, so data is undefined
      await this.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: true, // will call server sync flow later
      });

      let { items: localItems } = await this.getAllLocalSyncItems();
      const allLocalItems = localItems;
      const totalItemsCount = allLocalItems.length;

      const credential = await this.getSyncCredentialSafe();
      // const pwdHash =
      //   await this.backgroundApi.serviceMasterPassword.getLocalMasterPasswordUUIDSafe();
      const pwdHash =
        credential?.keylessCredential?.pwdHash ||
        credential?.masterPasswordUUID ||
        '';
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
        noDebounceUpload,
      });
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      if (throwError) {
        throw error;
      }
    } finally {
      void this.notifyOnekeyIdSyncSunset();
    }

    // the server data has been downloaded, but it may not have been updated to the business scenario, so it needs to be executed again
    // checked by localSceneUpdated field
    await this.syncToSceneByAllPendingItems({
      forceSync,
    });

    return true;
  }

  @backgroundMethod()
  async startServerSyncFlowForItems(params: {
    localItems: IDBCloudSyncItem[];
    isFlush?: boolean;
    setUndefinedTimeToNow?: boolean;
    encryptedSecurityPasswordR1ForServer?: string;
    isFullDBChecking?: boolean;
    noDebounceUpload?: boolean;
  }) {
    if (params.isFullDBChecking || params.isFlush || params.noDebounceUpload) {
      // The full flow already owns the source lock. Do not acquire it again.
      return this.startServerSyncFlowForItemsImmediately(params);
    }
    for (const item of params.localItems) {
      if (isRejectedPublicAccountSnapshotWrite(item)) continue;
      this.serverSyncItemsToMerge.set(item.id, { ...item });
    }
    this.serverSyncSetUndefinedTimeToNow ||=
      params.setUndefinedTimeToNow ?? true;
    if (this.serverSyncItemsToMerge.size) {
      if (this.serverSyncItemsToMerge.size >= 500) {
        this._startServerSyncFlowForItemsDebounced.cancel();
        void this._drainServerSyncFlowForItems().catch((error) =>
          errorUtils.autoPrintErrorIgnore(error),
        );
      } else this._startServerSyncFlowForItemsDebounced();
    }
  }

  private serverSyncItemsToMerge = new Map<string, IDBCloudSyncItem>();

  private serverSyncSetUndefinedTimeToNow = false;

  _startServerSyncFlowForItemsDebounced = debounce(
    () => {
      void this._drainServerSyncFlowForItems().catch((error) => {
        errorUtils.autoPrintErrorIgnore(error);
      });
    },
    1000,
    { maxWait: 5000 },
  );

  private serverSyncDrainPromise: Promise<void> | undefined;

  async _drainServerSyncFlowForItems() {
    if (this.serverSyncDrainPromise) return this.serverSyncDrainPromise;
    if (!this.serverSyncItemsToMerge.size) return;
    let consumed = false;
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const isCurrent = () =>
      generation === this.publicAccountSnapshotImportGeneration &&
      keyGeneration ===
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const run =
      this.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock(
        async () => {
          if (!isCurrent() || !this.serverSyncItemsToMerge.size) return;
          if (!(await this.isCloudSyncIsAvailable()) || !isCurrent()) return;
          const credential = await this.getSyncCredentialSafe();
          if (!isCurrent()) return;
          const pwdHash = cloudSyncItemBuilder.getPwdHash(credential);
          if (!pwdHash) return;

          const localItems = Array.from(
            this.serverSyncItemsToMerge.values(),
          ).filter((item) => item.pwdHash === pwdHash);
          const setUndefinedTimeToNow = this.serverSyncSetUndefinedTimeToNow;
          // Old-source records stay dirty in the DB. A full sync can rebuild
          // them; never authenticate their pending request with the new source.
          this.serverSyncItemsToMerge.clear();
          consumed = true;
          this.serverSyncSetUndefinedTimeToNow = false;
          if (!localItems.length) return;
          try {
            await this.startServerSyncFlowForItemsImmediately(
              {
                localItems,
                setUndefinedTimeToNow,
                // Keep status and its resulting uploads inside the same source lock.
                noDebounceUpload: true,
              },
              isCurrent,
            );
          } catch (error) {
            for (const item of localItems) {
              if (!this.serverSyncItemsToMerge.has(item.id)) {
                this.serverSyncItemsToMerge.set(item.id, item);
              }
            }
            this.serverSyncSetUndefinedTimeToNow ||= setUndefinedTimeToNow;
            throw error;
          }
        },
      );
    this.serverSyncDrainPromise = run;
    let succeeded = false;
    try {
      const result = await run;
      succeeded = true;
      return result;
    } finally {
      if (this.serverSyncDrainPromise === run)
        this.serverSyncDrainPromise = undefined;
      // Writes arriving during a successful request get a bounded follow-up.
      // Failures remain dirty until the next trigger, avoiding a retry loop.
      if (
        succeeded &&
        consumed &&
        isCurrent() &&
        this.serverSyncItemsToMerge.size
      )
        this._startServerSyncFlowForItemsDebounced();
    }
  }

  private async startServerSyncFlowForItemsImmediately(
    {
      localItems,
      isFlush,
      setUndefinedTimeToNow,
      encryptedSecurityPasswordR1ForServer,
      isFullDBChecking,
      noDebounceUpload,
    }: Parameters<ServicePrimeCloudSync['startServerSyncFlowForItems']>[0],
    parentIsCurrent?: () => boolean,
  ) {
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const controller = new AbortController();
    this.cloudSyncItemAbortControllers.add(controller);
    const isCurrent = () =>
      !controller.signal.aborted &&
      generation === this.publicAccountSnapshotImportGeneration &&
      keyGeneration ===
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration() &&
      (!parentIsCurrent || parentIsCurrent());
    const guard = () => {
      this.assertCloudSyncGeneration(generation);
      if (!isCurrent())
        throw new OneKeyLocalError(
          'Cloud sync was cancelled. Pending data has been preserved.',
        );
    };
    const requestOptions = { signal: controller.signal, timeout: 10_000 };
    try {
      guard();
      if (!(await this.isCloudSyncIsAvailable())) return;
      guard();
      await this.ensureCloudSyncIsAvailable();
      guard();

      const serverStatus = await this.checkServerStatusWithRequestOptions(
        {
          localItems,
          isFullDBChecking,
        },
        requestOptions,
      );
      guard();
      const syncCredential = await this.getSyncCredentialSafe();
      guard();

      if (serverStatus.obsoleted.length || isFlush) {
        const itemsToUpload = localItems.filter((item) =>
          serverStatus.obsoleted.includes(item.id),
        );
        await this.uploadItemsWithRequestOptions(
          {
            localItems: itemsToUpload,
            isFlush: isFlush ?? false,
            setUndefinedTimeToNow: setUndefinedTimeToNow ?? true,
            syncCredential,
            encryptedSecurityPasswordR1ForServer,
            noDebounceUpload,
          },
          requestOptions,
        );
        guard();
      }

      for (const serverItems of [serverStatus.diff, serverStatus.updated]) {
        guard();
        if (serverItems.length)
          await this.saveServerSyncItemsToLocal({
            serverItems,
            shouldSyncToScene: true,
            syncCredential,
            serverPwdHash: serverStatus.pwdHash,
            isCurrent,
          });
      }
      guard();
      if (serverStatus.deleted.length)
        await this.saveServerDeletedItemsToLocal({
          deletedItemIds: serverStatus.deleted,
          shouldSyncToScene: true,
          syncCredential,
          serverPwdHash: serverStatus.pwdHash,
          isCurrent,
        });
      guard();
    } finally {
      controller.abort();
      this.cloudSyncItemAbortControllers.delete(controller);
    }
  }

  async isCloudSyncIsAvailable() {
    const now = Date.now();
    try {
      await this.ensureCloudSyncIsAvailable();
      return true;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return false;
    } finally {
      const endTime = Date.now();
      const duration = endTime - now;
      if (duration > 600) {
        void this.backgroundApi.serviceApp.showToastIfDevMode({
          method: 'error',
          title: `isCloudSyncIsAvailable took too long: ${duration}ms`,
        });
      }
      console.log(
        `CloudSyncTookTime:: ServicePrimeCloudSync.isCloudSyncIsAvailable() ${duration}ms`,
      );
    }
  }

  async ensureCloudSyncIsAvailable({
    callerName = '',
  }: {
    callerName?: string;
  } = {}) {
    const activeMode = await this.getActiveSyncMode();
    if (activeMode === ECloudSyncMode.Keyless) {
      return;
    }
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
  async getSyncCredentialSafe({
    keylessCloudSyncCredential,
  }: {
    keylessCloudSyncCredential?: IKeylessCloudSyncCredential | null;
  } = {}): Promise<ICloudSyncCredential | undefined> {
    const now = Date.now();
    try {
      if (keylessCloudSyncCredential) {
        this.backgroundApi.serviceKeylessCloudSync.setKeylessCloudSyncCredentialCache(
          keylessCloudSyncCredential,
        );
      }
      const activeMode = await this.getActiveSyncMode();
      if (activeMode === ECloudSyncMode.Keyless && keylessCloudSyncCredential) {
        return this.buildSyncCredentialWithKeylessCredential(
          keylessCloudSyncCredential,
        );
      }
      const keylessWalletId =
        activeMode === ECloudSyncMode.Keyless
          ? keylessCloudSyncCredential?.keylessWalletId ||
            (await this.getCurrentCloudSyncKeylessWalletId())
          : undefined;
      const result = await this.getSyncCredentialWithCache({
        activeMode,
        keylessWalletId,
      });
      return result;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return undefined;
    } finally {
      const endTime = Date.now();
      const duration = endTime - now;
      if (duration > 600) {
        void this.backgroundApi.serviceApp.showToastIfDevMode({
          method: 'error',
          title: `getSyncCredentialSafe took too long: ${duration}ms`,
          message: `ServicePrimeCloudSync.getSyncCredentialSafe() took ${duration}ms`,
        });
      }
      console.log(
        `CloudSyncTookTime:: ServicePrimeCloudSync.getSyncCredentialSafe() ${duration}ms`,
      );
    }
  }

  @backgroundMethod()
  async getKeylessCloudSyncCredentialCache() {
    return this.backgroundApi.serviceKeylessCloudSync.getKeylessCloudSyncCredentialCache();
  }

  @backgroundMethod()
  async getCurrentCloudSyncKeylessWalletId() {
    return this.backgroundApi.serviceKeylessCloudSync.getCurrentCloudSyncKeylessWalletId();
  }

  buildSyncCredentialWithKeylessCredential(
    keylessCredential: IKeylessCloudSyncCredential,
  ): ICloudSyncCredential {
    return this.backgroundApi.serviceKeylessCloudSync.buildSyncCredentialWithKeylessCredential(
      keylessCredential,
    );
  }

  async buildSyncCredentialForOneKeyId({
    password,
  }: {
    password: string;
  }): Promise<ICloudSyncCredential> {
    const {
      masterPasswordUUID,
      // encryptedSecurityPasswordR1
    } = await primeMasterPasswordPersistAtom.get();
    // if (!masterPasswordUUID || !encryptedSecurityPasswordR1) {
    //   void this.showAlertDialogIfLocalPasswordNotSet();
    //   throw new OneKeyError(
    //     'No masterPasswordUUID or encryptedSecurityPasswordR1 in atom',
    //   );
    // }
    //
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
      keylessCredential: undefined,
    };
  }

  async buildSyncCredentialForKeyless(): Promise<ICloudSyncCredential> {
    const keylessCredential =
      (await this.getKeylessCloudSyncCredentialCache()) ||
      (await this.getKeylessCloudSyncCredential());
    if (!keylessCredential) {
      throw new OneKeyError('Failed to get keyless credential');
    }
    return this.buildSyncCredentialWithKeylessCredential(keylessCredential);
  }

  // Sync credential cache is long-lived, but keyless cache keys are scoped by wallet id.
  getSyncCredentialWithCache = memoizee(
    async ({
      activeMode,
      keylessWalletId,
    }: {
      activeMode: ECloudSyncMode;
      keylessWalletId?: string | null;
    }): Promise<ICloudSyncCredential> => {
      // Keyless mode does not need password
      if (activeMode === ECloudSyncMode.Keyless) {
        if (!keylessWalletId) {
          throw new OneKeyError('Failed to get current keyless wallet id');
        }
        return this.buildSyncCredentialForKeyless();
      }

      // OneKey ID mode still requires password
      const password =
        await this.backgroundApi.servicePassword.getCachedPassword();

      if (!password) {
        throw new OneKeyError('No password in memory');
      }

      return this.buildSyncCredentialForOneKeyId({ password });
    },
    {
      max: 10,
      maxAge: timerUtils.getTimeDurationMs({ hour: 8 }),
      promise: true,
    },
  );

  async clearCachedSyncCredential() {
    this.publicAccountSnapshotImportGeneration += 1;
    this.reconciliationAbortController?.abort();
    for (const controller of this.cloudSyncItemAbortControllers)
      controller.abort();
    this.clearReconciliationTimer();
    this.getSyncCredentialWithCache.clear();
    this.backgroundApi.serviceKeylessCloudSync.clearKeylessCloudSyncCredentialCache();
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
    // Legacy credential-error cleanup can run inside a locked sync flow.
    // Disabling preserves the selected source and its credential storage.
    if (!enabled) {
      return this.setCloudSyncEnabledWithKeyLock(false, {
        skipClearLocalMasterPassword,
      });
    }
    return this.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock(
      () =>
        this.backgroundApi.serviceKeylessCloudSync.runWithCloudAccountImportLock(
          () =>
            this.setCloudSyncEnabledWithKeyLock(enabled, {
              skipClearLocalMasterPassword,
            }),
        ),
    );
  }

  async setCloudSyncEnabledWithKeyLock(
    enabled: boolean,
    {
      skipClearLocalMasterPassword,
    }: { skipClearLocalMasterPassword?: boolean } = {},
  ) {
    if (
      enabled &&
      (await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource
    ) {
      throw new OneKeyError(
        'Changing an existing hardware Cloud key requires an explicit migration.',
      );
    }
    if (!enabled && !skipClearLocalMasterPassword) {
      await this.backgroundApi.serviceMasterPassword.clearLocalMasterPassword({
        skipDisableCloudSync: true,
      });
    }
    await primeCloudSyncPersistAtom.set((v) => ({
      ...v,
      isCloudSyncEnabled: enabled,
      hasEverEnabledOneKeyIdSync:
        enabled || v.hasEverEnabledOneKeyIdSync || v.isCloudSyncEnabled,
      isCloudSyncEnabledKeyless: enabled ? false : v.isCloudSyncEnabledKeyless,
    }));
    await this.clearCachedSyncCredential();
  }

  @backgroundMethod()
  async backfillOneKeyIdSyncHistoryIfNeeded() {
    await primeCloudSyncPersistAtom.set((v) => {
      if (!v.isCloudSyncEnabled || v.hasEverEnabledOneKeyIdSync) {
        return v;
      }
      return {
        ...v,
        hasEverEnabledOneKeyIdSync: true,
      };
    });
  }

  @backgroundMethod()
  async normalizeCloudSyncStateForPageEnter() {
    const currentConfig = await primeCloudSyncPersistAtom.get();
    if (
      !currentConfig.isCloudSyncEnabled ||
      !currentConfig.isCloudSyncEnabledKeyless
    ) {
      return false;
    }

    await primeCloudSyncPersistAtom.set((v) => ({
      ...v,
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: true,
      hasEverEnabledOneKeyIdSync: true,
      hasEverEnabledKeylessSync: true,
    }));
    await this.clearCachedSyncCredential();
    return true;
  }

  @backgroundMethod()
  @toastIfError()
  async toggleCloudSync({ enabled }: { enabled: boolean }) {
    const shouldTrackEnableFlow = enabled;
    if (shouldTrackEnableFlow) {
      oneKeyIdCloudSyncEnableFlowCount += 1;
    }
    try {
      if (enabled) {
        const {
          success,
          isServerMasterPasswordSet,
          serverDiffItems,
          encryptedSecurityPasswordR1ForServer,
        } = await this.prepareCloudSync();
        await this.setCloudSyncEnabled(success);
        if (serverDiffItems?.length) {
          console.log('serverDiffItems>>>', serverDiffItems);
          return;
        }
        if (success) {
          await timerUtils.wait(0);
          await this.showDialogLoading({
            title: appLocale.intl.formatMessage({
              id: ETranslations.global_syncing,
            }),
          });
          try {
            await this.startServerSyncFlow({
              isFlush: !isServerMasterPasswordSet, // flush if server master password is not set
              setUndefinedTimeToNow: true,
              callerName: 'Enable Cloud Sync',
              encryptedSecurityPasswordR1ForServer,
            });
          } finally {
            await timerUtils.wait(1000);
            await this.hideDialogLoading();
          }
        }
      } else {
        await this.setCloudSyncEnabled(false);
      }
    } catch (error) {
      await this.setCloudSyncEnabled(false);
      throw error;
    } finally {
      if (shouldTrackEnableFlow) {
        oneKeyIdCloudSyncEnableFlowCount = Math.max(
          0,
          oneKeyIdCloudSyncEnableFlowCount - 1,
        );
      }
      void this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();
    }
  }

  @backgroundMethod()
  async syncNowKeyless({
    callerName = 'Manual Cloud Sync Keyless',
    noDebounceUpload = true,
    forceSync,
    password,
  }: {
    callerName?: string;
    noDebounceUpload?: boolean;
    forceSync?: boolean;
    password?: string;
  } = {}): Promise<boolean> {
    const { isCloudSyncEnabledKeyless } = await primeCloudSyncPersistAtom.get();
    if (!isCloudSyncEnabledKeyless) {
      return false;
    }
    if (password) {
      await this.backgroundApi.serviceKeylessCloudSync.repairKeylessSyncCredentialIfNeeded(
        {
          password,
          throwOnLocalSecretEnvelopeUnavailable: true,
        },
      );
    }
    const syncCredential = await this.getSyncCredentialSafe();
    if (!syncCredential) {
      return false;
    }
    await this.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock(
      async () => {
        const selected = await this.getSyncCredentialSafe();
        if (
          selected?.keylessCredential?.signingPublicKey !==
          syncCredential.keylessCredential?.signingPublicKey
        ) {
          throw new OneKeyError(
            'Cloud key selection changed. Try syncing again.',
          );
        }
        await this.initLocalSyncItemsDB({ syncCredential, password });
      },
    );
    const completed = await this.startServerSyncFlow({
      callerName,
      noDebounceUpload,
      forceSync,
    });
    return completed === true;
  }

  @backgroundMethod()
  async updateLastSyncTime({
    syncMode,
  }: {
    syncMode?: ECloudSyncMode;
  } = {}) {
    if (
      (await primeCloudSyncPersistAtom.get()).cloudSyncReconciliation
        ?.unfinished
    )
      return;
    const activeSyncMode = syncMode ?? (await this.getActiveSyncMode());
    const now = Date.now();
    await primeCloudSyncPersistAtom.set(
      (v): IPrimeCloudSyncPersistAtomData => ({
        ...v,
        lastSyncTime: now,
        lastSyncTimeOneKeyId:
          activeSyncMode === ECloudSyncMode.OnekeyId
            ? now
            : v.lastSyncTimeOneKeyId,
        lastSyncTimeKeyless:
          activeSyncMode === ECloudSyncMode.Keyless
            ? now
            : v.lastSyncTimeKeyless,
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
    if (oneKeyIdCloudSyncEnableFlowCount > 0) {
      return;
    }
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
    await this.writeCloudSyncPoolInBatches({
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
    const botWalletMetadataMap = await simpleDb.botWallet.getMetadataMap();
    let botWalletRecords: ICloudSyncBotWalletRecord[] = Object.entries(
      botWalletMetadataMap,
    ).map(([walletId, metadata]) => ({
      walletId,
      metadata,
    }));
    if ((await this.getActiveSyncMode()) === ECloudSyncMode.Keyless) {
      const currentKeylessWalletId =
        await this.getCurrentCloudSyncKeylessWalletId();
      botWalletRecords = filterBotWalletRecordsByCurrentKeylessSyncScope({
        records: botWalletRecords,
        currentKeylessWalletId,
      });
    }
    const syncItemsForBotWallets: IDBCloudSyncItem[] =
      await this.syncManagers.botWallet.buildInitSyncDBItems({
        dbRecords: botWalletRecords,
        allDevices,
        syncCredential,
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

    const allMarketWatchList: IMarketWatchListItemV2[] =
      (
        await this.backgroundApi.serviceMarketV2.getMarketWatchListWithFillingSortIndexV2()
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
    const addressBookItems =
      await this.backgroundApi.serviceAddressBook.getItemsByNetwork({});
    if (addressBookItems?.length) {
      syncItemsForAddressBook =
        await this.syncManagers.addressBook.buildInitSyncDBItems({
          dbRecords: addressBookItems,
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
      ...syncItemsForBotWallets,
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

    await this.writeCloudSyncPoolInBatches({
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
    isCurrent,
  }: {
    skipUploadToServer: boolean;
    isCurrent?: () => boolean;
  }) {
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const guard = () => {
      this.assertCloudSyncGeneration(generation);
      if (
        (isCurrent && !isCurrent()) ||
        keyGeneration !==
          this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration()
      )
        throw new OneKeyLocalError(
          'Cloud sync was cancelled. Pending data has been preserved.',
        );
    };
    guard();
    const syncCredential = await this.getSyncCredentialSafe();
    guard();
    if (!syncCredential) {
      return;
    }
    const currentPwdHash = cloudSyncItemBuilder.getPwdHash(syncCredential);
    // TODO performance, use cursor to get items
    const { items } = await this.getAllLocalSyncItems();
    const itemsToUpdate: IDBCloudSyncItem[] = [];
    const issueUpdates: ICloudSyncAccountIssueUpdate[] = [];
    for (const item of items) {
      guard();
      try {
        const shouldRebuildItem =
          !!item.rawData &&
          (!item.data || (!!currentPwdHash && item.pwdHash !== currentPwdHash));
        if (shouldRebuildItem) {
          const syncManager = this.getSyncManager(item.dataType);
          const rawDataJson = item.rawData
            ? (JSON.parse(item.rawData) as ICloudSyncRawDataJson | undefined)
            : undefined;

          if (rawDataJson?.payload) {
            const payload = rawDataJson.payload;
            if (
              rawDataJson.dataType === EPrimeCloudSyncDataType.Account &&
              'accountId' in payload &&
              typeof payload.accountId === 'string' &&
              payload.accountId.startsWith(PUBLIC_ACCOUNT_SNAPSHOT_PREFIX)
            ) {
              // Only finish a plaintext record created locally. Encrypted
              // records from another key/format are never implicitly migrated.
              if (item.data) continue;
              const {
                snapshot,
                payload: parsedPayload,
                rawKey,
              } = normalizePublicAccountSnapshotRecord(rawDataJson);
              const { accountId } = parsedPayload;
              if (
                payload.accountId !== accountId ||
                rawDataJson.rawKey !== rawKey ||
                item.id !== this.syncManagers.account.rawKeyToHashKey(rawKey)
              )
                throw new OneKeyLocalError(
                  'Invalid public account sync identity',
                );
              const rebuilt =
                await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
                  key: item.id,
                  rawDataJson: {
                    dataType: EPrimeCloudSyncDataType.Account,
                    rawKey,
                    payload: {
                      accountId,
                      name: snapshot.account.name,
                      publicAccountSnapshot: snapshot,
                    },
                  },
                  syncCredential,
                  dataTime: item.dataTime,
                });
              rebuilt.isDeleted = item.isDeleted;
              rebuilt.localSceneUpdated = item.localSceneUpdated;
              rebuilt.serverUploaded = false;
              if (rebuilt.data) rebuilt.rawData = '';
              rememberPublicAccountSnapshotWrite(rebuilt, item);
              itemsToUpdate.push(rebuilt);
              issueUpdates.push({ id: item.id });
              continue;
            }
            let target: any;
            if (item.isDeleted) {
              target = await syncManager.buildSyncTargetByPayload({
                payload: rawDataJson?.payload as any,
              });
            } else {
              target = await syncManager.buildSyncTargetByPayload({
                payload: rawDataJson?.payload as any,
              });
            }
            if (target) {
              const itemToUpdate = await syncManager.buildSyncItem({
                target: target as never,
                dataTime: item.dataTime,
                existingDataTime: item.dataTime,
                allowHistoricalTime: !isNil(item.dataTime),
                preserveUndefinedDataTime: isNil(item.dataTime),
                syncCredential,
                isDeleted: item.isDeleted,
              });
              if (itemToUpdate) itemsToUpdate.push(itemToUpdate);
            }
          }
        }
      } catch (error) {
        if (error instanceof PublicAccountSnapshotUnsupportedError) {
          issueUpdates.push({ id: item.id, issue: 'needsUpdate' });
          continue;
        }
        if (item.rawKey.includes(PUBLIC_ACCOUNT_SNAPSHOT_PREFIX)) {
          issueUpdates.push({ id: item.id, issue: 'rejected' });
        }
        console.error('fillingSyncItemsMissingData error', error);
      }
    }
    guard();
    if (itemsToUpdate.length) {
      await this.writeCloudSyncPoolInBatches({
        items: itemsToUpdate,
        skipUploadToServer,
        isCurrent: () => {
          guard();
          return true;
        },
      });
    }
    guard();
    if (issueUpdates.length)
      await this.publishPublicAccountSnapshotStatus({
        syncCredential,
        updates: issueUpdates,
        counts: {
          needsUpdate: 0,
          pending: 0,
          conflicts: 0,
          rejected: 0,
          added: 0,
          unchanged: 0,
        },
      });
  }

  @backgroundMethod()
  @toastIfError()
  async prepareCloudSyncKeyless({
    silentEnable = false,
  }: {
    silentEnable?: boolean;
  } = {}): Promise<{
    success: boolean;
  }> {
    return this.backgroundApi.serviceKeylessCloudSync.prepareCloudSyncKeyless({
      silentEnable,
    });
  }

  @backgroundMethod()
  @toastIfError()
  async ensureOneKeyIdCloudSyncAvailableForManualSync() {
    await this.ensureOneKeyIdCloudSyncPreparePrerequisites();
    await this.ensureCloudSyncIsAvailable({
      callerName: 'Manual Cloud Sync OneKey ID',
    });
  }

  async ensureOneKeyIdCloudSyncPreparePrerequisites() {
    // A transient or offline check may leave INVALID unconfirmed. Keep the
    // timestamp safety guards, but only block sync for a confirmed clock error.
    if (
      systemTimeUtils.systemTimeStatus === ELocalSystemTimeStatus.INVALID &&
      systemTimeUtils.isTimeErrorConfirmed
    ) {
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
  }

  @backgroundMethod()
  @toastIfError()
  async prepareCloudSync(): Promise<{
    success: boolean;
    isServerMasterPasswordSet?: boolean;
    encryptedSecurityPasswordR1ForServer?: string;
    serverDiffItems?: ICloudSyncServerDiffItem[];
  }> {
    await this.ensureOneKeyIdCloudSyncPreparePrerequisites();

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
        // Force OneKey ID credential here. Enabling OneKey Cloud can start
        // while Keyless is still enabled, and mode-based credential lookup
        // would otherwise route to Keyless and fail.
        syncCredential = await this.buildSyncCredentialForOneKeyId({
          password,
        });
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
        let record: ICloudSyncDBRecord | undefined;
        if (serverPayload) {
          record = await syncManager.getDBRecordBySyncPayload({
            payload: serverPayload as any,
          });
        }
        if (serverToLocalItem) {
          serverDiffItems.push({
            serverToLocalItem,
            localItem,
            serverPayload,
            record,
          });
        }
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
    const syncCredential = await this.getSyncCredentialSafe();
    const { items } = await this.getAllLocalSyncItems();
    console.log('getAllLocalSyncItems: ', { localItems: items });
    const result: IDBCloudSyncItem[] = [];
    for (const item of items) {
      try {
        const decryptedData = await cloudSyncItemBuilder.decryptSyncItem({
          item,
          syncCredential,
        });
        if (decryptedData && process.env.NODE_ENV !== 'production') {
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
    return result.toSorted((a, b) => a.id.localeCompare(b.id));
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
  }): ICloudSyncServerItem | null {
    // Skip Lock items with keyless pwdHash
    if (
      localItem.dataType === EPrimeCloudSyncDataType.Lock &&
      keylessCloudSyncUtils.isKeylessPwdHash(localItem.pwdHash)
    ) {
      return null;
    }
    const serverItem: ICloudSyncServerItem = {
      key: localItem.id,
      dataType: localItem.dataType,
      data: localItem.data || '',
      dataTimestamp: cloudSyncItemBuilder.normalizeDataTime(
        dataTimestamp ?? localItem.dataTime,
      ),
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
  }): Promise<IDBCloudSyncItem | null> {
    // Skip Lock items with keyless pwdHash
    if (
      serverItem.dataType === EPrimeCloudSyncDataType.Lock &&
      keylessCloudSyncUtils.isKeylessPwdHash(serverItem.pwdHash)
    ) {
      console.error('Lock item not support for keyless mode');
      return null;
    }
    const localItem: IDBCloudSyncItem = {
      id: serverItem.key,
      rawKey: '',
      rawData: '',
      dataType: serverItem.dataType, // TODO return from server
      data: serverItem.data,
      dataTime: cloudSyncItemBuilder.normalizeDataTime(
        serverItem.dataTimestamp,
      ),
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
      isTimeErrorConfirmed: systemTimeUtils.isTimeErrorConfirmed,

      lastServerTime: systemTimeUtils.lastServerTime,
      lastServerTimeDate: new Date(
        systemTimeUtils.lastServerTime ?? 0,
      ).toISOString(),

      lastLocalTime: systemTimeUtils.lastLocalTime,
      lastLocalTimeDate: new Date(
        systemTimeUtils.lastLocalTime ?? 0,
      ).toISOString(),

      estimatedServerTime: systemTimeUtils.getEstimatedServerTime(),
      correctedCloudSyncTime: systemTimeUtils.getCorrectedCloudSyncNow(),
    };
  }

  @backgroundMethod()
  @toastIfError()
  async decryptAllServerSyncItems({
    includeDeleted,
  }: {
    includeDeleted?: boolean;
  } = {}) {
    const syncCredential = await this.getSyncCredentialSafe();
    const { serverData: items, pwdHash } = await this.apiDownloadItems({
      includeDeleted,
    });
    const localItems: IDBCloudSyncItem[] = [];
    for (const item of items) {
      try {
        const localItem = await this.convertServerItemToLocalItem({
          serverItem: item,
          shouldDecrypt: true,
          syncCredential,
          serverPwdHash: pwdHash,
        });
        if (localItem) {
          localItems.push(localItem);
          console.log(
            'decryptAllServerSyncItems: ',
            localItem?.rawDataJson?.payload,
            localItem,
          );
        }
      } catch (error) {
        console.error('decryptAllServerSyncItems error', error, item);
        const localItem = await this.convertServerItemToLocalItem({
          serverItem: item,
          shouldDecrypt: false,
          syncCredential,
          serverPwdHash: pwdHash,
        });
        if (localItem) {
          localItems.push(localItem);
        }
      }
    }
    return localItems.toSorted((a, b) => a.id.localeCompare(b.id));
  }

  @backgroundMethodForDev()
  async demoDownloadAllServerSyncItemsAndSaveToLocal() {
    const localItems = await this.decryptAllServerSyncItems();
    await this.writeCloudSyncPoolInBatches({
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
      if (!device) {
        throw new OneKeyLocalError('Device not found');
      }
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
