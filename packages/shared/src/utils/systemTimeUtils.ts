import { isNaN, isNil, isNumber, throttle } from 'lodash';

import { EServiceEndpointEnum } from '../../types/endpoint';
import { appApiClient } from '../appApiClient/appApiClient';
import { ONEKEY_HEALTH_CHECK_URL } from '../config/appConfig';
import { getEndpointByServiceName } from '../config/endpointsMap';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import requestHelper from '../request/requestHelper';
import appStorage from '../storage/appStorage';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import timerUtils from './timerUtils';

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

class SystemTimeUtils {
  constructor() {
    const lastServerTimeInStorage = appStorage.syncStorage.getNumber(
      EAppSyncStorageKeys.last_valid_server_time,
    );
    this.setLastServerTimeValue({
      value: lastServerTimeInStorage,
      updateEstimateBaseline: false,
      persist: false,
    });

    const lastLocalTimeInStorage = appStorage.syncStorage.getNumber(
      EAppSyncStorageKeys.last_valid_local_time,
    );
    this.lastLocalTime = lastLocalTimeInStorage;
  }

  systemTimeStatus: ELocalSystemTimeStatus = ELocalSystemTimeStatus.UNKNOWN;

  private _lastServerTime: number | undefined;

  private _serverTimeEstimateBase: number | undefined;

  private _lastServerTimePerfBase: number | undefined;

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
    if (!this.isTimeValid({ time: value })) {
      this._lastServerTime = appBuildTime;
      this._serverTimeEstimateBase = undefined;
      this._lastServerTimePerfBase = undefined;
      this._lastServerTimeIsReal = false;
      this._lastServerTimeCanBeFallback = false;
      return;
    }
    this._lastServerTime = value;
    this._lastServerTimeCanBeFallback = true;
    if (updateEstimateBaseline) {
      this._serverTimeEstimateBase = value;
      this._lastServerTimePerfBase = getMonotonicTimeNow();
      this._lastServerTimeIsReal = true;
    }
    if (value && persist) {
      appStorage.syncStorage.set(
        EAppSyncStorageKeys.last_valid_server_time,
        value,
      );
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

  set lastLocalTime(value: number | undefined) {
    if (!this.isTimeValid({ time: value })) {
      this._lastLocalTime = appBuildTime;
      return;
    }
    this._lastLocalTime = value;
    if (value) {
      appStorage.syncStorage.set(
        EAppSyncStorageKeys.last_valid_local_time,
        value,
      );
    }
  }

  _serverTimeInterval: ReturnType<typeof setInterval> | undefined;

  private setSystemTimeStatus(status: ELocalSystemTimeStatus) {
    if (this.systemTimeStatus === status) {
      return;
    }
    this.systemTimeStatus = status;
    appEventBus.emit(EAppEventBusNames.LocalSystemTimeStatusChanged, {
      status,
    });
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
    const endpoint = await getEndpointByServiceName(
      EServiceEndpointEnum.Wallet,
    );
    const client = await appApiClient.getClient({
      endpoint,
      name: EServiceEndpointEnum.Wallet,
    });
    const response = await client.get(ONEKEY_HEALTH_CHECK_URL, {
      params: {
        _: 'system_time_utils',
        timestamp: Date.now(),
      },
      timeout: refreshServerTimeTimeout,
    });
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
      return false;
    }
    const serverTimestamp = new Date(headerDate).getTime();
    if (!this.isTimeValid({ time: serverTimestamp })) {
      return false;
    }
    this.updateServerTime({
      serverTime: serverTimestamp,
    });
    return true;
  }

  startServerTimeInterval() {
    if (this._serverTimeInterval) {
      return;
    }
    void this.ensureFreshServerTime().catch(() => {
      this.setSystemTimeStatus(ELocalSystemTimeStatus.UNKNOWN);
    });
    this._serverTimeInterval = setInterval(async () => {
      try {
        await this.refreshServerTime();
      } catch (_error) {
        this.setSystemTimeStatus(ELocalSystemTimeStatus.UNKNOWN);
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

    const estimated = (this._serverTimeEstimateBase ?? 0) + elapsed;
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
        time: Math.max(localNow, this.lastServerTime, appBuildTime),
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
  }: {
    serverTime: number | undefined;
    localTime?: number;
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

    if (!localTimeValid) {
      appEventBus.emit(EAppEventBusNames.LocalSystemTimeInvalid, undefined);
    }
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    source,
    headerDate,
    url,
  }: {
    source: 'axios' | 'fetch';
    headerDate: string;
    url: string;
  }) {
    if (!headerDate || !url) {
      return;
    }
    try {
      await this._handleServerResponseDateThrottle({
        source,
        headerDate,
        url,
      });
    } catch (error) {
      console.error(error);
    }
  }

  _handleServerResponseDateThrottle = throttle(
    async ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      source,
      headerDate,
      url,
    }: {
      source: 'axios' | 'fetch';
      headerDate: string;
      url: string;
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
      this.updateServerTime({
        serverTime: serverTimestamp,
        localTime: localTimestamp,
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
