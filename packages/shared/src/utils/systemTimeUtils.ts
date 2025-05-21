import axios from 'axios';
import { isNaN, isNil } from 'lodash';

import { EServiceEndpointEnum } from '../../types/endpoint';
import { ONEKEY_HEALTH_CHECK_URL } from '../config/appConfig';
import { getEndpointByServiceName } from '../config/endpointsMap';
import requestHelper from '../request/requestHelper';

import timerUtils from './timerUtils';

export enum ELocalSystemTimeStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNKNOWN = 'UNKNOWN',
}

const intervalTimeout = timerUtils.getTimeDurationMs({
  // seconds: 5,
  minute: 5,
});

class SystemTimeUtils {
  status: ELocalSystemTimeStatus = ELocalSystemTimeStatus.UNKNOWN;

  lastServerTime: number | undefined;

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
          this.status = ELocalSystemTimeStatus.UNKNOWN;
        });
    }, intervalTimeout);
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
    // headerDate = 'gggg1111';
    let serverDate: Date | undefined = new Date(headerDate);
    let serverTimestamp: number | undefined = serverDate?.getTime();
    if (isNaN(serverTimestamp) || isNil(serverTimestamp) || isNil(serverDate)) {
      serverDate = undefined;
      serverTimestamp = undefined;
    }
    if (isNil(serverTimestamp) || serverTimestamp < 1_747_527_766_656) {
      return;
    }
    const isOneKeyDomain = await requestHelper.checkIsOneKeyDomain(url ?? '');
    if (!isOneKeyDomain) {
      return;
    }
    const localTimestamp: number = Date.now();
    const timeDiff: number = localTimestamp - (serverTimestamp ?? 0);
    if (isNaN(timeDiff)) {
      return;
    }

    this.status =
      Math.abs(timeDiff) <
      timerUtils.getTimeDurationMs({
        minute: 30,
      })
        ? ELocalSystemTimeStatus.VALID
        : ELocalSystemTimeStatus.INVALID;
    this.lastServerTime = serverTimestamp;

    // console.log('handleServerResponseDate', {
    //   source,
    //   headerDate,
    //   url,
    //   // date,
    //   isOneKeyDomain,
    //   timeDiff,
    // });
  }
}

export default new SystemTimeUtils();
