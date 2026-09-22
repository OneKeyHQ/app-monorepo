import { isAxiosError } from 'axios';
import { isNaN, isNil, isNumber, throttle } from 'lodash';

import { EServiceEndpointEnum } from '../../types/endpoint';
import { appApiClient } from '../appApiClient/appApiClient';
import { ONEKEY_HEALTH_CHECK_URL } from '../config/appConfig';
import { getEndpointByServiceName } from '../config/endpointsMap';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';
import requestHelper from '../request/requestHelper';
import appStorage from '../storage/appStorage';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import timerUtils from './timerUtils';

import type { IAxiosResponse } from '../appApiClient/appApiClient';
import type {
  ISystemTimeCheckSource,
  ISystemTimeRefreshResult,
} from '../logger/scopes/app/scenes/systemTime';

export enum ELocalSystemTimeStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNKNOWN = 'UNKNOWN',
}

export enum ECloudSyncDataTimeSource {
  Estimated = 'estimated',
  TrustedLocal = 'trusted-local',
  LocalFallback = 'local-fallback',
  LastServer = 'last-server',
  AppBuild = 'app-build',
}

export type ICloudSyncCorrectedTime = {
  time: number;
  source: ECloudSyncDataTimeSource;
};

// const mockServerTime: number | undefined = 1_947_829_622_691;
const mockServerTime: number | undefined = undefined;

// const mockLocalTimeOffset: number | undefined = 1000 * 60 * 60 * 24 * 30;
const mockLocalTimeOffset: number | undefined = undefined;

const appBuildTime = Math.max(
  Number(process.env.BUILD_TIME) || 0,
  1_747_527_766_656,
);

const intervalTimeout = timerUtils.getTimeDurationMs({
  // seconds: 5,
  minute: 5,
});
const refreshServerTimeTimeout = timerUtils.getTimeDurationMs({
  seconds: 5,
});
const localServerTimeDiff = timerUtils.getTimeDurationMs({
  // OK-55438: tightened 30m -> 10m. Cross-device LWW ordering for cloud sync
  // needs a tighter local-clock trust window than display/expiry logic: within
  // this window getTimeNow() returns the raw local clock unmodified, so too
  // loose a window lets a fast clock leak future dataTime into sync items.
  minute: 10,
});
const lastValidServerTimeStorageKey =
  EAppSyncStorageKeys.last_valid_server_time;
const lastValidLocalTimeStorageKey = EAppSyncStorageKeys.last_valid_local_time;

function isTimeValid({ time }: { time: number | undefined }): boolean {
  if (
    !time ||
    isNil(time) ||
    isNaN(time) ||
    !isNumber(time) ||
    time < appBuildTime
  ) {
    return false;
  }
  return true;
}

function getMonotonicTimeNow(): number | undefined {
  const time = globalThis.performance?.now?.();
  if (!isNumber(time) || isNaN(time) || isNil(time)) {
    return undefined;
  }
  return time;
}

function normalizeTimestamp(time: number | undefined): number | undefined {
  if (!isNumber(time) || isNaN(time) || isNil(time)) {
    return undefined;
  }
  return Math.floor(time);
}

function getPersistedTimeValue(key: EAppSyncStorageKeys): number | undefined {
  if (platformEnv.isDesktop) {
    try {
      const value = globalThis.localStorage?.getItem(key);
      if (!value) {
        return undefined;
      }
      const timestamp = Number(value);
      return Number.isFinite(timestamp) ? timestamp : undefined;
    } catch (_error) {
      return undefined;
    }
  }
  return appStorage.syncStorage.getNumber(key);
}

class SystemTimeUtils {
  constructor() {
    const lastServerTimeInStorage = getPersistedTimeValue(
      lastValidServerTimeStorageKey,
    );
    this.setLastServerTimeValue({
      value: lastServerTimeInStorage,
      updateEstimateBaseline: false,
      persist: false,
    });
    const lastLocalTimeInStorage = getPersistedTimeValue(
      lastValidLocalTimeStorageKey,
    );
    this.setLastLocalTimeValue({
      value: lastLocalTimeInStorage,
      persist: false,
    });
  }

  systemTimeStatus: ELocalSystemTimeStatus = ELocalSystemTimeStatus.UNKNOWN;

  private _lastServerTime: number | undefined;

  private _serverTimeEstimateBase: number | undefined;

  private _lastServerTimePerfBase: number | undefined;

  private _lastServerTimeLocalBase: number | undefined;

  private _lastTimeCheckLogAt: Partial<Record<ELocalSystemTimeStatus, number>> =
    {};

  private _lastLoggedTimeCheckStatus: ELocalSystemTimeStatus | undefined;

  private _suppressedTimeCheckLogs = 0;

  private _lastRefreshFailureLogAt: number | undefined;

  private _suppressedRefreshFailureLogs = 0;

  private _lastServerTimeIsReal = false;

  private _lastServerTimeCanBeFallback = false;

  private _refreshServerTimePromise: Promise<boolean> | undefined;

  get lastServerTime(): number | undefined {
    return this._lastServerTime;
  }

  private setLastServerTimeValue({
    value,
    updateEstimateBaseline,
    persist,
  }: {
    value: number | undefined;
    updateEstimateBaseline: boolean;
    persist: boolean;
  }) {
    const timestamp = normalizeTimestamp(value);
    if (!this.isTimeValid({ time: timestamp })) {
      this._lastServerTime = appBuildTime;
      this._serverTimeEstimateBase = undefined;
      this._lastServerTimePerfBase = undefined;
      this._lastServerTimeLocalBase = undefined;
      this._lastServerTimeIsReal = false;
      this._lastServerTimeCanBeFallback = false;
      return;
    }
    this._lastServerTime = timestamp;
    this._lastServerTimeCanBeFallback = true;
    if (updateEstimateBaseline) {
      this._serverTimeEstimateBase = timestamp;
      this._lastServerTimePerfBase = getMonotonicTimeNow();
      this._lastServerTimeLocalBase = Date.now();
      this._lastServerTimeIsReal = true;
    }
    if (timestamp && persist) {
      this.persistTimeValue({
        key: lastValidServerTimeStorageKey,
        value: timestamp,
      });
    }
  }

  set lastServerTime(value: number | undefined) {
    this.setLastServerTimeValue({
      value,
      updateEstimateBaseline: false,
      persist: false,
    });
  }

  private _lastLocalTime: number | undefined;

  get lastLocalTime(): number | undefined {
    return this._lastLocalTime;
  }

  private setLastLocalTimeValue({
    value,
    persist,
  }: {
    value: number | undefined;
    persist: boolean;
  }) {
    const timestamp = normalizeTimestamp(value);
    if (!this.isTimeValid({ time: timestamp })) {
      this._lastLocalTime = appBuildTime;
      return;
    }
    this._lastLocalTime = timestamp;

    if (timestamp && persist) {
      this.persistTimeValue({
        key: lastValidLocalTimeStorageKey,
        value: timestamp,
      });
    }
  }

  set lastLocalTime(value: number | undefined) {
    this.setLastLocalTimeValue({
      value,
      persist: true,
    });
  }

  _serverTimeInterval: ReturnType<typeof setInterval> | undefined;

  private persistTimeValue({
    key,
    value,
  }: {
    key: EAppSyncStorageKeys;
    value: number;
  }) {
    try {
      if (platformEnv.isDesktop) {
        // Desktop syncStorage uses sendSync; keep this best-effort cache local
        // to the renderer so server responses cannot block on the main process.
        globalThis.localStorage?.setItem(key, String(value));
        return;
      }
      void appStorage.syncStorage.set(key, value);
    } catch (_error) {
      // Cache persistence is best-effort and should not affect time checks.
    }
  }

  private setSystemTimeStatus(status: ELocalSystemTimeStatus) {
    if (this.systemTimeStatus === status) {
      return;
    }
    this.systemTimeStatus = status;
    appEventBus.emit(EAppEventBusNames.LocalSystemTimeStatusChanged, {
      status,
    });
  }

  private logTimeCheck({
    source,
    responseHost,
    requestId,
    localTime,
    serverTime,
    localTimeValid,
  }: {
    source: ISystemTimeCheckSource;
    responseHost?: string;
    requestId?: string;
    localTime: number;
    serverTime: number | undefined;
    localTimeValid: boolean;
  }) {
    // Healthy checks are silent unless an emitted anomaly still needs a recovery.
    if (
      localTimeValid &&
      this._lastLoggedTimeCheckStatus !== ELocalSystemTimeStatus.INVALID
    ) {
      return;
    }
    const status = localTimeValid
      ? ELocalSystemTimeStatus.VALID
      : ELocalSystemTimeStatus.INVALID;
    const observedAt = Date.now();
    const monotonicTime = getMonotonicTimeNow();
    const logTime = monotonicTime ?? observedAt;
    const lastLogAt = this._lastTimeCheckLogAt[status];
    if (
      !isNil(lastLogAt) &&
      logTime >= lastLogAt &&
      logTime - lastLogAt < 60_000
    ) {
      this._suppressedTimeCheckLogs += 1;
      return;
    }
    // Separate budgets retain the first recovery without letting flapping bypass
    // the limit: at most one invalid sample and one recovery sample per minute.
    this._lastTimeCheckLogAt[status] = logTime;
    this._lastLoggedTimeCheckStatus = status;

    const wallElapsedMs = isNil(this._lastServerTimeLocalBase)
      ? undefined
      : observedAt - this._lastServerTimeLocalBase;
    const monotonicElapsedMs =
      isNil(monotonicTime) || isNil(this._lastServerTimePerfBase)
        ? undefined
        : monotonicTime - this._lastServerTimePerfBase;
    // Capture the previous baseline before a response replaces it, so sleep
    // and wall-clock jumps can be distinguished from a stale server response.
    defaultLogger.app.systemTime.check({
      observedAt,
      platform: platformEnv.appPlatform,
      runtime: platformEnv.runtimeRole,
      source,
      responseHost,
      requestId,
      previousStatus: this.systemTimeStatus,
      status,
      suppressedCount: this._suppressedTimeCheckLogs,
      localTime,
      serverTime,
      differenceMs: isNil(serverTime) ? undefined : localTime - serverTime,
      thresholdMs: localServerTimeDiff,
      appBuildTime,
      lastServerTime: this.lastServerTime,
      estimateBase: this._serverTimeEstimateBase,
      localTimeAtBaseline: this._lastServerTimeLocalBase,
      monotonicTime,
      monotonicTimeAtBaseline: this._lastServerTimePerfBase,
      wallElapsedMs,
      monotonicElapsedMs,
      clockElapsedDifferenceMs:
        isNil(wallElapsedMs) || isNil(monotonicElapsedMs)
          ? undefined
          : wallElapsedMs - monotonicElapsedMs,
    });
    this._suppressedTimeCheckLogs = 0;
  }

  hasFreshServerTimeInCurrentProcess(): boolean {
    return (
      this._lastServerTimeIsReal &&
      this.isTimeValid({ time: this.lastServerTime })
    );
  }

  async ensureFreshServerTime(): Promise<boolean> {
    if (this.hasFreshServerTimeInCurrentProcess()) {
      return true;
    }

    this._refreshServerTimePromise ??= this.refreshServerTime().finally(() => {
      this._refreshServerTimePromise = undefined;
    });
    return this._refreshServerTimePromise;
  }

  async refreshServerTime(): Promise<boolean> {
    const startedAt = Date.now();
    const monotonicStartedAt = getMonotonicTimeNow();
    let httpStatus: number | undefined;
    let serverTime: number | undefined;
    let requestId: string | undefined;
    const logResult = (
      result: ISystemTimeRefreshResult,
      errorCode?: string,
    ) => {
      const completedAt = Date.now();
      const monotonicCompletedAt = getMonotonicTimeNow();
      const logTime = monotonicCompletedAt ?? completedAt;
      if (
        !isNil(this._lastRefreshFailureLogAt) &&
        logTime >= this._lastRefreshFailureLogAt &&
        logTime - this._lastRefreshFailureLogAt < 60_000
      ) {
        this._suppressedRefreshFailureLogs += 1;
        return;
      }
      this._lastRefreshFailureLogAt = logTime;
      defaultLogger.app.systemTime.refresh({
        startedAt,
        completedAt,
        platform: platformEnv.appPlatform,
        runtime: platformEnv.runtimeRole,
        result,
        suppressedCount: this._suppressedRefreshFailureLogs,
        wallDurationMs: completedAt - startedAt,
        monotonicDurationMs:
          isNil(monotonicStartedAt) || isNil(monotonicCompletedAt)
            ? undefined
            : monotonicCompletedAt - monotonicStartedAt,
        serverTime,
        httpStatus,
        requestId,
        errorCode,
      });
      this._suppressedRefreshFailureLogs = 0;
    };

    try {
      const endpoint = await getEndpointByServiceName(
        EServiceEndpointEnum.Wallet,
      );
      const client = await appApiClient.getClient({
        endpoint,
        name: EServiceEndpointEnum.Wallet,
      });
      const response = await client.get<unknown, IAxiosResponse<unknown>>(
        ONEKEY_HEALTH_CHECK_URL,
        {
          params: {
            _: 'system_time_utils',
            timestamp: Date.now(),
          },
          timeout: refreshServerTimeTimeout,
        },
      );
      httpStatus = response.status;
      requestId = response.$requestId;
      const headers = response.headers as
        | {
            date?: string;
            Date?: string;
            get?: (name: string) => unknown;
          }
        | undefined;
      const rawHeaderDate =
        headers?.date ?? headers?.Date ?? headers?.get?.('date');
      const headerDate = Array.isArray(rawHeaderDate)
        ? rawHeaderDate[0]
        : rawHeaderDate;
      if (typeof headerDate !== 'string') {
        logResult('missing-date');
        return false;
      }
      const serverTimestamp = new Date(headerDate).getTime();
      serverTime = Number.isFinite(serverTimestamp)
        ? serverTimestamp
        : undefined;
      if (!this.isTimeValid({ time: serverTimestamp })) {
        logResult('invalid-date');
        return false;
      }
      const localTimestamp = Date.now();
      this.updateServerTime({
        serverTime: serverTimestamp,
        localTime: localTimestamp,
        source: 'health-check',
        requestId,
      });

      // Only a fresh health response can justify asking users to fix their clock.
      // Wall time includes system sleep, unlike performance.now() on macOS/Linux.
      const requestDuration = localTimestamp - startedAt;
      if (
        requestDuration >= 0 &&
        requestDuration <= refreshServerTimeTimeout &&
        this.systemTimeStatus === ELocalSystemTimeStatus.INVALID
      ) {
        appEventBus.emit(EAppEventBusNames.LocalSystemTimeInvalid, undefined);
      }
      return true;
    } catch (error) {
      let errorCode: string | undefined;
      if (isAxiosError(error)) {
        httpStatus = error.response?.status;
        errorCode = error.code;
      }
      logResult('request-error', errorCode);
      throw error;
    }
  }

  startServerTimeInterval() {
    if (this._serverTimeInterval) {
      return;
    }
    void this.ensureFreshServerTime()
      .then((success) => {
        if (!success) {
          this.updateSystemTimeStatusByEstimatedServerTime();
        }
      })
      .catch(() => {
        if (!this.updateSystemTimeStatusByEstimatedServerTime()) {
          this.setSystemTimeStatus(ELocalSystemTimeStatus.UNKNOWN);
        }
      });
    this._serverTimeInterval = setInterval(async () => {
      try {
        const success = await this.refreshServerTime();
        if (!success) {
          this.updateSystemTimeStatusByEstimatedServerTime();
        }
      } catch (_error) {
        if (!this.updateSystemTimeStatusByEstimatedServerTime()) {
          this.setSystemTimeStatus(ELocalSystemTimeStatus.UNKNOWN);
        }
      }
    }, intervalTimeout);
  }

  isTimeValid({ time }: { time: number | undefined }): boolean {
    return isTimeValid({ time });
  }

  getEstimatedServerTime(): number | undefined {
    if (
      !this._lastServerTimeIsReal ||
      !this.isTimeValid({ time: this._serverTimeEstimateBase }) ||
      isNil(this._lastServerTimePerfBase)
    ) {
      return undefined;
    }

    const now = getMonotonicTimeNow();
    if (isNil(now)) {
      return undefined;
    }

    const elapsed = now - this._lastServerTimePerfBase;
    if (!isNumber(elapsed) || isNaN(elapsed) || isNil(elapsed) || elapsed < 0) {
      return undefined;
    }

    const estimated = normalizeTimestamp(
      (this._serverTimeEstimateBase ?? 0) + elapsed,
    );
    if (!this.isTimeValid({ time: estimated })) {
      return undefined;
    }
    return estimated;
  }

  getCorrectedCloudSyncNow(): ICloudSyncCorrectedTime {
    const estimated = this.getEstimatedServerTime();
    if (estimated) {
      return {
        time: estimated,
        source: ECloudSyncDataTimeSource.Estimated,
      };
    }

    const localNow = Date.now();
    if (
      this.systemTimeStatus === ELocalSystemTimeStatus.VALID &&
      this.lastServerTime &&
      this.isLocalTimeValid({
        localTime: localNow,
        serverTime: this.lastServerTime,
      })
    ) {
      return {
        time:
          normalizeTimestamp(
            Math.max(localNow, this.lastServerTime, appBuildTime),
          ) ?? appBuildTime,
        source: ECloudSyncDataTimeSource.TrustedLocal,
      };
    }

    if (
      this._lastServerTimeCanBeFallback &&
      this.isTimeValid({ time: this.lastServerTime })
    ) {
      return {
        time: this.lastServerTime ?? appBuildTime,
        source: ECloudSyncDataTimeSource.LastServer,
      };
    }

    return {
      time: appBuildTime,
      source: ECloudSyncDataTimeSource.AppBuild,
    };
  }

  isCloudSyncDataTimeFuturePoisoned({
    dataTime,
    correctedNow,
    tolerance,
  }: {
    dataTime: number | undefined;
    correctedNow?: ICloudSyncCorrectedTime;
    tolerance: number;
  }) {
    if (!dataTime) {
      return false;
    }
    const now = correctedNow ?? this.getCorrectedCloudSyncNow();
    if (now.source === ECloudSyncDataTimeSource.AppBuild) {
      return false;
    }
    return dataTime > now.time + tolerance;
  }

  isLocalTimeValid({
    localTime,
    serverTime,
  }: {
    localTime: number;
    serverTime: number | undefined;
  }): boolean {
    if (!this.isTimeValid({ time: serverTime })) {
      return false;
    }
    if (!this.isTimeValid({ time: localTime })) {
      return false;
    }
    const timeDiff: number = localTime - (serverTime ?? 0);
    if (isNaN(timeDiff) || isNil(timeDiff)) {
      return false;
    }
    const isValid = Math.abs(timeDiff) < localServerTimeDiff;
    return isValid;
  }

  updateServerTime({
    serverTime,
    localTime,
    source = 'server-update',
    responseHost,
    requestId,
  }: {
    serverTime: number | undefined;
    localTime?: number;
    source?: ISystemTimeCheckSource;
    responseHost?: string;
    requestId?: string;
  }) {
    if (!this.isTimeValid({ time: serverTime })) {
      return;
    }

    const localTimestamp = localTime ?? Date.now();
    if (
      !isNumber(localTimestamp) ||
      isNaN(localTimestamp) ||
      isNil(localTimestamp)
    ) {
      return;
    }

    const localTimeValid = this.isLocalTimeValid({
      localTime: localTimestamp,
      serverTime,
    });
    this.logTimeCheck({
      source,
      responseHost,
      requestId,
      localTime: localTimestamp,
      serverTime,
      localTimeValid,
    });
    this.setLastServerTimeValue({
      value: serverTime,
      updateEstimateBaseline: true,
      persist: true,
    });
    if (localTimeValid) {
      this.lastLocalTime = localTimestamp;
    }

    this.setSystemTimeStatus(
      localTimeValid
        ? ELocalSystemTimeStatus.VALID
        : ELocalSystemTimeStatus.INVALID,
    );
  }

  private updateSystemTimeStatusByEstimatedServerTime(): boolean {
    const estimatedServerTime = this.getEstimatedServerTime();
    if (!this.isTimeValid({ time: estimatedServerTime })) {
      return false;
    }

    const localTimestamp = Date.now();
    if (
      !isNumber(localTimestamp) ||
      isNaN(localTimestamp) ||
      isNil(localTimestamp)
    ) {
      return false;
    }

    const localTimeValid = this.isLocalTimeValid({
      localTime: localTimestamp,
      serverTime: estimatedServerTime,
    });
    this.logTimeCheck({
      source: 'estimated',
      localTime: localTimestamp,
      serverTime: estimatedServerTime,
      localTimeValid,
    });
    if (localTimeValid) {
      this.lastLocalTime = localTimestamp;
    }

    this.setSystemTimeStatus(
      localTimeValid
        ? ELocalSystemTimeStatus.VALID
        : ELocalSystemTimeStatus.INVALID,
    );

    return true;
  }

  increaseTimeCache = throttle(
    () => {
      if (this.lastLocalTime) {
        this.lastLocalTime += 1;
      }
      if (this.lastServerTime) {
        this.lastServerTime += 1;
      }
    },
    100,
    {
      leading: true,
      trailing: false,
    },
  );

  getTimeNow(): number {
    const now = Date.now();

    this.increaseTimeCache();

    const defaultTimeNow = Math.max(
      now,
      appBuildTime,
      this.lastLocalTime ?? 0,
      this.lastServerTime ?? 0,
    );

    if (this.systemTimeStatus === ELocalSystemTimeStatus.UNKNOWN) {
      // initial state or server response error
      return defaultTimeNow;
    }

    const isNowValid =
      this.lastServerTime &&
      this.isLocalTimeValid({
        localTime: now,
        serverTime: this.lastServerTime,
      });
    if (isNowValid) {
      this.lastLocalTime = now;
      return now;
    }

    if (this.systemTimeStatus === ELocalSystemTimeStatus.VALID) {
      // do nothing
    }

    if (this.systemTimeStatus === ELocalSystemTimeStatus.INVALID) {
      const time = Math.max(
        appBuildTime,
        this.lastLocalTime ?? 0,
        this.lastServerTime ?? 0,
      );
      if (this.isTimeValid({ time })) {
        return time;
      }
    }

    return defaultTimeNow;
  }

  async handleServerResponseDate({
    source,
    headerDate,
    url,
    requestId,
  }: {
    source: 'axios' | 'fetch';
    headerDate: string;
    url: string;
    requestId?: string;
  }) {
    if (!headerDate || !url) {
      return;
    }
    try {
      await this._handleServerResponseDateThrottle({
        source,
        headerDate,
        url,
        requestId,
      });
    } catch (error) {
      console.error(error);
    }
  }

  _handleServerResponseDateThrottle = throttle(
    async ({
      source,
      headerDate,
      url,
      requestId,
    }: {
      source: 'axios' | 'fetch';
      headerDate: string;
      url: string;
      requestId?: string;
    }) => {
      if (!headerDate || !url) {
        return;
      }

      // headerDate = 'gggg1111';
      let serverDate: Date | undefined = new Date(headerDate);
      let serverTimestamp: number | undefined = serverDate?.getTime();
      if (mockServerTime) {
        serverTimestamp = mockServerTime;
      }
      if (
        isNaN(serverTimestamp) ||
        isNil(serverTimestamp) ||
        isNaN(serverDate) ||
        isNil(serverDate)
      ) {
        serverDate = undefined;
        serverTimestamp = undefined;
      }
      if (!this.isTimeValid({ time: serverTimestamp })) {
        return;
      }
      const isOneKeyDomain = await requestHelper.checkIsOneKeyDomain(url ?? '');
      if (!isOneKeyDomain) {
        return;
      }
      let localTimestamp: number = Date.now();
      if (mockLocalTimeOffset) {
        localTimestamp += mockLocalTimeOffset;
      }
      let responseHost: string | undefined;
      try {
        responseHost = new URL(url).hostname;
      } catch (_error) {
        // Relative URLs have no hostname; never log paths or query strings.
      }
      this.updateServerTime({
        serverTime: serverTimestamp,
        localTime: localTimestamp,
        source,
        responseHost,
        requestId,
      });
    },
    1000,
    {
      leading: true,
      trailing: false,
    },
  );
}

export default new SystemTimeUtils();
