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
import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import {
  ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD,
  CLOUD_SYNC_ID_SUNSET_REMINDER_TOAST_ID,
  EPrimeCloudSyncDataType,
  PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME,
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
import { HardwareCloudSyncError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import systemTimeUtils, {
  ECloudSyncDataTimeSource,
  ELocalSystemTimeStatus,
  type ICloudSyncCorrectedTime,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils, {
  resolveBeforeTimeout,
} from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';
import { type IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
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
  type IDBDevice,
  type IDBWallet,
  type ILocalDBRecordUpdater,
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
import {
  buildOnlyCheckLocalDataTypes,
  isInactiveHardwareWalletAccount,
  isSupportedCloudSyncDataType,
} from './cloudSyncCheckUtils';
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
import {
  CloudSyncFlowManagerWallet,
  isRetryableWalletVerificationReadError,
} from './CloudSyncFlowManager/CloudSyncFlowManagerWallet';
import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import { splitCloudSyncUploadPostData } from './cloudSyncUploadBatching';
import { waitForCloudSyncUploadBatch } from './cloudSyncUploadPacing';
import keylessCloudSyncUtils from './keylessCloudSyncUtils';
import {
  PUBLIC_ACCOUNT_SNAPSHOT_PREFIX,
  PublicAccountSnapshotUnsupportedError,
  getPublicAccountSnapshotIdentityHash,
  normalizePublicAccountSnapshotRecord,
} from './publicAccountSnapshot';
import {
  guardWalletTie,
  isRejectedPublicAccountSnapshotWrite,
  rememberOfflinePublicAccountSnapshotFill,
  rememberPublicAccountSnapshotWrite,
} from './publicAccountSnapshotWriteGuard';

import type { IWalletNameDeferredObserver } from './CloudSyncFlowManager/CloudSyncFlowManagerBase';
import type {
  IWalletUploadRetry,
  IWalletUploadRetryVersion,
} from './incrementalCloudSync';
import type { IWalletTieState } from './publicAccountSnapshotWriteGuard';
import type { RealmSchemaCloudSyncItem } from '../../dbs/local/realm/schemas/RealmSchemaCloudSyncItem';
import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms';
import type { IManualHardwareWalletRecovery } from '../ServiceKeylessCloudSync/hardwareCloudSyncRecovery';
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

const CLOUD_SYNC_DATA_TIME_FUTURE_TOLERANCE_MS = timerUtils.getTimeDurationMs({
  minute: 10,
});
const CLOUD_SYNC_LAST_ISSUED_DATA_TIME_MAX_ENTRIES = 1000;
const CLOUD_SYNC_LAST_ISSUED_DATA_TIME_TTL_MS = timerUtils.getTimeDurationMs({
  minute: 30,
});

const PRIME_CHECK_CLOCK_MAX_REQUEST_MS = 5000;
const PRIME_CHECK_CLOCK_MAX_AGE_MS = 30_000;

type IPrimeCheckClock = {
  origin: string;
  pwdHash: string;
  upperServerTime: number;
  receivedAt: number;
  receivedWall: number;
  clock: Performance;
  timeOrigin: number;
};

export type IManualCloudSyncResult =
  | 'completed'
  | 'network-unavailable'
  | 'server-unavailable'
  | 'session-unavailable'
  | 'hardware-key-unavailable'
  | 'software-key-unavailable'
  | 'sync-blocked'
  | 'sync-disabled'
  | 'local-deferred'
  | 'cancelled'
  | 'incomplete';

type ISyncNowKeylessParams = {
  callerName?: string;
  noDebounceUpload?: boolean;
  forceSync?: boolean;
  bypassRetryBackoff?: boolean;
  password?: string;
  // Only the hardware Cloud key Sync now button sets this.
  askPasswordOnlyIfHdXfpMissing?: boolean;
};

@backgroundClass()
class ServicePrimeCloudSync extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private primeCheckClock: IPrimeCheckClock | undefined;
  private walletCheckOrigins = new WeakMap<
    ICloudSyncCheckServerStatusResult,
    string
  >();

  private isPendingLivePublicAccount(item: IDBCloudSyncItem) {
    return (
      item.dataType === EPrimeCloudSyncDataType.Account &&
      item.rawKey.startsWith(`Account >> ${PUBLIC_ACCOUNT_SNAPSHOT_PREFIX}`) &&
      !item.serverUploaded &&
      !item.isDeleted &&
      !item.pendingPublicAccountDeletionAt &&
      !!item.data &&
      Number.isSafeInteger(item.dataTime)
    );
  }

  private checkReplyOrigin(
    response: AxiosResponse<
      IApiClientResponse<ICloudSyncCheckServerStatusResult>
    >,
    pwdHash: string,
  ): string | undefined {
    if (response.status !== 200 || response.data.code !== 0 || !response.config)
      return;
    const request = response.request as { responseURL?: string } | undefined;
    const finalUrl = request?.responseURL;
    try {
      if (!finalUrl) return;
      const { origin, pathname, username, password, hash } = new URL(finalUrl);
      if (
        username ||
        password ||
        hash ||
        ![endpointsMap.prod.prime, endpointsMap.test.prime].includes(origin) ||
        response.config.baseURL !== origin ||
        response.config.url !== '/prime/v1/sync/check' ||
        response.config.method?.toLowerCase() !== 'post' ||
        pathname !== '/prime/v1/sync/check'
      )
        return;
      const body = (
        typeof response.config.data === 'string'
          ? JSON.parse(response.config.data)
          : response.config.data
      ) as { pwdHash?: unknown } | undefined;
      if (body?.pwdHash !== pwdHash) return;
      return origin;
    } catch {
      return undefined;
    }
  }

  private capturePrimeCheckClock({
    response,
    data,
    pwdHash,
    startedAt,
    startedWall,
    clock,
    timeOrigin,
  }: {
    response: AxiosResponse<
      IApiClientResponse<ICloudSyncCheckServerStatusResult>
    >;
    data: ICloudSyncCheckServerStatusResult;
    pwdHash: string;
    startedAt: number | undefined;
    startedWall: number;
    clock: Performance;
    timeOrigin: number;
  }): IPrimeCheckClock | undefined {
    const receiptAt = clock?.now();
    const receivedWall = Date.now();
    if (
      !pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) ||
      (data.pwdHash && data.pwdHash !== pwdHash) ||
      globalThis.performance !== clock ||
      !Object.is(clock?.timeOrigin, timeOrigin) ||
      startedAt === undefined ||
      receiptAt === undefined ||
      !Number.isFinite(startedAt) ||
      !Number.isFinite(receiptAt)
    )
      return;
    const duration = receiptAt - startedAt;
    if (
      duration < 0 ||
      duration > PRIME_CHECK_CLOCK_MAX_REQUEST_MS ||
      Math.abs(receivedWall - startedWall - duration) > 1000
    )
      return;
    const age = response.headers?.age ?? response.headers?.Age;
    const date = response.headers?.date ?? response.headers?.Date;
    const origin = this.checkReplyOrigin(response, pwdHash);
    if (!origin || (age !== undefined && age !== '0' && age !== 0)) return;
    try {
      const bodyTime = data.serverTime;
      const headerTime = typeof date === 'string' ? Date.parse(date) : NaN;
      if (
        !Number.isSafeInteger(headerTime) ||
        !systemTimeUtils.isTimeValid({ time: headerTime }) ||
        new Date(headerTime).toUTCString() !== date ||
        (bodyTime !== undefined &&
          (!Number.isSafeInteger(bodyTime) ||
            Math.abs(bodyTime - headerTime) > PRIME_CHECK_CLOCK_MAX_REQUEST_MS))
      )
        return;
      // Use the latest plausible UTC at receipt, not an inferred event time.
      return {
        origin,
        pwdHash,
        upperServerTime: Math.ceil(
          Math.max(bodyTime ?? 0, headerTime + 1000) + duration,
        ),
        receivedAt: receiptAt,
        receivedWall,
        clock,
        timeOrigin,
      };
    } catch {
      return undefined;
    }
  }

  private canHoldFutureAccount(
    item: IDBCloudSyncItem,
    proof: IPrimeCheckClock,
  ): boolean {
    const now = globalThis.performance?.now();
    if (
      !this.isPendingLivePublicAccount(item) ||
      item.pwdHash !== proof.pwdHash ||
      globalThis.performance !== proof.clock ||
      !Object.is(proof.clock.timeOrigin, proof.timeOrigin) ||
      now === undefined ||
      !Number.isFinite(now)
    )
      return false;
    const elapsed = now - proof.receivedAt;
    return (
      elapsed >= 0 &&
      elapsed <= PRIME_CHECK_CLOCK_MAX_AGE_MS &&
      Math.abs(Date.now() - proof.receivedWall - elapsed) <= 1000 &&
      (item.dataTime ?? 0) >
        proof.upperServerTime +
          elapsed +
          CLOUD_SYNC_DATA_TIME_FUTURE_TOLERANCE_MS
    );
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
    requestOptions?: {
      signal?: AbortSignal;
      timeout?: number;
      hardwareRecovery?: IManualHardwareWalletRecovery;
    };
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
    filterHardwareUpload,
    prepareWalletRetry,
    canUploadHardware,
  }: {
    postData: ICloudSyncUploadPostData;
    urlPath: string;
    requestOptions?: { signal?: AbortSignal; timeout?: number };
    canUploadHardware?: () => boolean;
    prepareWalletRetry?: (
      credential: IKeylessCloudSyncCredential,
      baseURL: string | undefined,
    ) => Promise<(() => ICloudSyncUploadPostData) | undefined>;
    filterHardwareUpload?: (
      actualBaseURL: string | undefined,
      pwdHash: string,
    ) => ICloudSyncUploadPostData;
  }) {
    return this.backgroundApi.serviceKeylessCloudSync.apiUploadItemsKeyless({
      postData,
      urlPath,
      requestOptions,
      filterHardwareUpload,
      prepareWalletRetry,
      canUploadHardware,
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

  private pendingLocalMutation:
    | { generation: number; keyGeneration: number; spaceId?: string }
    | undefined;

  private localMutationTimer: ReturnType<typeof setTimeout> | undefined;

  private cloudSyncNetworkReachable: boolean | null | undefined;

  private clearLocalMutationRetry() {
    if (this.localMutationTimer) clearTimeout(this.localMutationTimer);
    this.localMutationTimer = undefined;
    this.pendingLocalMutation = undefined;
  }

  private hasPendingLocalMutation(spaceId: string) {
    const pending = this.pendingLocalMutation;
    if (!pending) return false;
    if (
      pending.generation !== this.publicAccountSnapshotImportGeneration ||
      pending.keyGeneration !==
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration() ||
      (pending.spaceId && pending.spaceId !== spaceId)
    ) {
      this.clearLocalMutationRetry();
      return false;
    }
    pending.spaceId = spaceId;
    return true;
  }

  private async scheduleLocalMutationRetry() {
    const pending = this.pendingLocalMutation;
    if (!pending) return;
    const config = await primeCloudSyncPersistAtom.get();
    if (pending !== this.pendingLocalMutation) return;
    if (this.localMutationTimer) clearTimeout(this.localMutationTimer);
    this.localMutationTimer = undefined;
    // The UI reports known-offline state across runtimes. Its network/unlock
    // wake-up resumes retained work; do not poll while disconnected.
    if (this.cloudSyncNetworkReachable === false) return;
    const state = config.cloudSyncReconciliation;
    const nextRetryAt =
      !pending.spaceId || state?.spaceId === pending.spaceId
        ? state?.nextRetryAt
        : undefined;
    this.localMutationTimer = setTimeout(
      () => {
        this.localMutationTimer = undefined;
        if (pending !== this.pendingLocalMutation) return;
        void this.resumeCloudSyncReconciliation({
          reason: 'local-mutation',
        }).catch((error) => errorUtils.autoPrintErrorIgnore(error));
      },
      Math.max(1000, (nextRetryAt ?? Date.now()) - Date.now()),
    );
  }

  @backgroundMethod()
  async setCloudSyncNetworkReachable(reachable: boolean | null) {
    this.cloudSyncNetworkReachable = reachable;
    if (reachable === false && this.localMutationTimer) {
      clearTimeout(this.localMutationTimer);
      this.localMutationTimer = undefined;
    }
  }

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

  private scheduleReconciliation(nextRetryAt: number, spaceId: string) {
    this.clearReconciliationTimer();
    const generation = this.publicAccountSnapshotImportGeneration;
    // Page cleanup cancels hardware prompts without changing the selected key.
    // Hardware key commits invalidate the credential generation above instead.
    const walletGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getKeylessWalletSelectionGeneration();
    const isCurrent = () =>
      generation === this.publicAccountSnapshotImportGeneration &&
      walletGeneration ===
        this.backgroundApi.serviceKeylessCloudSync.getKeylessWalletSelectionGeneration();
    this.reconciliationTimer = setTimeout(
      () => {
        this.reconciliationTimer = undefined;
        if (!isCurrent()) return;
        void this.getSyncCredentialSafe()
          .then(async (credential) => {
            if (
              !isCurrent() ||
              cloudSyncItemBuilder.getPwdHash(credential) !== spaceId
            )
              return;
            await this.resumeCloudSyncReconciliation({ reason: 'timer' });
          })
          .catch((error) => errorUtils.autoPrintErrorIgnore(error));
      },
      Math.max(1000, nextRetryAt - Date.now()),
    );
  }

  @backgroundMethod()
  async resumeCloudSyncReconciliation({
    reason,
    localOnly = false,
  }: {
    reason:
      | 'startup'
      | 'unlock'
      | 'network'
      | 'foreground'
      | 'timer'
      | 'manual'
      | 'wallet-ready'
      | 'local-mutation';
    localOnly?: boolean;
  }) {
    if (localOnly) return;
    const offline = () => this.cloudSyncNetworkReachable === false;
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const isCurrent = () =>
      generation === this.publicAccountSnapshotImportGeneration &&
      keyGeneration ===
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    if (await this.backgroundApi.serviceApp.isAppLocked()) return;
    if (!(await this.isCloudSyncIsAvailable())) return;
    const credential = await this.getSyncCredentialSafe();
    const spaceId = cloudSyncItemBuilder.getPwdHash(credential);
    if (!credential || !spaceId || !isCurrent()) return;
    if (reason === 'wallet-ready') {
      const { items } = await this.getAllLocalSyncItems();
      await this.replayDownloadedAccounts({ items, credential, isCurrent });
      return;
    }
    const config = await primeCloudSyncPersistAtom.get();
    if (!isCurrent()) return;
    let state =
      config.cloudSyncReconciliation?.spaceId === spaceId
        ? config.cloudSyncReconciliation
        : undefined;
    if (reason === 'manual' && state?.nextRetryAt) {
      // Clear the persisted deadline too: the full reconciliation entry point
      // independently enforces it. Keep failure counts so a failed manual retry
      // still re-arms the normal automatic backoff.
      await primeCloudSyncPersistAtom.set((value) => {
        if (!isCurrent() || value.cloudSyncReconciliation?.spaceId !== spaceId)
          return value;
        return {
          ...value,
          cloudSyncReconciliation: {
            ...value.cloudSyncReconciliation,
            nextRetryAt: undefined,
          },
        };
      });
      if (!isCurrent()) return;
      this.clearReconciliationTimer();
      state = { ...state, nextRetryAt: undefined };
    }
    if (this.hasPendingLocalMutation(spaceId)) {
      if (offline()) return;
      return this.startServerSyncFlowSilently({
        callerName: `Cloud local mutation ${reason}`,
      });
    }
    if (reason === 'local-mutation') return;
    if (state && !state.unfinished && reason !== 'timer') {
      // A committed local write can outlive its in-memory debounce/retry marker.
      // Recover it after restart before treating the last completed run as clean.
      const { items } = await this.getAllLocalSyncItems();
      if (!isCurrent()) return;
      if (state.status === 'complete') {
        await this.replayDownloadedAccounts({
          items,
          credential,
          isCurrent,
        });
      }
      const isOffline = offline();
      if (!isCurrent() || isOffline) return;
      if (
        !isOffline &&
        items.some(
          (item) =>
            item.pwdHash === spaceId &&
            (!item.serverUploaded || !!item.pendingPublicAccountDeletionAt),
        )
      )
        return this.startServerSyncFlowSilently({
          callerName: `Cloud persisted local mutation ${reason}`,
          localMutation: true,
        });
    }
    // Completion describes the last comparison, not future remote changes.
    // Lifecycle/manual wakes must check again even when the local pool is clean;
    // only a stale retry timer can stop at an already completed run.
    if (
      reason === 'timer' &&
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
      this.scheduleReconciliation(nextRetryAt, state.spaceId);
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
                !selected ||
                cloudSyncItemBuilder.getPwdHash(selected) !== spaceId
              )
                return;
              await this.syncPendingItemsToScene({
                isCurrent,
              });
              if (!isCurrent()) return;
              await primeCloudSyncPersistAtom.set((value) => {
                if (
                  !isCurrent() ||
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
      await this.localReplayPromise;
      // Pending local dependencies must not hide later changes in other wallets.
      // Timer retries remain local-only; lifecycle/manual wakes compare the full
      // downloaded summary through the normal bounded, single-flight runner.
      if (reason === 'timer' || !isCurrent() || offline()) return;
      const selected = await this.getSyncCredentialSafe();
      if (!isCurrent() || cloudSyncItemBuilder.getPwdHash(selected) !== spaceId)
        return;
    }
    return this.startServerSyncFlowSilently({
      callerName: `Cloud reconciliation ${reason}`,
    });
  }

  private async replayDownloadedAccounts({
    items,
    credential,
    isCurrent,
  }: {
    items: IDBCloudSyncItem[];
    credential: ICloudSyncCredential;
    isCurrent: () => boolean;
  }) {
    const spaceId = cloudSyncItemBuilder.getPwdHash(credential);
    const pending = items.filter(
      (item) =>
        item.dataType === EPrimeCloudSyncDataType.Account &&
        item.pwdHash === spaceId &&
        item.serverUploaded &&
        !item.pendingPublicAccountDeletionAt &&
        !item.localSceneUpdated &&
        item.data &&
        item.dataTime,
    );
    if (!isCurrent() || !pending.length) return;
    await this.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock(
      async () => {
        if (!isCurrent()) return;
        const selected = await this.getSyncCredentialSafe();
        if (
          !isCurrent() ||
          cloudSyncItemBuilder.getPwdHash(selected) !== spaceId
        )
          return;
        await this.syncToSceneWithLocalSyncItems({
          items: pending,
          syncCredential: credential,
          isCurrent,
        });
      },
    );
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
    this.clearLocalMutationRetry();
    this.walletUploadReadRetry = undefined;
    this.clearQueuedHardwareDirectUploads();
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
    await primeCloudSyncPersistAtom.set((value) => {
      const status = { ...counts, ...issues };
      const state = value.cloudSyncReconciliation;
      const hasPending =
        status.needsUpdate +
          status.pending +
          status.conflicts +
          status.rejected >
        0;
      return {
        ...value,
        publicAccountSnapshotStatus: status,
        // Push downloads can introduce local work after the network drain has
        // completed. Allow local replay when its dependencies become ready.
        cloudSyncReconciliation:
          hasPending &&
          state?.spaceId === spaceId &&
          state.status === 'complete' &&
          !state.unfinished
            ? { ...state, status: 'partial', updatedAt: Date.now() }
            : state,
      };
    });
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
      skip: start,
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
    console.log('prime cloud sync apiDownloadItems', {
      count: data.serverData?.length,
    });
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
      hardwareRecovery?: IManualHardwareWalletRecovery;
    } = {},
  ): Promise<ICloudSyncCheckServerStatusResult> {
    const items = (localItems ?? []).filter(
      (item) => !item.pendingPublicAccountDeletionAt,
    );
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

    const clock = globalThis.performance;
    const timeOrigin = clock?.timeOrigin;
    const startedAt = clock?.now();
    const startedWall = Date.now();
    const isKeylessCheck =
      (await this.getActiveSyncMode()) === ECloudSyncMode.Keyless;
    if (isKeylessCheck) {
      const checkResult = await this.apiCheckServerStatusKeyless({
        postData,
        requestOptions: {
          signal: requestOptions.signal,
          timeout: requestOptions.timeout,
          hardwareRecovery: requestOptions.hardwareRecovery,
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
    const proof =
      isKeylessCheck && response && responseData && pwdHash
        ? this.capturePrimeCheckClock({
            response,
            data: responseData,
            pwdHash,
            startedAt,
            startedWall,
            clock,
            timeOrigin,
          })
        : undefined;
    this.primeCheckClock = proof;
    if (
      isKeylessCheck &&
      response &&
      responseData &&
      pwdHash &&
      (!responseData.pwdHash || responseData.pwdHash === pwdHash)
    ) {
      const origin = proof?.origin ?? this.checkReplyOrigin(response, pwdHash);
      if (origin) this.walletCheckOrigins.set(responseData, origin);
    }

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
    console.log('prime cloud sync apiCheck', {
      diffCount: responseData.diff?.length,
      updatedCount: responseData.updated?.length,
      deletedCount: responseData.deleted?.length,
    });
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
    skipLastSyncTime = false,
  ) {
    const generation = this.publicAccountSnapshotImportGeneration;
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
          ...(skipLastSyncTime ? { skipLastSyncTime } : {}),
        }),
      );
    }

    if (
      pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) &&
      generation !== this.publicAccountSnapshotImportGeneration
    )
      return undefined;
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
    skipLastSyncTime,
    prepareWalletRetry,
    canUploadHardware,
    hardwareUploadSignal,
  }: {
    localItems: IDBCloudSyncItem[];
    isFlush: boolean | undefined;
    lockItem: IDBCloudSyncItem | undefined;
    pwdHash: string;
    setUndefinedTimeToNow: boolean | undefined;
    requestOptions?: { signal?: AbortSignal; timeout?: number };
    skipLastSyncTime?: boolean;
    canUploadHardware?: () => boolean;
    hardwareUploadSignal?: AbortSignal;
    prepareWalletRetry?: (
      batch: ICloudSyncUploadPostData,
      credential: IKeylessCloudSyncCredential,
      baseURL: string | undefined,
    ) => Promise<(() => ICloudSyncUploadPostData) | undefined>;
  }) => {
    if (canUploadHardware && !canUploadHardware()) return undefined;
    const uploadGeneration = this.publicAccountSnapshotImportGeneration;
    const now = await this.getCloudSyncDataTime();
    // Only guard detached direct uploads. Reconciliation keeps its
    // legacy response, clamping and follow-up semantics entirely unchanged.
    const proof = isFlush || requestOptions ? undefined : this.primeCheckClock;
    const guardedLiveItems =
      proof?.pwdHash === pwdHash
        ? new Map(
            localItems
              .filter((item) => this.canHoldFutureAccount(item, proof))
              .map((item) => [item.id, item]),
          )
        : undefined;
    const localData: ICloudSyncServerItem[] = localItems
      .filter(
        (item) =>
          isSupportedCloudSyncDataType(item.dataType) &&
          !item.pendingPublicAccountDeletionAt &&
          !isRejectedPublicAccountSnapshotWrite(item),
      )
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
    const uploadMode = await this.getActiveSyncMode();
    if (
      (prepareWalletRetry || canUploadHardware) &&
      uploadMode !== ECloudSyncMode.Keyless
    )
      return undefined;
    let heldItems = false;
    let previousBatchStartedAt: number | undefined;
    for (const batch of postDataBatches) {
      if (!isFlush) {
        if (uploadGeneration !== this.publicAccountSnapshotImportGeneration) {
          throw new OneKeyLocalError('Cloud sync was cancelled');
        }
        await waitForCloudSyncUploadBatch({
          previousBatchStartedAt,
          signal: requestOptions?.signal,
        });
      }
      if (
        requestOptions?.signal?.aborted ||
        (!isFlush &&
          uploadGeneration !== this.publicAccountSnapshotImportGeneration)
      ) {
        throw new OneKeyLocalError(
          'Cloud sync was cancelled. Pending data has been preserved.',
        );
      }
      if (canUploadHardware && !canUploadHardware()) return undefined;
      previousBatchStartedAt = Date.now();
      let batchResult: ICloudSyncUploadResult | undefined;
      if (uploadMode === ECloudSyncMode.Keyless) {
        let actualSentCount = batch.localData.length;
        const noUpload = new OneKeyLocalError({
          message: 'Cloud upload pending trusted time',
          autoToast: false,
        });
        try {
          batchResult = await this.apiUploadItemsKeyless({
            postData: batch,
            urlPath,
            requestOptions: hardwareUploadSignal
              ? { ...requestOptions, signal: hardwareUploadSignal }
              : requestOptions,
            ...(canUploadHardware ? { canUploadHardware } : {}),
            ...(prepareWalletRetry
              ? {
                  prepareWalletRetry: async (
                    credential: IKeylessCloudSyncCredential,
                    baseURL: string | undefined,
                  ) => {
                    const prepare = await prepareWalletRetry(
                      batch,
                      credential,
                      baseURL,
                    );
                    if (!prepare) {
                      actualSentCount = 0;
                      throw noUpload;
                    }
                    return () => {
                      const outgoing = prepare();
                      actualSentCount = outgoing.localData.length;
                      return outgoing;
                    };
                  },
                }
              : {}),
            ...(proof && guardedLiveItems?.size
              ? {
                  filterHardwareUpload: (
                    baseURL: string | undefined,
                    selectedPwdHash: string,
                  ) => {
                    if (
                      baseURL !== proof.origin ||
                      selectedPwdHash !== proof.pwdHash ||
                      this.primeCheckClock !== proof
                    ) {
                      actualSentCount = batch.localData.length;
                      return batch;
                    }
                    const outgoing = batch.localData.filter((record) => {
                      const local = guardedLiveItems.get(record.key);
                      return (
                        !local ||
                        local.dataTime !== record.dataTimestamp ||
                        local.data !== record.data ||
                        !this.canHoldFutureAccount(local, proof)
                      );
                    });
                    actualSentCount = outgoing.length;
                    if (!actualSentCount) throw noUpload;
                    return { ...batch, localData: outgoing };
                  },
                }
              : {}),
          });
        } catch (error) {
          if (canUploadHardware && !canUploadHardware()) return undefined;
          if (error !== noUpload) throw error;
        }
        if (actualSentCount !== batch.localData.length) {
          heldItems = true;
          if (
            batchResult &&
            (!Number.isSafeInteger(batchResult.created) ||
              !Number.isSafeInteger(batchResult.updated) ||
              batchResult.created < 0 ||
              batchResult.updated < 0 ||
              batchResult.created + batchResult.updated > actualSentCount)
          ) {
            throw new OneKeyLocalError({
              message: 'Cloud sync returned an invalid partial upload count',
              autoToast: false,
            });
          }
        }
      } else {
        const client = await this.backgroundApi.servicePrime.getPrimeClient();
        const result = await client.post<
          IApiClientResponse<ICloudSyncUploadResult>
        >(urlPath, batch, requestOptions);
        console.log('prime cloud sync apiUploadItems: ', result?.data?.data);
        batchResult = result?.data?.data;
      }
      if (canUploadHardware && !canUploadHardware()) return undefined;
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

    if (!heldItems && !skipLastSyncTime) void this.updateLastSyncTime();

    return uploadResult;
  };

  uploadItemsToMerge: IDBCloudSyncItem[] = [];

  private uploadItemsMutex = new Semaphore(1);

  private queuedHardwareUploadIsCurrent: (() => boolean) | undefined;

  captureHardwareDirectUploadScope(): () => boolean {
    const keyless = this.backgroundApi.serviceKeylessCloudSync;
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration = keyless.getHardwareUploadGeneration();
    return () =>
      keyGeneration !== undefined &&
      generation === this.publicAccountSnapshotImportGeneration &&
      keyGeneration === keyless.getHardwareUploadGeneration();
  }

  private clearQueuedHardwareDirectUploads() {
    this.queuedHardwareUploadIsCurrent = undefined;
    this.uploadItemsToMerge = this.uploadItemsToMerge.filter(
      (item) =>
        !item.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX),
    );
  }

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
    const hardware = pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX);
    const canUploadHardware = hardware
      ? this.captureHardwareDirectUploadScope()
      : undefined;
    if (canUploadHardware) {
      if (!canUploadHardware()) return undefined;
      if (!this.queuedHardwareUploadIsCurrent?.())
        this.clearQueuedHardwareDirectUploads();
      this.queuedHardwareUploadIsCurrent = canUploadHardware;
    }
    this.uploadItemsToMerge = uniqBy(
      [...localItems, ...this.uploadItemsToMerge],
      (i: IDBCloudSyncItem) => i.id,
    );
    if (noDebounceUpload || this.uploadItemsToMerge.length >= 500) {
      return this._callApiUploadItemsInstantly({
        pwdHash,
        setUndefinedTimeToNow,
        canUploadHardware,
      });
    }
    return this._callApiUploadItemsDebounced({
      pwdHash,
      setUndefinedTimeToNow,
      canUploadHardware,
    });
  }

  _callApiUploadItemsInstantly = async ({
    pwdHash,
    setUndefinedTimeToNow,
    canUploadHardware: queuedScope,
  }: {
    pwdHash: string;
    setUndefinedTimeToNow?: boolean;
    canUploadHardware?: () => boolean;
  }) => {
    const canUploadHardware =
      queuedScope ??
      (pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX)
        ? this.captureHardwareDirectUploadScope()
        : undefined);
    return this.uploadItemsMutex.runExclusive(async () => {
      if (canUploadHardware && !canUploadHardware()) return;
      const localItems = [...this.uploadItemsToMerge];
      this.uploadItemsToMerge = [];
      if (localItems.length) {
        const controller = canUploadHardware
          ? new AbortController()
          : undefined;
        if (controller) this.cloudSyncItemAbortControllers.add(controller);
        try {
          let outgoing = localItems;
          if (
            canUploadHardware &&
            localItems.some(
              (item) =>
                item.dataType === EPrimeCloudSyncDataType.Wallet &&
                !!item.data &&
                !item.isDeleted &&
                !item.serverUploaded &&
                item.pwdHash === pwdHash,
            )
          ) {
            const keyless = this.backgroundApi.serviceKeylessCloudSync;
            const isCurrent = canUploadHardware;
            // Record the actual client origin while the initial attempt owns
            // this scope, never retrospectively from the retry request.
            let retryOrigin: string | undefined;
            void keyless
              .getHardwareWalletRetryOrigin()
              .then((baseURL) => {
                if (baseURL?.startsWith('https://') && isCurrent())
                  retryOrigin = baseURL;
              })
              .catch((error) => errorUtils.autoPrintErrorIgnore(error));
            outgoing = await this.filterDivergentPendingWalletNames({
              items: localItems,
              credential: () => keyless.getLocalMutationSyncCredential(),
              expectedPwdHash: pwdHash,
              isCurrent,
              onTimeout: (items) => {
                if (retryOrigin)
                  this.scheduleWalletUploadReadRetry({
                    items,
                    pwdHash,
                    origin: retryOrigin,
                    isCurrent,
                  });
              },
            });
          }
          if (!outgoing.length) return;
          await this._callApiUploadItems({
            localItems: outgoing,
            ...(outgoing.length < localItems.length
              ? { skipLastSyncTime: true }
              : {}),
            isFlush: false,
            lockItem: undefined,
            pwdHash,
            setUndefinedTimeToNow,
            canUploadHardware,
            hardwareUploadSignal: controller?.signal,
          });
        } catch (error) {
          if (canUploadHardware && !canUploadHardware()) return;
          // Newer queued writes win. Acknowledged batches may be retried;
          // persistent sync items remain the source of truth after a restart.
          this.uploadItemsToMerge = uniqBy(
            [...this.uploadItemsToMerge, ...localItems],
            (item) => item.id,
          );
          throw error;
        } finally {
          if (controller) this.cloudSyncItemAbortControllers.delete(controller);
        }
      }
    });
  };

  captureWalletUploadReadRetry(credential: IKeylessCloudSyncCredential) {
    const { pwdHash, hardwareSession, source } = credential;
    const origin = hardwareSession?.boundBaseURL;
    if (
      source?.type !== 'hardware' ||
      !origin?.startsWith('https://') ||
      !pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX)
    )
      return undefined;
    const isCurrent = this.captureHardwareDirectUploadScope();
    return (item: IDBCloudSyncItem, error: unknown) => {
      if (
        !isRetryableWalletVerificationReadError(error) ||
        item.dataType !== EPrimeCloudSyncDataType.Wallet ||
        item.pwdHash !== pwdHash ||
        !item.data ||
        item.serverUploaded ||
        item.isDeleted ||
        item.pendingPublicAccountDeletionAt ||
        item.pendingPublicAccountDeletionHash ||
        !isCurrent()
      )
        return;
      this.scheduleWalletUploadReadRetry({
        items: [
          {
            ...item,
            dataTime: cloudSyncItemBuilder.normalizeDataTime(item.dataTime),
          },
        ],
        pwdHash,
        origin,
        isCurrent,
      });
    };
  }

  private walletUploadReadRetry?: IWalletUploadRetry;

  private loadWalletUploadRetryModule() {
    return import('./incrementalCloudSync');
  }

  private scheduleWalletUploadReadRetry({
    items,
    pwdHash,
    origin,
    isCurrent,
  }: {
    items: IWalletUploadRetryVersion[];
    pwdHash: string;
    origin: string;
    isCurrent: () => boolean;
  }) {
    const offeredAt = Date.now();
    const deadline = offeredAt + 30_000;
    const canRetry = () => Date.now() < deadline && isCurrent();
    if (!canRetry()) return;
    void this.loadWalletUploadRetryModule()
      .then((retryModule) => {
        if (!canRetry()) return;
        const retry = retryModule.mergeWalletUploadRetryCandidates({
          pending: this.walletUploadReadRetry,
          items,
          pwdHash,
          origin,
          isCurrent: canRetry,
        });
        if (!retry) return;
        this.walletUploadReadRetry = retry;
        setTimeout(
          () => {
            if (this.walletUploadReadRetry !== retry) return;
            const drain = async () => {
              if (this.walletUploadReadRetry !== retry) return;
              this.walletUploadReadRetry = undefined;
              if (!canRetry()) return;
              const controller = new AbortController();
              const isRetryCurrent = () =>
                !controller.signal.aborted && canRetry();
              this.cloudSyncItemAbortControllers.add(controller);
              try {
                await resolveBeforeTimeout(
                  (async () => {
                    const expected = new Map<
                      string,
                      IWalletUploadRetryVersion
                    >();
                    const contested: string[] = [];
                    for (const [id, versions] of retry.items) {
                      if (versions?.length === 1) expected.set(id, versions[0]);
                      else if (versions) contested.push(id);
                    }
                    // A corrected clock may persist a later edit at a lower
                    // timestamp. Only the exact stored candidate wins, never
                    // the greater timestamp or the last arrival.
                    if (contested.length) {
                      const contestedRead = await resolveBeforeTimeout(
                        (async () => {
                          try {
                            return await localDb.getRecordsByIds({
                              name: ELocalDBStoreNames.CloudSyncItem,
                              ids: contested,
                            });
                          } catch (error) {
                            errorUtils.autoPrintErrorIgnore(error);
                            return undefined;
                          }
                        })(),
                        250,
                      );
                      if (!isRetryCurrent()) return;
                      for (const row of contestedRead?.records ?? []) {
                        const exact =
                          row &&
                          retry.items
                            .get(row.id)
                            ?.find((candidate) =>
                              retryModule.matchesWalletUploadRetryVersion(
                                row,
                                candidate,
                              ),
                            );
                        if (exact) expected.set(exact.id, exact);
                      }
                    }
                    if (!expected.size || !isRetryCurrent()) return;
                    return this._callApiUploadItems({
                      localItems: [...expected.values()],
                      isFlush: false,
                      lockItem: undefined,
                      pwdHash,
                      setUndefinedTimeToNow: false,
                      requestOptions: {
                        signal: controller.signal,
                        timeout: 10_000,
                      },
                      skipLastSyncTime: true,
                      canUploadHardware: isRetryCurrent,
                      prepareWalletRetry: async (
                        batch,
                        credential,
                        baseURL,
                      ) => {
                        if (baseURL !== origin) return undefined;
                        return retryModule.prepareWalletUploadReadRetry({
                          backgroundApi: this.backgroundApi,
                          filterDivergentPendingWalletNames: (options) =>
                            this.filterDivergentPendingWalletNames(options),
                          batch,
                          credential,
                          expected,
                          isCurrent: isRetryCurrent,
                        });
                      },
                    });
                  })(),
                  12_000,
                );
              } finally {
                // A slow optional read must not keep the upload semaphore or
                // send a later request after the retry window has closed.
                controller.abort();
                this.cloudSyncItemAbortControllers.delete(controller);
              }
            };
            void this.uploadItemsMutex
              .runExclusive(drain)
              .catch((error) => errorUtils.autoPrintErrorIgnore(error));
          },
          Math.max(0, offeredAt + 1000 - Date.now()),
        );
      })
      .catch(errorUtils.autoPrintErrorIgnore);
  }

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
    offlineCredential,
    onWalletNameHistoryDeferred,
  }: {
    offlineCredential?: ICloudSyncCredential;
    onWalletNameHistoryDeferred?: IWalletNameDeferredObserver;
    forceSync?: boolean;
    isCurrent?: () => boolean;
  } = {}) {
    if (!offlineCredential && !(await this.isCloudSyncIsAvailable())) {
      return;
    }
    const syncCredential =
      offlineCredential ?? (await this.getSyncCredentialSafe());
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
      localOnly: !!offlineCredential,
      onWalletNameHistoryDeferred,
    });
  }

  // TODO mutex
  async syncToSceneWithLocalSyncItems({
    items,
    syncCredential,
    forceSync,
    isCurrent,
    foreignAccountsByWireId,
    localOnly = false,
    onWalletNameHistoryDeferred,
    walletAvatarPredecessors,
  }: {
    localOnly?: boolean;
    onWalletNameHistoryDeferred?: IWalletNameDeferredObserver;
    walletAvatarPredecessors?: ReadonlyMap<string, IDBCloudSyncItem>;
    items: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential;
    forceSync?: boolean;
    isCurrent?: () => boolean;
    foreignAccountsByWireId?: ReadonlyMap<string, IDBCloudSyncItem>;
  }) {
    if (!syncCredential) {
      return;
    }
    if (!localOnly && !(await this.isCloudSyncIsAvailable())) {
      return;
    }
    return this._syncToSceneWithLocalSyncItems({
      items,
      syncCredential,
      forceSync,
      isCurrent,
      foreignAccountsByWireId,
      localOnly,
      onWalletNameHistoryDeferred,
      walletAvatarPredecessors,
    });
  }

  async _syncToSceneWithLocalSyncItems({
    items,
    syncCredential,
    forceSync,
    isCurrent,
    foreignAccountsByWireId,
    localOnly = false,
    onWalletNameHistoryDeferred,
    walletAvatarPredecessors,
  }: {
    localOnly?: boolean;
    onWalletNameHistoryDeferred?: IWalletNameDeferredObserver;
    walletAvatarPredecessors?: ReadonlyMap<string, IDBCloudSyncItem>;
    items: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential | undefined;
    forceSync?: boolean;
    isCurrent?: () => boolean;
    foreignAccountsByWireId?: ReadonlyMap<string, IDBCloudSyncItem>;
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

    const activePwdHash = cloudSyncItemBuilder.getPwdHash(syncCredential);
    for (const item of items) {
      if (
        item.pendingPublicAccountDeletionAt ||
        isInactiveHardwareWalletAccount(item, activePwdHash) ||
        !isSupportedCloudSyncDataType(item.dataType)
      )
        continue;
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
      isCurrent,
      ...(walletAvatarPredecessors?.size ? { walletAvatarPredecessors } : {}),
      onWalletNameHistoryDeferred,
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
    let accountsChanged = false;
    await this.syncManagers.account.syncToScene({
      syncCredential,
      items: accountItems,
      forceSync,
      isCurrent,
      foreignAccountsByWireId,
      localOnly,
      onAccountsChanged: () => {
        accountsChanged = true;
      },
    });
    assertCurrent();
    await this.syncManagers.indexedAccount.syncToScene({
      syncCredential,
      items: indexedAccountItems,
      forceSync,
    });
    assertCurrent();
    if (accountsChanged || indexedAccountItems.length) {
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
    onWalletNameHistoryDeferred,
    deferPushBatchLastSyncTime = false,
    skipLastSyncTime = false,
    tieState,
    tieOrigin,
  }: {
    serverItems: ICloudSyncServerItem[];
    shouldSyncToScene: boolean;
    syncCredential: ICloudSyncCredential | undefined;
    serverPwdHash: string;
    isCurrent?: () => boolean;
    onWalletNameHistoryDeferred?: IWalletNameDeferredObserver;
    deferPushBatchLastSyncTime?: boolean;
    skipLastSyncTime?: boolean;
    tieState?: IWalletTieState;
    tieOrigin?: string;
  }) {
    const pushGeneration = this.publicAccountSnapshotImportGeneration;
    const keyGeneration = deferPushBatchLastSyncTime
      ? this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration()
      : undefined;
    const pushBatchIsCurrent = deferPushBatchLastSyncTime
      ? () =>
          pushGeneration === this.publicAccountSnapshotImportGeneration &&
          keyGeneration ===
            this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration()
      : undefined;
    const config = await primeCloudSyncPersistAtom.get();
    if (
      config.hardwareCloudSyncKeySource &&
      (!config.isCloudSyncEnabledKeyless ||
        syncCredential?.keylessCredential?.source?.credentialId !==
          config.hardwareCloudSyncKeySource.credentialId ||
        !syncCredential.keylessCredential.hardwareSession ||
        syncCredential.keylessCredential.pwdHash !== serverPwdHash)
    ) {
      // Keep unsynced local data until the selected hardware key can decrypt it.
      return;
    }
    const generation = this.publicAccountSnapshotImportGeneration;
    const guard = () => {
      this.assertCloudSyncGeneration(generation);
      if (isCurrent && !isCurrent())
        throw new OneKeyLocalError('Cloud sync was cancelled');
    };
    const localItems: IDBCloudSyncItem[] = [];
    const ties: IDBCloudSyncItem[] = [];
    const scope =
      serverPwdHash &&
      cloudSyncItemBuilder.getPwdHash(syncCredential) === serverPwdHash
        ? tieState
        : undefined;
    for (let offset = 0; offset < serverItems.length; offset += 50) {
      guard();
      const converted = await Promise.all(
        serverItems
          .slice(offset, offset + 50)
          .filter((item) => isSupportedCloudSyncDataType(item.dataType))
          .map(async (serverItem) => {
            const item = await this.convertServerItemToLocalItem({
              serverItem,
              shouldDecrypt: false,
              syncCredential,
              serverPwdHash,
            });
            if (tieState && item?.dataType === EPrimeCloudSyncDataType.Wallet) {
              guardWalletTie(item, tieState);
              if (
                scope &&
                typeof serverItem.isDeleted === 'boolean' &&
                item.pwdHash === serverPwdHash &&
                Number.isSafeInteger(serverItem.dataTimestamp) &&
                (serverItem.dataTimestamp ?? 0) > 0
              )
                ties.push(item);
            }
            return item;
          }),
      );
      localItems.push(
        ...converted.filter((item): item is IDBCloudSyncItem => Boolean(item)),
      );
      if (offset + 50 < serverItems.length) await timerUtils.wait(0);
    }
    guard();

    if (ties.length && syncCredential && tieState && tieOrigin) {
      let active = true;
      try {
        await resolveBeforeTimeout(
          (async () => {
            if (
              tieOrigin !==
              (await this.backgroundApi.serviceKeylessCloudSync.getHardwareWalletRetryOrigin())
            )
              return;
            if (active && tieState.isCurrent()) tieState.sameNode = true;
            const helper = await import('./incrementalCloudSync');
            await helper.verifyWalletTies(
              this.syncManagers.wallet,
              tieState,
              ties,
              syncCredential,
              () =>
                active &&
                generation === this.publicAccountSnapshotImportGeneration &&
                (isCurrent?.() ?? true),
            );
          })(),
          1500,
        );
      } catch {
        // Unproven ties must not discard the equally dated live version.
      } finally {
        active = false;
      }
      guard();
    }

    return this.updateLocalItemsByServer({
      localItems,
      syncCredential,
      shouldSyncToScene,
      isCurrent: tieState
        ? () =>
            (isCurrent?.() ?? true) &&
            (tieState.isCurrent() ||
              !localItems.some(
                (item) => tieState.accepted.get(item.id) === item,
              ))
        : isCurrent,
      captureFreshWalletAvatar: !!isCurrent && shouldSyncToScene,
      onWalletNameHistoryDeferred,
      pushBatchIsCurrent,
      skipLastSyncTime,
      tieState,
      allowSettledAccountHandoff:
        !config.isCloudSyncEnabled &&
        !!config.isCloudSyncEnabledKeyless &&
        !!config.hardwareCloudSyncKeySource &&
        !!syncCredential?.keylessCredential?.hardwareSession &&
        config.hardwareCloudSyncKeySource.derivationVersion ===
          syncCredential.keylessCredential.source?.derivationVersion,
    });
  }

  async saveServerDeletedItemsToLocal({
    deletedItemIds,
    requestItems,
    shouldSyncToScene,
    syncCredential,
    serverPwdHash,
    isCurrent,
    skipLastSyncTime = false,
    tieState,
  }: {
    deletedItemIds: string[];
    requestItems: IDBCloudSyncItem[];
    shouldSyncToScene: boolean;
    syncCredential: ICloudSyncCredential | undefined;
    serverPwdHash: string;
    isCurrent?: () => boolean;
    skipLastSyncTime?: boolean;
    tieState?: IWalletTieState;
  }) {
    // A bare deletion ACK only applies to the version sent in that request.
    // Preserve that version and compare it atomically inside the DB write.
    const deletedIds = new Set(deletedItemIds);
    const items = requestItems.filter((item) => deletedIds.has(item.id));

    return this.updateLocalItemsByServer({
      localItems: items.filter(Boolean).map((item) => {
        const newItem: IDBCloudSyncItem = {
          ...item,
          isDeleted: true,
          pwdHash: item.pwdHash || serverPwdHash,
        };
        cloudSyncItemBuilder.setDefaultPropsOfServerToLocalItem({
          localItem: newItem,
        });
        return rememberPublicAccountSnapshotWrite(newItem, item);
      }),
      syncCredential,
      shouldSyncToScene,
      isCurrent,
      skipLastSyncTime,
      tieState,
    });
  }

  async updateLocalItemsByServer({
    localItems: incomingItems,
    syncCredential,
    shouldSyncToScene,
    isCurrent,
    allowSettledAccountHandoff = false,
    captureFreshWalletAvatar = false,
    onWalletNameHistoryDeferred,
    pushBatchIsCurrent,
    skipLastSyncTime = false,
    tieState,
  }: {
    localItems: IDBCloudSyncItem[];
    syncCredential: ICloudSyncCredential | undefined;
    shouldSyncToScene: boolean;
    isCurrent?: () => boolean;
    allowSettledAccountHandoff?: boolean;
    captureFreshWalletAvatar?: boolean;
    onWalletNameHistoryDeferred?: IWalletNameDeferredObserver;
    pushBatchIsCurrent?: () => boolean;
    skipLastSyncTime?: boolean;
    tieState?: IWalletTieState;
  }) {
    const localItems = incomingItems.filter((item) =>
      isSupportedCloudSyncDataType(item.dataType),
    );
    if (!localItems.length) return;
    const activePwdHash = cloudSyncItemBuilder.getPwdHash(syncCredential);
    const preserveExisting = (
      item: Pick<IDBCloudSyncItem, 'pwdHash' | 'dataType'>,
    ) => isInactiveHardwareWalletAccount(item, activePwdHash);
    const foreignAccountsByWireId = new Map<string, IDBCloudSyncItem>();
    const collisionCandidates: IDBCloudSyncItem[] = [];
    const mayHandoff =
      allowSettledAccountHandoff &&
      shouldSyncToScene &&
      syncCredential?.keylessCredential?.source?.type === 'hardware' &&
      !!syncCredential.keylessCredential.hardwareSession &&
      activePwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX);
    if (mayHandoff) {
      // Optional collision recognition is read-only and bounded. Do not
      // serialize DB/crypto work behind the key lock used by local actions.
      const candidates = localItems.filter(
        (item) =>
          item.dataType === EPrimeCloudSyncDataType.Account &&
          item.pwdHash === activePwdHash &&
          item.serverUploaded &&
          !item.isDeleted &&
          !!item.data &&
          item.data.length <= 64 * 1024,
      );
      if (candidates.length) {
        let finished = false;
        const canContinue = () => !finished && (isCurrent?.() ?? true);
        try {
          await resolveBeforeTimeout(
            (async () => {
              const helper = await import('./incrementalCloudSync');
              await helper.probeAccountHandoffs(
                localDb,
                candidates,
                syncCredential,
                canContinue,
                foreignAccountsByWireId,
                collisionCandidates,
              );
            })(),
            1500,
          );
        } catch {
          // A speculative DB read must not prevent ordinary reconciliation.
        } finally {
          finished = true;
        }
      }
    }
    const priorWalletVersions = new Map<
      string,
      {
        prior: IDBCloudSyncItem;
        incoming: IDBCloudSyncItem;
      }
    >();
    console.log('updateLocalItemsByServer', localItems.length);
    await this.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock(
      async () => {
        // DB warm-up can await before the transaction starts. Keep the key
        // selected by this check until the write has actually committed.
        await this.assertSyncCredentialUnchanged(syncCredential);
        await this.writeCloudSyncPoolInBatches({
          items: localItems.filter(
            (item) => !foreignAccountsByWireId.has(item.id),
          ),
          // Server data does not need to be uploaded again.
          skipUploadToServer: true,
          ...(captureFreshWalletAvatar
            ? {
                onBeforeWalletServerMerge: (
                  prior: IDBCloudSyncItem,
                  incoming: IDBCloudSyncItem,
                ) => {
                  if (
                    !!activePwdHash &&
                    prior.pwdHash === activePwdHash &&
                    incoming.pwdHash === activePwdHash &&
                    !!incoming.data &&
                    !incoming.isDeleted &&
                    Number.isSafeInteger(prior.dataTime) &&
                    Number.isSafeInteger(incoming.dataTime) &&
                    (prior.dataTime || 0) < (incoming.dataTime || 0)
                  )
                    priorWalletVersions.set(incoming.id, { prior, incoming });
                },
              }
            : {}),
          ...(activePwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX)
            ? { preserveExisting }
            : {}),
          isCurrent,
        });
      },
    );
    console.log('updateLocalItemsByServer success', localItems.length);

    if (shouldSyncToScene && syncCredential) {
      // we need to query from the database again, not use the localSyncItems above, because when updating, the timestamp may not be written if it does not match
      const { records } = await localDb.getRecordsByIds({
        name: ELocalDBStoreNames.CloudSyncItem,
        ids: localItems.map((item) => item.id),
      });
      const items = records.filter(
        (item): item is IDBCloudSyncItem => !!item && !preserveExisting(item),
      );
      // Keep the downloaded versions before scene replay mutates decrypt/ACK
      // fields or a concurrent local restore replaces the persisted records.
      const cleanupSources = items.filter(Boolean).map((item) => ({ ...item }));
      const walletAvatarPredecessors = new Map<string, IDBCloudSyncItem>();
      for (const item of items) {
        const versions = priorWalletVersions.get(item.id);
        if (
          versions &&
          item.dataType === EPrimeCloudSyncDataType.Wallet &&
          item.serverUploaded &&
          !item.isDeleted &&
          item.pwdHash === activePwdHash &&
          item.data === versions.incoming.data &&
          item.dataTime === versions.incoming.dataTime
        )
          walletAvatarPredecessors.set(item.id, versions.prior);
      }
      await this.assertSyncCredentialUnchanged(syncCredential);
      const pushDeferredWalletNames = new Map<string, IDBCloudSyncItem>();
      const observeWalletNameDeferred: IWalletNameDeferredObserver = (
        item,
        reason,
      ) => {
        onWalletNameHistoryDeferred?.(item, reason);
        if (
          item.serverUploaded &&
          item.data &&
          !item.isDeleted &&
          !item.localSceneUpdated &&
          item.pwdHash === activePwdHash
        )
          pushDeferredWalletNames.set(item.id, item);
      };
      // Collisions go through the normal verification and matching scene;
      // their canonical DB rows change only in the Account apply transaction.
      await this.syncToSceneWithLocalSyncItems({
        items: [...items, ...collisionCandidates],
        syncCredential,
        isCurrent,
        ...(foreignAccountsByWireId.size ? { foreignAccountsByWireId } : {}),
        ...(walletAvatarPredecessors.size ? { walletAvatarPredecessors } : {}),
        onWalletNameHistoryDeferred: pushBatchIsCurrent
          ? observeWalletNameDeferred
          : onWalletNameHistoryDeferred,
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
        const keys = deletedItems.map((item) => item.id);
        if (
          tieState &&
          keys.some((id) => tieState.accepted.get(id)?.isDeleted)
        ) {
          const { cleanupCheckedWalletTombstones } =
            await import('./incrementalCloudSync');
          await cleanupCheckedWalletTombstones(
            localDb,
            keys,
            cleanupSources,
            tieState,
          );
        } else {
          await localDb.removeCloudSyncPoolItems({
            keys,
            expectedItems: cleanupSources,
          });
        }
      }
      // A full check reports only after all lists/pages have settled.
      if (tieState) return;
      if (skipLastSyncTime) {
        // Only this caller owns the timestamp. A live Wallet additionally
        // needs the existing durable exact scene ACK, not just downloaded
        // ciphertext: decrypt/target/scene skips may never invoke the observer.
        const incomingById = new Map(localItems.map((item) => [item.id, item]));
        const matchesExact = (
          row: IDBCloudSyncItem,
          incoming?: IDBCloudSyncItem,
        ) =>
          !!activePwdHash &&
          !!incoming &&
          row.pwdHash === activePwdHash &&
          incoming.pwdHash === activePwdHash &&
          row.serverUploaded &&
          !!(row.data || row.isDeleted) &&
          row.data === incoming.data &&
          row.dataTime === incoming.dataTime &&
          row.dataType === incoming.dataType &&
          row.isDeleted === incoming.isDeleted;
        const matched = cleanupSources.filter((row) =>
          matchesExact(row, incomingById.get(row.id)),
        );
        const walletIds: string[] = [];
        for (const row of matched) {
          if (row.dataType !== EPrimeCloudSyncDataType.Wallet || row.isDeleted)
            return true;
          walletIds.push(row.id);
        }
        if (!walletIds.length) return false;
        try {
          const receipt = await resolveBeforeTimeout(
            localDb.getRecordsByIds({
              name: ELocalDBStoreNames.CloudSyncItem,
              ids: walletIds,
            }),
            1500,
          );
          return !!receipt?.records.some(
            (row) =>
              row?.localSceneUpdated &&
              matchesExact(row, incomingById.get(row.id)),
          );
        } catch {
          // A read failure does not undo the response, but can't prove success.
          return false;
        }
      }
      if (pushBatchIsCurrent) {
        if (
          pushBatchIsCurrent() &&
          !(await this.hasDurableDeferredWalletName(pushDeferredWalletNames, {
            syncCredential,
            isCurrent: pushBatchIsCurrent,
          })) &&
          pushBatchIsCurrent()
        )
          await this.updateLastSyncTimeInternal({
            isCurrent: pushBatchIsCurrent,
          });
      } else void this.updateLastSyncTime();
    }
  }

  private async hasDurableDeferredWalletName(
    deferredWalletNames: Map<string, IDBCloudSyncItem>,
    scope?: {
      syncCredential: ICloudSyncCredential;
      isCurrent: () => boolean;
    },
  ) {
    if (!deferredWalletNames.size) return false;
    try {
      const helper = await resolveBeforeTimeout(
        import('./incrementalCloudSync'),
        1500,
      );
      return helper
        ? await helper.probeDurableWalletNameDeferral(
            localDb,
            this.syncManagers.wallet,
            deferredWalletNames,
            scope,
          )
        : true;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return true;
    }
  }

  async writeCloudSyncPoolInBatches({
    items,
    skipUploadToServer,
    skipUpdate,
    preserveExisting,
    onBeforeWalletServerMerge,
    isCurrent,
  }: {
    items: IDBCloudSyncItem[];
    skipUploadToServer: boolean;
    skipUpdate?: boolean;
    onBeforeWalletServerMerge?: (
      prior: IDBCloudSyncItem,
      incoming: IDBCloudSyncItem,
    ) => void;
    preserveExisting?: (
      item: Pick<IDBCloudSyncItem, 'pwdHash' | 'dataType'>,
    ) => boolean;
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
        skipUpdate,
        ...(preserveExisting ? { preserveExisting } : {}),
        ...(onBeforeWalletServerMerge ? { onBeforeWalletServerMerge } : {}),
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
    bypassRetryBackoff,
  }: Omit<IStartServerSyncFlowParams, 'throwError'> = {}) {
    return this.startServerSyncFlowSilently({
      isFlush,
      encryptedSecurityPasswordR1ForServer,
      setUndefinedTimeToNow,
      throwError: true,
      callerName,
      noDebounceUpload,
      forceSync,
      bypassRetryBackoff,
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
  async startServerSyncFlowSilently(
    params: IStartServerSyncFlowParams = {},
  ): Promise<boolean | undefined> {
    return this.startServerSyncFlowSilentlyInternal(params);
  }

  private async startServerSyncFlowSilentlyInternal(
    {
      localMutation,
      isFlush,
      encryptedSecurityPasswordR1ForServer,
      setUndefinedTimeToNow,
      throwError,
      callerName,
      noDebounceUpload,
      forceSync,
      bypassRetryBackoff,
    }: IStartServerSyncFlowParams,
    onManualResult?: (result: IManualCloudSyncResult) => void,
    hardwareRecovery?: IManualHardwareWalletRecovery,
  ): Promise<boolean | undefined> {
    if (localMutation) {
      const pending = {
        generation: this.publicAccountSnapshotImportGeneration,
        keyGeneration:
          this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration(),
        spaceId: undefined as string | undefined,
      };
      this.pendingLocalMutation = pending;
      const credential = await this.getSyncCredentialSafe();
      if (
        pending !== this.pendingLocalMutation ||
        pending.generation !== this.publicAccountSnapshotImportGeneration ||
        pending.keyGeneration !==
          this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration()
      )
        return false;
      pending.spaceId =
        cloudSyncItemBuilder.getPwdHash(credential) || undefined;
    }
    if (this.fullSyncPromise) {
      if (
        bypassRetryBackoff ||
        forceSync ||
        isFlush ||
        encryptedSecurityPasswordR1ForServer ||
        setUndefinedTimeToNow ||
        noDebounceUpload
      ) {
        // An explicit operation cannot borrow the result of an ordinary poll.
        // Re-enter after it settles, preserving serialization and key scope.
        const generation = this.publicAccountSnapshotImportGeneration;
        const keyGeneration =
          this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
        try {
          await this.fullSyncPromise;
        } catch {
          // The preceding caller owns its failure; this request still runs.
        }
        if (
          generation !== this.publicAccountSnapshotImportGeneration ||
          keyGeneration !==
            this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration()
        )
          return false;
        return this.startServerSyncFlowSilentlyInternal(
          {
            isFlush,
            encryptedSecurityPasswordR1ForServer,
            setUndefinedTimeToNow,
            throwError,
            callerName,
            noDebounceUpload,
            forceSync,
            bypassRetryBackoff,
          },
          onManualResult,
          hardwareRecovery,
        );
      }
      this.fullSyncRequested = true;
      return this.fullSyncPromise;
    }
    const generation = this.publicAccountSnapshotImportGeneration;
    const run = Promise.resolve().then(() =>
      generation === this.publicAccountSnapshotImportGeneration
        ? this.startServerSyncFlowWithSelectedKey({
            isFlush,
            encryptedSecurityPasswordR1ForServer,
            setUndefinedTimeToNow,
            throwError,
            callerName,
            noDebounceUpload,
            forceSync,
            bypassRetryBackoff,
            ...(onManualResult ? { onManualResult } : {}),
            hardwareRecovery,
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
      await this.scheduleLocalMutationRetry();
      if (
        requested &&
        generation === this.publicAccountSnapshotImportGeneration
      ) {
        const state = (await primeCloudSyncPersistAtom.get())
          .cloudSyncReconciliation;
        if (state?.unfinished && state.reason !== 'cancelled') {
          this.scheduleReconciliation(
            state.nextRetryAt ?? Date.now() + 1000,
            state.spaceId,
          );
        }
      }
    }
  }

  private async backfillHardwareAccountSnapshots({
    syncCredential,
    isCurrent,
  }: {
    syncCredential: ICloudSyncCredential;
    isCurrent: () => boolean;
  }) {
    const { accounts } = await localDb.getAllAccounts();
    const hardwareAccounts = accounts.filter(({ id }) =>
      accountUtils.isHwAccount({ accountId: id }),
    );
    if (!hardwareAccounts.length || !isCurrent()) return;

    const { devices } = await localDb.getAllDevices();
    if (!isCurrent()) return;
    const items = await this.syncManagers.account.buildInitSyncDBItems({
      dbRecords: hardwareAccounts,
      allDevices: devices,
      // A snapshot rebuilt from local data must lose to an existing Cloud edit.
      initDataTime: PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME,
      syncCredential,
      isCurrent,
    });
    await this.writeCloudSyncPoolInBatches({
      items,
      skipUpdate: true,
      skipUploadToServer: true,
      isCurrent,
    });
  }

  private async filterDivergentPendingWalletNames({
    items,
    credential,
    expectedPwdHash,
    signal,
    isCurrent,
    onTimeout,
    onReadFailure,
    onVerifiedWallet,
  }: {
    items: IDBCloudSyncItem[];
    credential:
      | ICloudSyncCredential
      | undefined
      | (() => Promise<ICloudSyncCredential | undefined>);
    expectedPwdHash?: string;
    signal?: AbortSignal;
    isCurrent: () => boolean;
    onTimeout?: (items: IDBCloudSyncItem[]) => void;
    onReadFailure?: (item: IDBCloudSyncItem) => void;
    onVerifiedWallet?: (
      item: IDBCloudSyncItem,
      wallet: IDBWallet,
      device?: IDBDevice,
    ) => void;
  }): Promise<IDBCloudSyncItem[]> {
    const pwdHash =
      expectedPwdHash ??
      (typeof credential === 'function'
        ? ''
        : cloudSyncItemBuilder.getPwdHash(credential));
    if (!pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX))
      return items;

    const candidates = items.filter(
      (item) =>
        item.dataType === EPrimeCloudSyncDataType.Wallet &&
        !!item.data &&
        !item.isDeleted &&
        !item.serverUploaded &&
        item.pwdHash === pwdHash,
    );
    if (!candidates.length) return items;

    // Keep candidate envelopes unchanged. One deadline covers credential
    // lookup and the whole verification batch, not 1.5s for every row.
    const withheld = new Set(candidates);
    const unchecked = new Set(candidates);
    let timedOut = false;
    let expired = false;
    const canVerify = () => !expired && !signal?.aborted && isCurrent();
    try {
      const completed = await resolveBeforeTimeout(
        (async () => {
          if (!canVerify()) return true;
          const selected =
            typeof credential === 'function' ? await credential() : credential;
          if (
            !selected ||
            !canVerify() ||
            cloudSyncItemBuilder.getPwdHash(selected) !== pwdHash
          )
            return true;
          let index = 0;
          const check = async () => {
            while (index < candidates.length && canVerify()) {
              const item = candidates[index];
              index += 1;
              const verified =
                await this.syncManagers.wallet.canUploadPendingWalletName({
                  item,
                  syncCredential: selected,
                  ...(onReadFailure
                    ? {
                        onReadFailure: () => {
                          if (canVerify()) onReadFailure(item);
                        },
                      }
                    : {}),
                  ...(onVerifiedWallet
                    ? {
                        onVerifiedWallet: (
                          wallet: IDBWallet,
                          device?: IDBDevice,
                        ) => {
                          if (canVerify())
                            onVerifiedWallet(item, wallet, device);
                        },
                      }
                    : {}),
                });
              if (canVerify()) {
                unchecked.delete(item);
                if (verified) withheld.delete(item);
              }
            }
          };
          await Promise.all(
            Array.from({ length: Math.min(8, candidates.length) }, check),
          );
          return true;
        })(),
        1500,
      );
      timedOut = completed === undefined;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
    } finally {
      expired = true;
    }
    if (!isCurrent() || signal?.aborted)
      throw new OneKeyLocalError('Cloud sync was cancelled');
    if (timedOut && unchecked.size) onTimeout?.([...unchecked]);
    return items.filter((item) => !withheld.has(item));
  }

  private async runFullCloudReconciliation({
    forceSync,
    bypassRetryBackoff,
    onManualResult,
    hardwareRecovery,
  }: {
    forceSync?: boolean;
    bypassRetryBackoff?: boolean;
    onManualResult?: (result: IManualCloudSyncResult) => void;
    hardwareRecovery?: IManualHardwareWalletRecovery;
  }) {
    const entryGeneration = this.publicAccountSnapshotImportGeneration;
    const entryKeyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const entryIsCurrent = () =>
      entryGeneration === this.publicAccountSnapshotImportGeneration &&
      entryKeyGeneration ===
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const initialConfig = await primeCloudSyncPersistAtom.get();
    const credential = await this.getSyncCredentialSafe();
    const spaceId = cloudSyncItemBuilder.getPwdHash(credential);
    if (!credential || !spaceId) return false;
    if (await this.backgroundApi.serviceApp.isAppLocked()) return false;
    if (!entryIsCurrent()) return false;
    if (this.cloudSyncNetworkReachable === false)
      onManualResult?.('network-unavailable');
    if (
      this.hasPendingLocalMutation(spaceId) &&
      this.cloudSyncNetworkReachable === false
    )
      return false;
    const config = await primeCloudSyncPersistAtom.get();
    if (!entryIsCurrent()) return false;
    const previous =
      config.cloudSyncReconciliation?.spaceId === spaceId
        ? config.cloudSyncReconciliation
        : undefined;
    if (
      !bypassRetryBackoff &&
      previous?.unfinished &&
      previous.nextRetryAt &&
      previous.nextRetryAt > Date.now()
    ) {
      const nextRetryAt = Math.min(
        previous.nextRetryAt,
        Date.now() + 30 * 60_000,
      );
      if (nextRetryAt !== previous.nextRetryAt || forceSync)
        await primeCloudSyncPersistAtom.set((value) => {
          const state = value.cloudSyncReconciliation;
          if (!entryIsCurrent() || state?.spaceId !== spaceId) return value;
          return {
            ...value,
            cloudSyncReconciliation: {
              ...state,
              nextRetryAt,
              forceSceneReplay: forceSync ? true : state.forceSceneReplay,
            },
          };
        });
      if (!entryIsCurrent()) return false;
      this.scheduleReconciliation(nextRetryAt, spaceId);
      return false;
    }
    // This run will read the current full summary. A later local mutation gets
    // a new marker and survives this run, even when this one reports complete.
    if (this.hasPendingLocalMutation(spaceId)) {
      if (this.localMutationTimer) clearTimeout(this.localMutationTimer);
      this.localMutationTimer = undefined;
      this.pendingLocalMutation = undefined;
    }
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const controller = new AbortController();
    this.reconciliationAbortController = controller;
    const isSourceCurrent = () =>
      generation === this.publicAccountSnapshotImportGeneration &&
      keyGeneration ===
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const isCurrent = () => !controller.signal.aborted && isSourceCurrent();
    const forceSceneReplay =
      forceSync || (previous?.unfinished && previous.forceSceneReplay)
        ? true
        : undefined;
    const baseline: ICloudSyncReconciliationPersistState = {
      version: 1,
      spaceId,
      status: 'running',
      unfinished: true,
      forceSceneReplay,
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
    let checkRequestItems: IDBCloudSyncItem[] = [];
    let activeApply: Promise<{ applied: number }> | undefined;
    let activeUpload: Promise<{ uploaded: number }> | undefined;
    let endpointChanged = false;
    const stopEndpointWatch = devSettingsPersistAtom.sub(() => {
      endpointChanged = true;
    });
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
      await this.backgroundApi.serviceKeylessCloudSync.runWithCloudSyncKeyLock(
        async () => {
          await this.assertSyncCredentialUnchanged(credential);
          if (forceSceneReplay && isCurrent()) {
            await this.backfillHardwareAccountSnapshots({
              syncCredential: credential,
              isCurrent,
            });
          }
          await this.fillingSyncItemsMissingDataFromRawData({
            skipUploadToServer: true,
            isCurrent,
          });
        },
      );
      let transportFailure: IManualCloudSyncResult | undefined;
      let heldDivergentWalletName = false;
      let onlyWalletVerificationDeferred = false;
      let opaqueAccountBlocked = false;
      const deferredWalletNames = new Map<string, IDBCloudSyncItem>();
      const onWalletNameHistoryDeferred = (item: IDBCloudSyncItem) => {
        if (
          item.serverUploaded &&
          item.data &&
          !item.isDeleted &&
          !item.localSceneUpdated &&
          item.pwdHash === spaceId
        )
          deferredWalletNames.set(item.id, item);
      };
      const holds = new Map<string, number>();
      const {
        runCloudSyncReconciliation,
        readReconciliationFullSummary,
        runReconciliationObsoletedUpload,
        getReconciliationManualResult,
        summarizeReconciliationRound,
        runReconciliationApply,
        getReconciliationStampScope,
        pauseReconciliation,
        runReconciliationCheckWithLegacyFallback,
      } = await import('./cloudSyncReconciliation');
      const result = await runCloudSyncReconciliation({
        signal: controller.signal,
        adapter: {
          isCurrent,
          now: () => Date.now(),
          isBoundedCheckVerified: (contract) => contract.version === 1,
          pause: pauseReconciliation,
          getFullSummary: ({ signal }) =>
            readReconciliationFullSummary({
              signal,
              isCurrent,
              spaceId,
              read: () => this.getAllLocalSyncItems(),
              onItems: (items) => {
                latestItems = items;
              },
            }),
          check: async ({ reconciliation, signal, timeoutMs }) => {
            await this.assertSyncCredentialUnchanged(credential);
            checkRequestItems = latestItems.map((item) => ({ ...item }));
            const firstRequest = networkRequests === 0;
            transportFailure = undefined;
            return runReconciliationCheckWithLegacyFallback({
              firstRequest,
              selectedCapability: this.boundedCheckUnsupported
                ? undefined
                : reconciliation,
              signal,
              isCurrent,
              recovery: hardwareRecovery,
              send: (capability, recovery) => {
                networkRequests += 1;
                return this.checkServerStatusWithRequestOptions(
                  { localItems: latestItems, isFullDBChecking: true },
                  {
                    signal,
                    timeout: timeoutMs,
                    hardwareRecovery: recovery,
                    reconciliation: capability,
                  },
                );
              },
              onFallback: () => {
                this.boundedCheckUnsupported = true;
              },
              onFailure: (failure) => {
                transportFailure = failure;
              },
            });
          },
          uploadObsoleted: (input) => {
            const work = runReconciliationObsoletedUpload({
              ...input,
              isCurrent,
              credential,
              spaceId,
              getLatestItems: () => latestItems,
              assertCredential: () =>
                this.assertSyncCredentialUnchanged(credential),
              mutex: this.uploadItemsMutex,
              filter: this.filterDivergentPendingWalletNames.bind(this),
              upload: this._callApiUploadItems,
              onWithheld: () => {
                heldDivergentWalletName = true;
              },
              onFailure: (failure) => {
                transportFailure = failure;
              },
              onDeferred: (onlyDeferred) => {
                onlyWalletVerificationDeferred = onlyDeferred;
              },
            });
            activeUpload = work;
            return work;
          },
          apply: ({ response, signal }) => {
            const work = runReconciliationApply({
              response,
              signal,
              isCurrent,
              latestItems,
              checkRequestItems,
              endpointChanged: () => endpointChanged,
              credential,
              holds,
              spaceId,
              onWalletNameHistoryDeferred,
              service: this,
              walletCheckOrigin: () => this.walletCheckOrigins.get(response),
              readIssues: () => simpleDb.cloudSyncAccountIssues.getRawData(),
              read: async (ids) =>
                (
                  await localDb.getRecordsByIds({
                    name: ELocalDBStoreNames.CloudSyncItem,
                    ids,
                  })
                ).records,
              onReceipt: (receipt) => {
                opaqueAccountBlocked ||= receipt.opaqueAccountBlocked;
              },
            });
            activeApply = work;
            return work;
          },
        },
      });
      // Aborting the runner does not abandon an in-flight transaction.
      // Wait for its cancellation gate before reporting the round complete.
      if (activeApply) await activeApply.catch(() => undefined);
      if (activeUpload) await activeUpload.catch(() => undefined);
      const shouldReplay = isCurrent() && result.status === 'complete';
      const unknownTie = !!holds.size;
      const blockedOnly =
        shouldReplay &&
        !endpointChanged &&
        opaqueAccountBlocked &&
        !result.applied &&
        !result.uploaded;
      let deferredLocalWalletName = heldDivergentWalletName || unknownTie;
      if (shouldReplay && hardwareRecovery) {
        const recovered = await hardwareRecovery
          .apply(controller.signal)
          .catch(() => false);
        deferredLocalWalletName ||= !recovered;
      }
      if (shouldReplay && isCurrent()) {
        await this.syncPendingItemsToScene({
          forceSync:
            forceSceneReplay ||
            !previous ||
            config.cloudSyncAccountApplyVersion !== 2,
          isCurrent,
          onWalletNameHistoryDeferred: (item, reason) => {
            if (reason === 'canonical-read') onWalletNameHistoryDeferred(item);
            else deferredLocalWalletName = true;
          },
        });
        if (isCurrent())
          this.pruneReconciledIncrementalItems(checkRequestItems);
      }
      // Preserve the existing persisted lifecycle; the extra observation
      // only informs this run's manual reply and last-success time.
      const reportOriginalPartial = deferredLocalWalletName;
      if (
        shouldReplay &&
        isCurrent() &&
        !deferredLocalWalletName &&
        deferredWalletNames.size
      ) {
        deferredLocalWalletName =
          await this.hasDurableDeferredWalletName(deferredWalletNames);
      }
      if (!isSourceCurrent()) return false;
      const currentConfig = await primeCloudSyncPersistAtom.get();
      if (
        !isSourceCurrent() ||
        currentConfig.cloudSyncReconciliation?.spaceId !== spaceId
      )
        return false;
      const { state, hasIssues, quietWalletRetry } =
        summarizeReconciliationRound({
          baseline,
          issues: currentConfig.publicAccountSnapshotStatus,
          result,
          onlyWalletVerificationDeferred,
          unknownTie,
          reportOriginalPartial:
            blockedOnly || (!!onManualResult && reportOriginalPartial),
          forceSceneReplay,
          networkRequests,
        });
      let resultSaved = false;
      await primeCloudSyncPersistAtom.set((value) => {
        if (
          !isSourceCurrent() ||
          value.cloudSyncReconciliation?.spaceId !== spaceId
        )
          return value;
        resultSaved = true;
        return {
          ...value,
          cloudSyncReconciliation: state,
          cloudSyncAccountApplyVersion:
            shouldReplay && isCurrent()
              ? 2
              : value.cloudSyncAccountApplyVersion,
        };
      });
      if (!resultSaved || !isSourceCurrent()) return false;
      const publishedConfig = await primeCloudSyncPersistAtom.get();
      if (
        !isSourceCurrent() ||
        publishedConfig.cloudSyncReconciliation?.spaceId !== spaceId
      )
        return false;
      if (
        state.unfinished &&
        state.nextRetryAt &&
        result.status !== 'cancelled'
      )
        this.scheduleReconciliation(state.nextRetryAt, spaceId);
      if (!state.unfinished && !deferredLocalWalletName && !blockedOnly) {
        const stamp = getReconciliationStampScope(
          initialConfig,
          spaceId,
          isCurrent,
        );
        if (stamp) await this.updateLastSyncTimeInternal(stamp);
      }
      if (onManualResult && isSourceCurrent()) {
        onManualResult(
          getReconciliationManualResult({
            result,
            hasLocalIssue: hasIssues || deferredLocalWalletName || blockedOnly,
            quietWalletRetry,
            transportFailure,
          }),
        );
      }
      return state.status === 'complete';
    } catch (error) {
      if (isCurrent()) {
        const failures = baseline.failures + 1;
        const nextRetryAt =
          Date.now() +
          Math.min(30 * 60_000, 30_000 * 2 ** Math.min(failures - 1, 6));
        let failureSaved = false;
        await primeCloudSyncPersistAtom.set((value) => {
          // Source selection can change while awaiting the atom write. Check
          // both generations and the persisted space inside the updater.
          if (
            !isCurrent() ||
            value.cloudSyncReconciliation?.spaceId !== spaceId
          )
            return value;
          failureSaved = true;
          return {
            ...value,
            cloudSyncReconciliation: {
              ...baseline,
              status: 'blocked',
              reason: 'local-processing',
              failures,
              nextRetryAt,
              updatedAt: Date.now(),
            },
          };
        });
        if (failureSaved && isCurrent()) {
          const latest = await primeCloudSyncPersistAtom.get();
          if (
            isCurrent() &&
            latest.cloudSyncReconciliation?.spaceId === spaceId
          )
            this.scheduleReconciliation(nextRetryAt, spaceId);
        }
      }
      throw error;
    } finally {
      stopEndpointWatch();
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
    bypassRetryBackoff,
    onManualResult,
    hardwareRecovery,
  }: IStartServerSyncFlowParams & {
    onManualResult?: (result: IManualCloudSyncResult) => void;
    hardwareRecovery?: IManualHardwareWalletRecovery;
  }) {
    try {
      // const syncMode = await this.getActiveSyncMode();

      if (!(await this.isCloudSyncIsAvailable())) {
        return;
      }
      await this.ensureCloudSyncIsAvailable({
        callerName,
      });

      if (!isFlush)
        return await this.runFullCloudReconciliation({
          forceSync,
          bypassRetryBackoff,
          onManualResult,
          hardwareRecovery,
        });

      // Resolve the shared runner before the legacy flush fills or prunes
      // rows. The immediate entry reuses it without another module load.
      const loadGeneration = this.publicAccountSnapshotImportGeneration;
      const loadKeyGeneration =
        this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
      try {
        await this.getIncrementalCloudSyncRunner();
      } catch (error) {
        if (throwError) throw error;
        errorUtils.autoPrintErrorIgnore(error);
        return false;
      }
      if (
        loadGeneration !== this.publicAccountSnapshotImportGeneration ||
        loadKeyGeneration !==
          this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration()
      )
        return false;

      // when data is written, because the cached password is missing to encrypt, so data is undefined
      await this.fillingSyncItemsMissingDataFromRawData({
        skipUploadToServer: true, // will call server sync flow later
      });

      const generation = this.publicAccountSnapshotImportGeneration;
      const keyless = this.backgroundApi.serviceKeylessCloudSync;
      const keyGeneration = keyless.getCloudAccountImportGeneration();
      const isCurrent = () =>
        generation === this.publicAccountSnapshotImportGeneration &&
        keyGeneration === keyless.getCloudAccountImportGeneration();
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
            console.log('cloudSyncItemsWithDifferentKey', {
              count: totalItemsCount - availableItemsCount,
            });
          }
          const removedItems = allLocalItems.filter(
            (item) =>
              !item.pendingPublicAccountDeletionAt &&
              !item.rawData &&
              !isInactiveHardwareWalletAccount(item, pwdHash) &&
              item.pwdHash &&
              item.pwdHash !== pwdHash,
          );
          if (removedItems.length) {
            const syncMode = await this.getActiveSyncMode();
            const canContinue = await keyless.runWithCloudSyncKeyLock(
              async () => {
                const currentMode = await this.getActiveSyncMode();
                const currentCredential = await this.getSyncCredentialSafe();
                if (
                  !isCurrent() ||
                  currentMode === ECloudSyncMode.None ||
                  currentMode !== syncMode ||
                  !currentCredential ||
                  cloudSyncItemBuilder.getPwdHash(currentCredential) !== pwdHash
                )
                  return false;
                await this.assertSyncCredentialUnchanged(credential);
                await localDb.pruneWrongKeyCloudSyncPoolItems({
                  expectedItems: removedItems,
                  activePwdHash: pwdHash,
                  isCurrent,
                });
                return isCurrent();
              },
            );
            if (!canContinue || !isCurrent()) return false;
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
        expectedSyncCredential: credential,
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
    // The key the caller selected local items with, if it read one earlier.
    expectedSyncCredential?: ICloudSyncCredential;
  }) {
    if (params.isFullDBChecking || params.isFlush || params.noDebounceUpload) {
      // Network requests must not hold the Cloud key lock.
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

  private pruneReconciledIncrementalItems(items: IDBCloudSyncItem[]) {
    if (!this.serverSyncItemsToMerge.size) return;
    for (const item of items) {
      const queued = this.serverSyncItemsToMerge.get(item.id);
      if (
        queued &&
        queued.pwdHash === item.pwdHash &&
        queued.dataType === item.dataType &&
        queued.dataTime === item.dataTime &&
        queued.isDeleted === item.isDeleted &&
        queued.data === item.data &&
        (item.data ||
          (queued.rawKey === item.rawKey && queued.rawData === item.rawData))
      ) {
        this.serverSyncItemsToMerge.delete(item.id);
      }
    }
    if (!this.serverSyncItemsToMerge.size) {
      this.serverSyncSetUndefinedTimeToNow = false;
      this._startServerSyncFlowForItemsDebounced.cancel();
    }
  }

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
    const run = (async () => {
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
            // Preserve the selected identity across requests without holding its lock.
            expectedSyncCredential: credential,
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
        if (isCurrent()) {
          // Use the same durable dirty-record reconciliation and backoff as
          // deletions, including offline and source-switch cancellation.
          this.pendingLocalMutation = {
            generation,
            keyGeneration,
            spaceId: pwdHash,
          };
          await this.scheduleLocalMutationRetry();
        }
        throw error;
      }
    })();
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
      // Failures use the local-mutation reconciliation retry instead.
      if (
        succeeded &&
        consumed &&
        isCurrent() &&
        this.serverSyncItemsToMerge.size
      )
        this._startServerSyncFlowForItemsDebounced();
    }
  }

  private incrementalCloudSyncRunner:
    | typeof import('./incrementalCloudSync').runIncrementalCloudSync
    | undefined;

  private async getIncrementalCloudSyncRunner() {
    if (!this.incrementalCloudSyncRunner) {
      const { runIncrementalCloudSync } =
        await import('./incrementalCloudSync');
      this.incrementalCloudSyncRunner = runIncrementalCloudSync;
    }
    return this.incrementalCloudSyncRunner;
  }

  private async startServerSyncFlowForItemsImmediately(
    params: Parameters<ServicePrimeCloudSync['startServerSyncFlowForItems']>[0],
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
    try {
      guard();
      if (!(await this.isCloudSyncIsAvailable())) return;
      guard();
      await this.ensureCloudSyncIsAvailable();
      guard();
      const runIncrementalCloudSync =
        await this.getIncrementalCloudSyncRunner();
      guard();

      const expectedCredential =
        params.expectedSyncCredential ?? (await this.getSyncCredentialSafe());
      const assertSelectedKey = () =>
        this.assertSyncCredentialUnchanged(expectedCredential);
      await assertSelectedKey();
      await runIncrementalCloudSync({
        service: this,
        params,
        expectedCredential,
        signal: controller.signal,
        isCurrent,
        guard,
        assertSelectedKey,
        uploadItemsWithRequestOptions:
          this.uploadItemsWithRequestOptions.bind(this),
        filterDivergentPendingWalletNames:
          this.filterDivergentPendingWalletNames.bind(this),
        hasDurableDeferredWalletName:
          this.hasDurableDeferredWalletName.bind(this),
        updateLastSyncTime: this.updateLastSyncTimeInternal.bind(this),
      });
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

  async assertSyncCredentialUnchanged(
    expected: ICloudSyncCredential | undefined,
  ) {
    // Only Keyless and hardware keys can be switched under a running sync.
    // OneKey ID credentials may be briefly unavailable after an App lock.
    const expectedCredential = expected?.keylessCredential;
    const expectedKey = expectedCredential?.signingPublicKey;
    const expectedHardware = expectedCredential?.source;
    if (!expectedKey && !expectedHardware) return;
    const selected = await this.getSyncCredentialSafe();
    // No credential at all is a transient read failure, not a different key.
    if (!selected) {
      throw new OneKeyError(
        'Cloud key is temporarily unavailable. Try syncing again.',
      );
    }
    const selectedCredential = selected.keylessCredential;
    const unchanged = expectedHardware
      ? selectedCredential?.source?.credentialId ===
          expectedHardware.credentialId &&
        selectedCredential?.keylessWalletId ===
          expectedCredential.keylessWalletId &&
        selectedCredential?.pwdHash === expectedCredential.pwdHash &&
        selectedCredential?.hardwareSession?.dekId ===
          expectedCredential.hardwareSession?.dekId
      : !selectedCredential?.source &&
        selectedCredential?.signingPublicKey === expectedKey;
    if (!unchanged) {
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_key_selection_changed__msg,
        'The encryption method for Cloud sync changed. Your data will sync with the new one next time.',
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

  invalidateSyncCredentialMemo() {
    this.getSyncCredentialWithCache.clear();
  }

  async clearCachedSyncCredential({
    preservePendingHardwareRefresh,
  }: { preservePendingHardwareRefresh?: boolean } = {}) {
    this.publicAccountSnapshotImportGeneration += 1;
    this.clearLocalMutationRetry();
    this.walletUploadReadRetry = undefined;
    this.clearQueuedHardwareDirectUploads();
    this.reconciliationAbortController?.abort();
    for (const controller of this.cloudSyncItemAbortControllers)
      controller.abort();
    this.clearReconciliationTimer();
    this.invalidateSyncCredentialMemo();
    if (preservePendingHardwareRefresh) {
      this.backgroundApi.serviceKeylessCloudSync.clearKeylessCloudSyncCredentialCache(
        {
          preservePendingHardwareRefresh: true,
        },
      );
    } else {
      this.backgroundApi.serviceKeylessCloudSync.clearKeylessCloudSyncCredentialCache();
    }
  }

  private oneKeyIdCloudSyncToggleOperation = Symbol('OneKey ID sync settings');

  invalidateOneKeyIdCloudSyncToggle() {
    this.oneKeyIdCloudSyncToggleOperation = Symbol('OneKey ID sync settings');
    return this.oneKeyIdCloudSyncToggleOperation;
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
    if (enabled) return false;
    await this.setCloudSyncEnabledWithKeyLock(false, {
      skipClearLocalMasterPassword,
    });
  }

  async setCloudSyncEnabledWithKeyLock(
    enabled: boolean,
    {
      skipClearLocalMasterPassword,
      operation,
    }: { skipClearLocalMasterPassword?: boolean; operation?: symbol } = {},
  ): Promise<boolean> {
    // The legacy mode can be turned off or migrated, but cannot be enabled.
    // Deny before clearing credentials or mutating shared settings.
    if (enabled) return false;
    const currentOperation =
      operation ?? this.invalidateOneKeyIdCloudSyncToggle();
    if (currentOperation !== this.oneKeyIdCloudSyncToggleOperation)
      return false;
    if (!skipClearLocalMasterPassword) {
      await this.backgroundApi.serviceMasterPassword.clearLocalMasterPassword({
        skipDisableCloudSync: true,
      });
    }
    const superseded = new OneKeyLocalError({
      message: 'Cloud sync setting change was superseded',
      autoToast: false,
    });
    try {
      await primeCloudSyncPersistAtom.set((value) => {
        // Returning the same value on a persisted atom can still write it.
        // Abort the updater instead of publishing this runtime's old value.
        if (currentOperation !== this.oneKeyIdCloudSyncToggleOperation)
          throw superseded;
        return {
          ...value,
          isCloudSyncEnabled: false,
          hasEverEnabledOneKeyIdSync:
            value.hasEverEnabledOneKeyIdSync || value.isCloudSyncEnabled,
        };
      });
    } catch (error) {
      if (error === superseded) return false;
      throw error;
    }
    await this.clearCachedSyncCredential();
    return true;
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
    // Drop a hardware key left behind while sync is off without waiting for
    // the daily sweep. A key in use stays.
    await this.backgroundApi.serviceKeylessCloudSync
      .sweepHardwareCloudKeyIfSyncOff()
      .catch(() => false);
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
    if (enabled) return false;
    const operation = this.invalidateOneKeyIdCloudSyncToggle();
    try {
      return await this.setCloudSyncEnabledWithKeyLock(false, { operation });
    } finally {
      if (operation === this.oneKeyIdCloudSyncToggleOperation) {
        void this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();
      }
    }
  }

  @backgroundMethod()
  async syncNowKeyless(params: ISyncNowKeylessParams = {}): Promise<boolean> {
    return (await this.syncNowKeylessInternal(params)) === 'completed';
  }

  // This explicit request never borrows another caller's result. Existing
  // consumers of syncNowKeyless retain their boolean contract.
  private explicitHardwareSyncNow?: {
    generation: number;
    keyGeneration: number;
    promise: Promise<IManualCloudSyncResult>;
  };

  @backgroundMethod()
  @toastIfError()
  async syncNowKeylessWithResult(
    params: ISyncNowKeylessParams = {},
  ): Promise<IManualCloudSyncResult> {
    if (!params.askPasswordOnlyIfHdXfpMissing)
      return this.syncNowKeylessInternal(params, true);
    const generation = this.publicAccountSnapshotImportGeneration;
    const keyGeneration =
      this.backgroundApi.serviceKeylessCloudSync.getCloudAccountImportGeneration();
    const pending = this.explicitHardwareSyncNow;
    if (
      pending?.generation === generation &&
      pending.keyGeneration === keyGeneration
    )
      return pending.promise;
    const promise = this.syncNowKeylessInternal(params, true);
    this.explicitHardwareSyncNow = { generation, keyGeneration, promise };
    try {
      return await promise;
    } finally {
      if (this.explicitHardwareSyncNow?.promise === promise)
        this.explicitHardwareSyncNow = undefined;
    }
  }

  private async syncNowKeylessInternal(
    {
      callerName = 'Manual Cloud Sync Keyless',
      noDebounceUpload = true,
      forceSync,
      bypassRetryBackoff,
      password,
      askPasswordOnlyIfHdXfpMissing,
    }: ISyncNowKeylessParams,
    withManualResult = false,
  ): Promise<IManualCloudSyncResult> {
    const entryGeneration = this.publicAccountSnapshotImportGeneration;
    const keyless = this.backgroundApi.serviceKeylessCloudSync;
    const entryKeyGeneration = withManualResult
      ? keyless.getCloudAccountImportGeneration()
      : undefined;
    const isSelected = () =>
      !withManualResult ||
      (entryGeneration === this.publicAccountSnapshotImportGeneration &&
        entryKeyGeneration === keyless.getCloudAccountImportGeneration());
    const selection = await primeCloudSyncPersistAtom.get();
    const { isCloudSyncEnabledKeyless } = selection;
    if (!isSelected()) return 'cancelled';
    if (!isCloudSyncEnabledKeyless) {
      // Hardware setup may temporarily persist false while committing a key.
      return withManualResult &&
        isCloudSyncEnabledKeyless === false &&
        keyless.isKeylessSyncOffStateSettled()
        ? 'sync-disabled'
        : 'incomplete';
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
    if (!isSelected()) return 'cancelled';
    if (!syncCredential) {
      if (
        !withManualResult ||
        !(
          selection.hardwareCloudSyncKeySource ||
          selection.currentCloudSyncKeylessWalletId
        )
      )
        return 'incomplete';
      if (await this.backgroundApi.serviceApp.isAppLocked())
        return 'incomplete';
      if (!isSelected()) return 'cancelled';
      return selection.hardwareCloudSyncKeySource
        ? 'hardware-key-unavailable'
        : 'software-key-unavailable';
    }
    const hardware = syncCredential.keylessCredential;
    // Protect the old ciphertext during local initialization even when the
    // optional network recovery cannot prove its endpoint or is unsupported.
    const preserveInactiveWallets =
      hardware?.source?.type === 'hardware' &&
      !!hardware.hardwareSession &&
      selection.hardwareCloudSyncKeySource?.credentialId ===
        hardware.keylessWalletId;
    const manualHardwareRecovery =
      withManualResult &&
      preserveInactiveWallets &&
      askPasswordOnlyIfHdXfpMissing &&
      hardware.hardwareSession?.boundBaseURLVerified === true &&
      !!hardware.hardwareSession.boundBaseURL?.startsWith('https://');
    let hardwareRecovery: IManualHardwareWalletRecovery | undefined;
    try {
      // Ask before taking the key lock; never hold it while a prompt is open.
      try {
        const initPassword = askPasswordOnlyIfHdXfpMissing
          ? await this.resolvePasswordOnlyIfHdXfpMissing(password)
          : await this.resolveInitLocalSyncItemsPassword(password);
        if (!isSelected()) return 'cancelled';
        await this.prepareLocalSyncWallets({
          password: initPassword,
          askPasswordOnlyIfHdXfpMissing,
        });
        if (!isSelected()) return 'cancelled';
        if (manualHardwareRecovery) {
          let preparing = true;
          const work = (async () => {
            const helper =
              await import('../ServiceKeylessCloudSync/hardwareCloudSyncRecovery');
            if (
              !preparing ||
              !isSelected() ||
              !helper.supportsManualHardwareWalletRecoveryTransport()
            )
              return undefined;
            const plan = await helper.prepareManualHardwareWalletRecovery(
              keyless,
              hardware,
              () => preparing && isSelected(),
            );
            if (!preparing) {
              plan?.dispose();
              return undefined;
            }
            return plan;
          })();
          hardwareRecovery = await resolveBeforeTimeout(work, 550).catch(
            () => undefined,
          );
          if (!hardwareRecovery) preparing = false;
        }
        await keyless.runWithCloudSyncKeyLock(async () => {
          if (!isSelected()) return;
          await this.assertSyncCredentialUnchanged(syncCredential);
          if (!isSelected()) return;
          await this.initLocalSyncItemsDB({
            skipWalletPreparation: true,
            syncCredential,
            password: initPassword,
            askPasswordOnlyIfHdXfpMissing,
            preserveInactiveWallets,
          });
        });
      } catch (error) {
        if (!isSelected()) return 'cancelled';
        throw error;
      }
      if (!isSelected()) return 'cancelled';
      const options = {
        callerName,
        noDebounceUpload,
        forceSync,
        bypassRetryBackoff,
      };
      if (!withManualResult)
        return (await this.startServerSyncFlow(options)) === true
          ? 'completed'
          : 'incomplete';

      let result: IManualCloudSyncResult | undefined;
      const completed = await this.startServerSyncFlowSilentlyInternal(
        {
          ...options,
          forceSync: true,
          noDebounceUpload: true,
          throwError: true,
        },
        (outcome) => {
          result = outcome;
        },
        hardwareRecovery,
      );
      if (!isSelected()) return 'cancelled';
      return result ?? (completed === true ? 'completed' : 'incomplete');
    } finally {
      hardwareRecovery?.dispose();
    }
  }

  @backgroundMethod()
  async updateLastSyncTime({
    syncMode,
  }: {
    syncMode?: ECloudSyncMode;
  } = {}) {
    await this.updateLastSyncTimeInternal({ syncMode });
  }

  private async updateLastSyncTimeInternal({
    syncMode,
    isCurrent,
  }: {
    syncMode?: ECloudSyncMode;
    isCurrent?: (value: IPrimeCloudSyncPersistAtomData) => boolean;
  }) {
    if (
      (await primeCloudSyncPersistAtom.get()).cloudSyncReconciliation
        ?.unfinished
    )
      return;
    const activeSyncMode = syncMode ?? (await this.getActiveSyncMode());
    const now = Date.now();
    await primeCloudSyncPersistAtom.set((v): IPrimeCloudSyncPersistAtomData => {
      if (isCurrent && (!isCurrent(v) || v.cloudSyncReconciliation?.unfinished))
        return v;
      return {
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
      };
    });
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
    // A hardware Cloud key's flush is a key reset, not a OneKey ID master
    // password change: a stale master password UUID must not raise its alert.
    const config = await primeCloudSyncPersistAtom.get();
    if (config.isCloudSyncEnabledKeyless && config.hardwareCloudSyncKeySource) {
      await this.backgroundApi.serviceKeylessCloudSync.onHardwareKeyFlushPush({
        pwdHash: payload.pwdHash,
      });
      return;
    }
    // The master password only applies to OneKey ID sync. A Keyless flush, or
    // one arriving with sync off, must not reach the OneKey ID alert through a
    // master password UUID left from earlier.
    if ((await this.getActiveSyncMode()) !== ECloudSyncMode.OnekeyId) return;
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

  // Lets callers prompt before entering the Cloud key lock.
  async resolveInitLocalSyncItemsPassword(password?: string): Promise<string> {
    if (password) return password;
    const result =
      await this.backgroundApi.servicePassword.promptPasswordVerify({
        reason: ALWAYS_VERIFY_PASSCODE_WHEN_CHANGE_SET_MASTER_PASSWORD
          ? EReasonForNeedPassword.Security
          : undefined,
      });
    return result.password;
  }

  // For turning on sync with hardware and its Sync now only: the hardware key
  // is not stored under the App password, which is then needed only to fill
  // HD wallets' missing hash or xfp before sync items are built.
  async resolvePasswordOnlyIfHdXfpMissing(
    password?: string,
  ): Promise<string | undefined> {
    if (password) return password;
    if (
      !(await this.backgroundApi.serviceAccount.hasHdWalletsMissingHashOrXfp())
    ) {
      return undefined;
    }
    return this.resolveInitLocalSyncItemsPassword();
  }

  // Duplicate-wallet merging can create accounts and therefore acquires the
  // Cloud key mutex itself. Run this stage before taking that non-reentrant
  // mutex; callers revalidate the credential before building the sync pool.
  async prepareLocalSyncWallets({
    password,
    askPasswordOnlyIfHdXfpMissing,
  }: {
    password?: string;
    askPasswordOnlyIfHdXfpMissing?: boolean;
  }) {
    const resolvedPassword = askPasswordOnlyIfHdXfpMissing
      ? password
      : await this.resolveInitLocalSyncItemsPassword(password);

    if (resolvedPassword) {
      await this.backgroundApi.serviceAccount.generateAllHdAndQrWalletsHashAndXfp(
        {
          password: resolvedPassword,
        },
      );

      await this.backgroundApi.serviceAccount.mergeDuplicateHDWallets({
        password: resolvedPassword,
      });
    } else {
      // Only HD wallets need the password; QR wallets still get their xfp.
      await this.backgroundApi.serviceAccount.generateAllQrWalletsMissingXfp();
    }
  }

  async buildHardwareRestoreWalletAccountItems(
    syncCredential: ICloudSyncCredential,
    opaqueCopies: readonly IDBCloudSyncItem[],
  ): Promise<IDBCloudSyncItem[]> {
    const walletKeys = new Map<string, string>();
    const accountItems: IDBCloudSyncItem[] = [];
    for (const item of opaqueCopies) {
      if (item.dataType === EPrimeCloudSyncDataType.Wallet) {
        walletKeys.set(item.id, item.rawKey);
      } else if (item.dataType === EPrimeCloudSyncDataType.Account) {
        accountItems.push(item);
      }
    }
    const buildWallets = async () => {
      if (!walletKeys.size) return [];
      const { wallets, allDevices } =
        await this.backgroundApi.serviceAccount.getAllWallets({});
      return this.syncManagers.wallet.buildInitSyncDBItems({
        dbRecords: wallets,
        allDevices,
        syncCredential,
        initDataTime: undefined,
        requiredSyncItems: walletKeys,
      });
    };
    const [wallets, accounts] = await Promise.all([
      buildWallets(),
      accountItems.length
        ? this.syncManagers.account.buildHardwareRestoreLegacyAccountItems({
            items: accountItems,
            syncCredential,
          })
        : [],
    ]);
    return [...wallets, ...accounts];
  }

  @backgroundMethod()
  async initLocalSyncItemsDB({
    syncCredential,
    password,
    askPasswordOnlyIfHdXfpMissing,
    onlyAddMissing,
    skipWalletPreparation,
    preserveInactiveWallets,
  }: {
    syncCredential: ICloudSyncCredential;
    password?: string;
    // Set with a password already from resolvePasswordOnlyIfHdXfpMissing, so
    // a missing one is never prompted here.
    askPasswordOnlyIfHdXfpMissing?: boolean;
    onlyAddMissing?: boolean;
    preserveInactiveWallets?: boolean;
    // Only for callers that completed prepareLocalSyncWallets before locking.
    skipWalletPreparation?: boolean;
  }) {
    if (!skipWalletPreparation) {
      await this.prepareLocalSyncWallets({
        password,
        askPasswordOnlyIfHdXfpMissing,
      });
    }

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
    // Activation temporarily disables sync. Scope records by the credential
    // being initialized even while the persisted mode is None.
    const credentialKeylessWalletId =
      syncCredential.keylessCredential?.keylessWalletId;
    if (
      credentialKeylessWalletId ||
      (await this.getActiveSyncMode()) === ECloudSyncMode.Keyless
    ) {
      const currentKeylessWalletId =
        credentialKeylessWalletId ??
        (await this.getCurrentCloudSyncKeylessWalletId());
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
      // Recovery already retained existing business versions and tombstones.
      // Check existence in the write transaction, including concurrent inserts.
      skipUpdate: onlyAddMissing,
      ...(preserveInactiveWallets
        ? {
            preserveExisting: (row) =>
              row.dataType === EPrimeCloudSyncDataType.Wallet &&
              isInactiveHardwareWalletAccount(
                row,
                cloudSyncItemBuilder.getPwdHash(syncCredential),
              ),
          }
        : {}),
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

  private async resolvePendingPublicAccountDeletion(
    item: IDBCloudSyncItem,
    syncCredential: ICloudSyncCredential,
    dataTime: number,
  ) {
    const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
      item: { ...item },
      syncCredential,
    });
    const { rawKey, snapshot } =
      normalizePublicAccountSnapshotRecord(rawDataJson);
    if (
      !item.data ||
      item.dataType !== EPrimeCloudSyncDataType.Account ||
      this.syncManagers.account.rawKeyToHashKey(rawKey) !== item.id ||
      getPublicAccountSnapshotIdentityHash(snapshot) !==
        item.pendingPublicAccountDeletionHash
    )
      throw new OneKeyLocalError('Invalid public account sync identity');

    // The tombstone uses the authenticated snapshot's ciphertext. Its version
    // is the time of local removal, even if this key came back much later.
    return rememberPublicAccountSnapshotWrite(
      {
        ...item,
        rawKey,
        rawData: '',
        dataTime,
        isDeleted: true,
        localSceneUpdated: true,
        serverUploaded: false,
        pendingPublicAccountDeletionAt: undefined,
        pendingPublicAccountDeletionHash: undefined,
      },
      item,
    );
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
      // Legacy keyless Lock metadata is never uploaded or applied to scenes.
      // Preserve it without rebuilding it under the currently selected key.
      if (
        item.dataType === EPrimeCloudSyncDataType.Lock &&
        keylessCloudSyncUtils.isKeylessPwdHash(item.pwdHash)
      ) {
        continue;
      }
      if (isInactiveHardwareWalletAccount(item, currentPwdHash)) {
        continue;
      }
      if (item.pendingPublicAccountDeletionAt) {
        if (item.pwdHash && item.pwdHash === currentPwdHash) {
          try {
            itemsToUpdate.push(
              await this.resolvePendingPublicAccountDeletion(
                item,
                syncCredential,
                item.pendingPublicAccountDeletionAt,
              ),
            );
            issueUpdates.push({ id: item.id });
          } catch (error) {
            issueUpdates.push({
              id: item.id,
              issue:
                error instanceof PublicAccountSnapshotUnsupportedError
                  ? 'needsUpdate'
                  : 'rejected',
            });
          }
        }
        continue;
      }
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
              if (
                item.data ||
                item.dataType !== EPrimeCloudSyncDataType.Account ||
                item.remoteHardwareAccountTombstoneProof !== undefined
              )
                continue;
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
              if (
                !rememberOfflinePublicAccountSnapshotFill(
                  rebuilt,
                  item,
                  snapshot,
                  currentPwdHash,
                )
              )
                continue;
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
    // Keep the background RPC callable for existing clients, but never
    // start legacy activation, including password or local-pool preparation.
    return { success: false };
  }

  async getAllLocalSyncItems({
    includeUnsupportedDataTypes = false,
  }: {
    includeUnsupportedDataTypes?: boolean;
  } = {}) {
    const { syncItems } = await localDb.getAllSyncItems();
    // Preserve unknown records already stored by older clients, but keep them
    // out of business sync and uploads. Key safety checks need the full view.
    return {
      items: includeUnsupportedDataTypes
        ? syncItems
        : syncItems.filter((item) =>
            isSupportedCloudSyncDataType(item.dataType),
          ),
    };
  }

  @backgroundMethod()
  @toastIfError()
  async decryptAllLocalSyncItems() {
    const syncCredential = await this.getSyncCredentialSafe();
    const { items } = await this.getAllLocalSyncItems();
    const result: IDBCloudSyncItem[] = [];
    let failedCount = 0;
    for (const item of items) {
      try {
        const decryptedData = await cloudSyncItemBuilder.decryptSyncItem({
          item,
          syncCredential,
        });
        result.push(decryptedData.dbItem || item);
      } catch {
        result.push(item);
        failedCount += 1;
      }
    }
    console.log('decryptAllLocalSyncItems', {
      count: items.length,
      failedCount,
    });
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
    if (
      localItem.pendingPublicAccountDeletionAt ||
      (localItem.dataType === EPrimeCloudSyncDataType.Lock &&
        keylessCloudSyncUtils.isKeylessPwdHash(localItem.pwdHash))
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
    const debug = await import('./incrementalCloudSync');
    return debug.downloadCloudDebugRows(this, includeDeleted);
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

  private async updateDemoSyncItems(
    updater: ILocalDBRecordUpdater<ELocalDBStoreNames.CloudSyncItem>,
  ) {
    const demo = await import('./incrementalCloudSync');
    await demo.updateDemoSyncItems(localDb, updater);
  }

  @backgroundMethodForDev()
  async demoClearSyncItemPwdHash() {
    await this.updateDemoSyncItems((record) => {
      record.pwdHash = '';
      return record;
    });
  }

  @backgroundMethodForDev()
  async demoTamperingLocalSyncItemData() {
    await this.updateDemoSyncItems((record) => {
      record.data = '999999';
      record.localSceneUpdated = false;
      return record;
    });
  }

  @backgroundMethodForDev()
  async demoTamperingLocalSyncItemDataTime() {
    await this.updateDemoSyncItems((record) => {
      record.dataTime = 2_000_000_000_000;
      return record;
    });
  }
}

export default ServicePrimeCloudSync;
