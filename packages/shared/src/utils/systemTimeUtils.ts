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
const localServerTimeDiff = timerUtils.getTimeDurationMs({
  minute: 30,
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
class SystemTimeUtils {
  constructor() {
    const lastServerTimeInStorage = appStorage.syncStorage.getNumber(
      EAppSyncStorageKeys.last_valid_server_time,
    );
    this.lastServerTime = lastServerTimeInStorage;

    const lastLocalTimeInStorage = appStorage.syncStorage.getNumber(
      EAppSyncStorageKeys.last_valid_local_time,
    );
    this.lastLocalTime = lastLocalTimeInStorage;
  }

  systemTimeStatus: ELocalSystemTimeStatus = ELocalSystemTimeStatus.UNKNOWN;

  private _lastServerTime: number | undefined;

  get lastServerTime(): number | undefined {
    return this._lastServerTime;
  }

  set lastServerTime(value: number | undefined) {
    if (!this.isTimeValid({ time: value })) {
      this._lastServerTime = appBuildTime;
      return;
    }
    this._lastServerTime = value;
    if (value) {
      appStorage.syncStorage.set(
        EAppSyncStorageKeys.last_valid_server_time,
        value,
      );
    }
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

  startServerTimeInterval() {
    if (this._serverTimeInterval) {
      return;
    }
    this._serverTimeInterval = setInterval(async () => {
      try {
        const endpoint = await getEndpointByServiceName(
          EServiceEndpointEnum.Wallet,
        );
        const client = await appApiClient.getClient({
          endpoint,
          name: EServiceEndpointEnum.Wallet,
        });
        await client.get(ONEKEY_HEALTH_CHECK_URL, {
          params: {
            _: 'system_time_utils',
            timestamp: Date.now(),
          },
        });
      } catch (error) {
        this.systemTimeStatus = ELocalSystemTimeStatus.UNKNOWN;
      }
    }, intervalTimeout);
  }

  isTimeValid({ time }: { time: number | undefined }): boolean {
    return isTimeValid({ time });
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
      const timeDiff: number = localTimestamp - (serverTimestamp ?? 0);
      if (isNaN(timeDiff) || isNil(timeDiff)) {
        return;
      }
      const localTimeValid = this.isLocalTimeValid({
        localTime: localTimestamp,
        serverTime: serverTimestamp,
      });
      this.systemTimeStatus = localTimeValid
        ? ELocalSystemTimeStatus.VALID
        : ELocalSystemTimeStatus.INVALID;
      this.lastServerTime = serverTimestamp;
      if (localTimeValid) {
        this.lastLocalTime = localTimestamp;
      }

      if (!localTimeValid) {
        appEventBus.emit(EAppEventBusNames.LocalSystemTimeInvalid, undefined);
      }
    },
    1000,
    {
      leading: true,
      trailing: false,
    },
  );
}

export default new SystemTimeUtils();
