import { type AxiosInstance, isAxiosError } from 'axios';
import { isNaN, isNil, isNumber, throttle } from 'lodash';

import { EServiceEndpointEnum } from '../../types/endpoint';
import { appApiClient } from '../appApiClient/appApiClient';
import { ONEKEY_HEALTH_CHECK_URL } from '../config/appConfig';
import { endpointsMap, getEndpointByServiceName } from '../config/endpointsMap';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';
import requestHelper from '../request/requestHelper';
import appStorage from '../storage/appStorage';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import stringUtils from './stringUtils';
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

export type IServerTimeBounds = {
  earliestMs: number;
  latestMs: number;
  localTimeMs: number;
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
// Allow an IP-table attempt, its domain fallback, and interceptor overhead.
const freshResponseMaxDuration = refreshServerTimeTimeout * 3;
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

type IHealthTimeAnchor = {
  serverTime: number;
  monotonicTime: number;
  wallTime: number;
  clock: Performance;
  now: Performance['now'];
  origin: number;
  roundTripMs: number;
};

// The Axios client is cached by service name. Verify the configured upstream
// even on selected-IP transports that don't expose a final response URL.
function getHealthResponseOrigin(client: AxiosInstance, endpoint: string) {
  if (platformEnv.isDev && process.env.ONEKEY_PROXY) {
    const proxyBaseURL = platformEnv.isExtension
      ? 'http://localhost:3180'
      : '/';
    const proxyTarget =
      client.defaults.headers['X-OneKey-Dev-Proxy'] ??
      client.defaults.headers['x-onekey-dev-proxy'];
    if (client.defaults.baseURL !== proxyBaseURL || proxyTarget !== endpoint)
      return undefined;
    const origin = platformEnv.isExtension
      ? proxyBaseURL
      : globalThis.location?.origin;
    return origin && /^https?:\/\//.test(origin) ? origin : undefined;
  }
  return client.defaults.baseURL === endpoint ? endpoint : undefined;
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

  private _isTimeErrorConfirmed = false;

  get isTimeErrorConfirmed(): boolean {
    return this._isTimeErrorConfirmed;
  }

  private _lastServerTime: number | undefined;

  private _serverTimeEstimateBase: number | undefined;

  private _lastServerTimePerfBase: number | undefined;

  private _lastServerTimeLocalBase: number | undefined;

  private _healthTimeAnchor: IHealthTimeAnchor | undefined;

  // This source token and receipt are independent of business Date samples.
  private _cloudActionTimeSource: { endpoint?: string } = {};

  private _cloudActionTimeAnchor: IHealthTimeAnchor | undefined;

  invalidateColdCloudActionTime() {
    this._healthTimeAnchor = undefined;
    this._cloudActionTimeAnchor = undefined;
    this._cloudActionTimeSource = {};
  }

  // Cold actions can be projected only onto a verified sample received
  // during their own short preparation window, not persisted UTC estimates.
  captureColdCloudActionTime(fallback: number): (() => number) | undefined {
    if (this.hasFreshServerTimeInCurrentProcess()) return undefined;
    const source = this._cloudActionTimeSource;
    const clock = globalThis.performance;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Compare identity only; never call this unbound reference.
    const clockNow = clock?.now;
    const timeOrigin = clock?.timeOrigin;
    const wallTime = Date.now();
    const started = getMonotonicTimeNow();
    if (started === undefined || !Number.isFinite(started)) return undefined;

    let resolved: number | undefined;
    const resolve = () => {
      const anchor = this._cloudActionTimeAnchor;
      const now = getMonotonicTimeNow();
      if (
        !anchor ||
        this._cloudActionTimeSource !== source ||
        globalThis.performance !== clock ||
        clock.now !== clockNow ||
        !Object.is(clock.timeOrigin, timeOrigin) ||
        anchor.clock !== clock ||
        anchor.now !== clockNow ||
        !Object.is(anchor.origin, timeOrigin) ||
        now === undefined ||
        !Number.isFinite(now) ||
        anchor.monotonicTime <= started ||
        anchor.monotonicTime > now ||
        now - started > freshResponseMaxDuration ||
        Math.abs(Date.now() - wallTime - (now - started)) > 1000 ||
        Math.abs(
          anchor.wallTime - wallTime - (anchor.monotonicTime - started),
        ) > 1000
      ) {
        return fallback;
      }
      // HTTP Date is rounded down and created no later than receipt. The
      // projected value is a conservative lower bound, never prep-finished UTC.
      const eventTime = Math.floor(
        anchor.serverTime - (anchor.monotonicTime - started),
      );
      if (
        !Number.isSafeInteger(eventTime) ||
        !this.isTimeValid({ time: eventTime })
      )
        return fallback;
      // Compare against the same verified clock, not whichever business
      // response last updated the ordinary estimate during this action.
      const verifiedNow = Math.floor(
        anchor.serverTime + (now - anchor.monotonicTime),
      );
      return this.isTimeValid({ time: verifiedNow }) && fallback > verifiedNow
        ? eventTime
        : fallback;
    };
    return () => (resolved ??= resolve());
  }

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
      this.invalidateColdCloudActionTime();
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

  private setSystemTimeStatus(
    status: ELocalSystemTimeStatus,
    isTimeErrorConfirmed = status === ELocalSystemTimeStatus.INVALID &&
      this._isTimeErrorConfirmed,
  ) {
    if (
      this.systemTimeStatus === status &&
      this._isTimeErrorConfirmed === isTimeErrorConfirmed
    ) {
      return;
    }
    this.systemTimeStatus = status;
    this._isTimeErrorConfirmed = isTimeErrorConfirmed;
    appEventBus.emit(EAppEventBusNames.LocalSystemTimeStatusChanged, {
      status,
      isTimeErrorConfirmed,
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
    const logTime = observedAt;
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

    return this.refreshServerTimeOnce();
  }

  private refreshServerTimeOnce(): Promise<boolean> {
    this._refreshServerTimePromise ??= this.refreshServerTime().finally(() => {
      this._refreshServerTimePromise = undefined;
    });
    return this._refreshServerTimePromise;
  }

  async refreshServerTime(): Promise<boolean> {
    // A settings change can invalidate this request during endpoint lookup,
    // before it has created a client or started the network transport.
    const entryActionTimeSource = this._cloudActionTimeSource;
    const startedAt = Date.now();
    const monotonicStartedAt = getMonotonicTimeNow();
    let httpStatus: number | undefined;
    let serverTime: number | undefined;
    let requestId: string | undefined;
    let requestStartedAt: number | undefined;
    const logResult = (
      result: ISystemTimeRefreshResult,
      errorCode?: string,
    ) => {
      const completedAt = Date.now();
      const monotonicCompletedAt = getMonotonicTimeNow();
      const logTime = completedAt;
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
        requestDurationMs: isNil(requestStartedAt)
          ? undefined
          : completedAt - requestStartedAt,
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
      let actionTimeSource: typeof entryActionTimeSource | undefined;
      if (this._cloudActionTimeSource === entryActionTimeSource) {
        if (entryActionTimeSource.endpoint === undefined) {
          entryActionTimeSource.endpoint = endpoint;
        } else if (entryActionTimeSource.endpoint !== endpoint) {
          this.invalidateColdCloudActionTime();
          this._cloudActionTimeSource.endpoint = endpoint;
        }
        actionTimeSource = this._cloudActionTimeSource;
      }
      const client = await appApiClient.getClient({
        endpoint,
        name: EServiceEndpointEnum.Wallet,
      });
      requestStartedAt = Date.now();
      const requestClock = globalThis.performance;
      // eslint-disable-next-line @typescript-eslint/unbound-method -- Compare identity only; never call this unbound reference.
      const requestClockNow = requestClock?.now;
      const requestClockOrigin = requestClock?.timeOrigin;
      const requestStartedMonotonic = getMonotonicTimeNow();
      const nonce = stringUtils.randomString(12);
      const response = await client.get<unknown, IAxiosResponse<unknown>>(
        ONEKEY_HEALTH_CHECK_URL,
        {
          params: {
            _: 'system_time_utils',
            timestamp: requestStartedAt,
            nonce,
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
      const receiptMonotonic = getMonotonicTimeNow();
      const requestDuration = localTimestamp - requestStartedAt;
      this.updateServerTime({
        serverTime: serverTimestamp,
        localTime: localTimestamp,
        source: 'health-check',
        requestId,
      });

      const roundTripMs =
        (receiptMonotonic ?? NaN) - (requestStartedMonotonic ?? NaN);
      const age = response.headers.age ?? response.headers.Age;
      if (
        response.status === 200 &&
        actionTimeSource &&
        this._cloudActionTimeSource === actionTimeSource &&
        globalThis.performance === requestClock &&
        requestClock?.now === requestClockNow &&
        Object.is(requestClock?.timeOrigin, requestClockOrigin) &&
        receiptMonotonic !== undefined &&
        roundTripMs >= 0 &&
        roundTripMs <= refreshServerTimeTimeout &&
        Math.abs(requestDuration - roundTripMs) <= 1000 &&
        [endpointsMap.prod.wallet, endpointsMap.test.wallet].includes(
          endpoint,
        ) &&
        new Date(serverTimestamp).toUTCString() === headerDate &&
        (age === undefined || Number(age) === 0)
      ) {
        const anchor: IHealthTimeAnchor = {
          serverTime: serverTimestamp,
          monotonicTime: receiptMonotonic,
          wallTime: localTimestamp,
          clock: requestClock,
          now: requestClockNow,
          origin: requestClockOrigin,
          roundTripMs: Math.max(roundTripMs, requestDuration),
        };
        const expectedOrigin = getHealthResponseOrigin(client, endpoint);
        const finalUrl = (
          response.request as { responseURL?: unknown } | undefined
        )?.responseURL;
        if (finalUrl === undefined || finalUrl === '') {
          if (expectedOrigin) this._healthTimeAnchor = anchor;
        } else if (typeof finalUrl === 'string') {
          try {
            const url = new URL(finalUrl);
            if (
              url.pathname === ONEKEY_HEALTH_CHECK_URL &&
              !url.username &&
              !url.password &&
              !url.hash &&
              url.searchParams.get('_') === 'system_time_utils' &&
              url.searchParams.getAll('timestamp').length === 1 &&
              url.searchParams.get('timestamp') === String(requestStartedAt) &&
              url.searchParams.getAll('nonce').length === 1 &&
              url.searchParams.get('nonce') === nonce
            ) {
              if (url.origin === expectedOrigin)
                this._healthTimeAnchor = anchor;
              // Cloud actions additionally require a final URL on the service origin.
              if (url.origin === endpoint) this._cloudActionTimeAnchor = anchor;
            }
          } catch {
            // An invalid final URL cannot establish a clock source.
          }
        }
      }

      // Only a fresh health response can justify asking users to fix their clock.
      // Wall time includes system sleep, unlike performance.now() on macOS/Linux.
      if (this.systemTimeStatus === ELocalSystemTimeStatus.INVALID) {
        if (
          requestDuration >= 0 &&
          requestDuration <= freshResponseMaxDuration
        ) {
          this.setSystemTimeStatus(ELocalSystemTimeStatus.INVALID, true);
          appEventBus.emit(EAppEventBusNames.LocalSystemTimeInvalid, undefined);
        } else {
          this.setSystemTimeStatus(ELocalSystemTimeStatus.INVALID, false);
          logResult('stale-response');
        }
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
    // A business response can seed the estimator without confirming an alert.
    void this.refreshServerTimeOnce()
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

  private getServerTimeBounds(): IServerTimeBounds | undefined {
    const anchor = this._healthTimeAnchor;
    const clock = globalThis.performance;
    const monotonicNow = getMonotonicTimeNow();
    const localTimeMs = Date.now();
    if (
      !anchor ||
      clock !== anchor.clock ||
      clock.now !== anchor.now ||
      !Object.is(clock.timeOrigin, anchor.origin) ||
      monotonicNow === undefined
    )
      return undefined;
    const elapsed = monotonicNow - anchor.monotonicTime;
    const wallElapsed = localTimeMs - anchor.wallTime;
    const minElapsed = Math.min(elapsed, wallElapsed);
    const maxElapsed = Math.max(elapsed, wallElapsed);
    if (
      !(
        minElapsed >= 0 &&
        maxElapsed <= intervalTimeout &&
        maxElapsed - minElapsed <= 1000
      )
    ) {
      return undefined;
    }

    // HTTP Date is rounded down to seconds and was produced at some point
    // during the health request. Carry that uncertainty into both limits.
    return {
      earliestMs: Math.floor(anchor.serverTime + minElapsed),
      latestMs: Math.ceil(
        anchor.serverTime + 1000 + anchor.roundTripMs + maxElapsed,
      ),
      localTimeMs,
    };
  }

  async getServerTimeBoundsWithClockRecovery(): Promise<
    IServerTimeBounds | undefined
  > {
    const bounds = this.getServerTimeBounds();
    if (bounds) return bounds;
    const refreshed = await this.refreshServerTimeOnce().catch(() => false);
    return refreshed ? this.getServerTimeBounds() : undefined;
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
      false,
    );

    return true;
  }

  async getHardwareVerificationTime(): Promise<number | undefined> {
    // Attestation must not reuse a persisted or pre-suspend time sample. Refresh
    // in the signing runtime on every attempt, independently of the UI clock.
    const endpoint = await getEndpointByServiceName(
      EServiceEndpointEnum.Wallet,
    );
    if (
      !endpoint.startsWith('https://') ||
      ![endpointsMap.prod.wallet, endpointsMap.test.wallet].includes(
        endpoint,
      ) ||
      !(await requestHelper.checkIsOneKeyDomain(endpoint))
    ) {
      return undefined;
    }
    const client = await appApiClient.getClient({
      endpoint,
      name: EServiceEndpointEnum.Wallet,
    });
    const responseOrigin = getHealthResponseOrigin(client, endpoint);
    if (!responseOrigin) return undefined;
    const start = getMonotonicTimeNow();
    const wallStart = Date.now();
    if (start === undefined || !Number.isFinite(start)) {
      return undefined;
    }
    const nonce = stringUtils.randomString(12);
    // Relative paths preserve the configured dev proxy and let the selected-IP
    // adapter serialize params into the actual SNI request path.
    const response = await client.get(ONEKEY_HEALTH_CHECK_URL, {
      params: {
        _: 'hardware_verification',
        nonce,
      },
      headers: { 'Cache-Control': 'no-cache, no-store' },
      timeout: refreshServerTimeTimeout,
      maxRedirects: 0,
    });
    const end = getMonotonicTimeNow();
    const wallElapsed = Date.now() - wallStart;
    const elapsed = end === undefined ? NaN : end - start;
    // A paused monotonic clock during sleep or a wall-clock adjustment requires
    // a new request. This only rejects uncertainty; wall time never sets UTC.
    if (
      !Number.isFinite(elapsed) ||
      !Number.isFinite(wallElapsed) ||
      elapsed < 0 ||
      elapsed > refreshServerTimeTimeout ||
      Math.abs(wallElapsed - elapsed) > 1000
    ) {
      return undefined;
    }
    const headerDate: unknown = response.headers.date ?? response.headers.Date;
    const age: unknown = response.headers.age ?? response.headers.Age;
    // XHR follows redirects independently of Axios's maxRedirects option.
    const finalUrl = (response.request as { responseURL?: unknown } | undefined)
      ?.responseURL;
    if (typeof finalUrl === 'string' && finalUrl.length > 0) {
      try {
        const responseUrl = new URL(finalUrl);
        if (
          responseUrl.origin !== responseOrigin ||
          responseUrl.pathname !== ONEKEY_HEALTH_CHECK_URL ||
          responseUrl.searchParams.getAll('nonce').length !== 1 ||
          responseUrl.searchParams.get('nonce') !== nonce ||
          responseUrl.searchParams.get('_') !== 'hardware_verification'
        ) {
          return undefined;
        }
      } catch {
        return undefined;
      }
    }
    if (
      response.status !== 200 ||
      typeof headerDate !== 'string' ||
      (age !== undefined && Number(age) !== 0)
    ) {
      return undefined;
    }
    const timestamp = Date.parse(headerDate);
    if (
      !Number.isFinite(timestamp) ||
      !this.isTimeValid({ time: timestamp }) ||
      new Date(timestamp).toUTCString() !== headerDate
    ) {
      return undefined;
    }
    // Date has one-second resolution. Midpoint compensation bounds network
    // uncertainty by half the accepted round trip; never change signed data.
    return Math.floor(timestamp + elapsed / 2);
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
