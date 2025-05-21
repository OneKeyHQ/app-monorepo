import axios from 'axios';
import { isNaN, isNil, throttle } from 'lodash';

import { EServiceEndpointEnum } from '../../types/endpoint';
import { ONEKEY_HEALTH_CHECK_URL } from '../config/appConfig';
import { getEndpointByServiceName } from '../config/endpointsMap';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import requestHelper from '../request/requestHelper';

import timerUtils from './timerUtils';

export enum ELocalSystemTimeStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNKNOWN = 'UNKNOWN',
}

// const mockServerTime: number | undefined = 1_947_829_622_691;
const mockServerTime: number | undefined = undefined;

const intervalTimeout = timerUtils.getTimeDurationMs({
  // seconds: 5,
  minute: 5,
});
const localServerTimeDiff = timerUtils.getTimeDurationMs({
  minute: 30,
});

class SystemTimeUtils {
  systemTimeStatus: ELocalSystemTimeStatus = ELocalSystemTimeStatus.UNKNOWN;

  lastServerTime: number | undefined;

  lastLocalTime: number | undefined;

  _serverTimeInterval: NodeJS.Timeout | undefined;

  startServerTimeInterval() {
    if (this._serverTimeInterval) {
      return;
    }
    this._serverTimeInterval = setInterval(async () => {
      const endpoint = await getEndpointByServiceName(
        EServiceEndpointEnum.Wallet,
      );
      const url = `${endpoint}${ONEKEY_HEALTH_CHECK_URL}`;
      axios
        .get(url, {
          params: {
            _: 'system_time_utils',
            timestamp: Date.now(),
          },
        })
        .catch(() => {
          this.systemTimeStatus = ELocalSystemTimeStatus.UNKNOWN;
        });
    }, intervalTimeout);
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

  isTimeValid({ time }: { time: number | undefined }): boolean {
    if (isNil(time) || isNaN(time) || time < 1_747_527_766_656) {
      return false;
    }
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

    // TODO persist lastLocalTime and lastServerTime

    const defaultTimeNow = Math.max(
      now,
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
      const time = Math.max(this.lastServerTime ?? 0, this.lastLocalTime ?? 0);
      if (this.isTimeValid({ time })) {
        return time;
      }
    }

    return defaultTimeNow;
  }

  handleServerResponseDate = throttle(
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
      // TODO try catch
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
      const localTimestamp: number = Date.now();
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
        : ELocalSystemTimeStatus.INVALID; // TODO show system time invalid Dialog
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
