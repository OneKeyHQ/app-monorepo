import { isNil } from 'lodash';

import errorUtils from '../../errors/utils/errorUtils';
import appStorage from '../../storage/appStorage';
import { EAppSyncStorageKeys } from '../../storage/syncStorage';
import { formatDateFns } from '../dateUtils';

export enum EPerformanceTimerLogNames {
  // localDB
  localDB__getAccount = 'localDB__getAccount',
  localDB__getIndexedAccount = 'localDB__getIndexedAccount',
  localDB__getIndexedAccountByAccount = 'localDB__getIndexedAccountByAccount',
  // simpleDB
  simpleDB__getAccountTokenList = 'simpleDB__getAccountTokenList',
  simpleDB__updateAccountTokenList = 'simpleDB__updateAccountTokenList',
  // allNetwork
  allNetwork__getAllNetworkAccounts_EachAccount = 'allNetwork__getAllNetworkAccounts_EachAccount',
  allNetwork__getAccountLocalTokens = 'allNetwork__getAccountLocalTokens',
  allNetwork__useAllNetworkRequests = 'allNetwork__useAllNetworkRequests',
  allNetwork__handleAllNetworkCacheRequests = 'allNetwork__handleAllNetworkCacheRequests',
  allNetwork__walletAddressPage = 'allNetwork__walletAddressPage',
  allNetwork__TokenListView = 'allNetwork__TokenListView',
  // serviceNetwork
  serviceNetwork__getAllNetworks = 'serviceNetwork__getAllNetworks',
  serviceNetwork__getAllNetworksWithCache = 'serviceNetwork__getAllNetworksWithCache',
  // serviceAccount
  serviceAccount__getNetworkAccountsInSameIndexedAccountId = 'serviceAccount__getNetworkAccountsInSameIndexedAccountId',
  serviceAccount__getNetworkAccountsInSameIndexedAccountId_EachAccount = 'serviceAccount__getNetworkAccountsInSameIndexedAccountId_EachAccount',
}

function getPerformanceTimerLogConfigMap() {
  try {
    return (
      appStorage.syncStorage.getObject<Record<string, boolean>>(
        EAppSyncStorageKeys.onekey_perf_timer_log_config,
      ) ?? {}
    );
  } catch (error) {
    errorUtils.autoPrintErrorIgnore(error);
    return {};
  }
}

function updatePerformanceTimerLogConfig(
  logName: EPerformanceTimerLogNames,
  value: boolean,
) {
  try {
    const configMap = getPerformanceTimerLogConfigMap();

    appStorage.syncStorage.setObject(
      EAppSyncStorageKeys.onekey_perf_timer_log_config,
      {
        ...configMap,
        [logName]: value,
      },
    );
  } catch (error) {
    errorUtils.autoPrintErrorIgnore(error);
  }
}

function getPerformanceTimerLogConfig(logName: EPerformanceTimerLogNames) {
  return Boolean(getPerformanceTimerLogConfigMap()?.[logName] ?? false);
}

const repeatTimesMap: Record<EPerformanceTimerLogNames, number> = {} as any;

const timeFormat = 'HH:mm:ss.SSS';

type IPerformanceTimerOptions = {
  name: EPerformanceTimerLogNames;
  params?: Record<string, any>;
  keepPrevDetail?: boolean;
};
class PerformanceTimer {
  constructor(options: IPerformanceTimerOptions) {
    const { name: logName } = options;
    this.logName = logName;
    this.options = options;
  }

  options: IPerformanceTimerOptions;

  private logName: EPerformanceTimerLogNames;

  private create = Date.now();

  private detail: {
    [name: string]: {
      start: number | undefined;
      startAt?: string;
      end: number | undefined;
      endAt?: string;
      duration: number | undefined;
      params?: Record<string, any>;
      memo?: Record<string, any> | string;
    };
  } = {};

  _isEnabled: boolean | undefined;

  get isEnabled() {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    if (isNil(this._isEnabled)) {
      this._isEnabled = getPerformanceTimerLogConfig(this.logName);
    }
    return this._isEnabled;
  }

  markStart(name: string, params?: Record<string, any>) {
    if (!this.isEnabled) {
      return;
    }

    this.detail[name] = {
      duration: undefined,
      start: Date.now(),
      end: undefined,
      params,
    };
  }

  markEnd(name: string, memo?: Record<string, any> | string) {
    if (!this.isEnabled) {
      return;
    }

    if (!this.detail[name]) {
      this.detail[name] = {
        duration: undefined,
        start: undefined,
        end: undefined,
      };
    }
    this.detail[name].end = Date.now();
    this.detail[name].duration =
      this?.detail?.[name]?.end && this?.detail?.[name]?.start
        ? (this?.detail?.[name]?.end ?? 0) - (this?.detail?.[name]?.start ?? 0)
        : undefined;

    this.detail[name].endAt = formatDateFns(
      new Date(this?.detail?.[name]?.end ?? 0),
      timeFormat,
    );
    this.detail[name].startAt = this?.detail?.[name]?.start
      ? formatDateFns(new Date(this?.detail?.[name]?.start ?? 0), timeFormat)
      : undefined;
    this.detail[name].memo = memo;

    this.detail[name] = {
      duration: this.detail[name].duration,
      startAt: this.detail[name].startAt,
      endAt: this.detail[name].endAt,
      params: this.detail[name].params,
      memo: this.detail[name].memo,
      start: this.detail[name].start,
      end: this.detail[name].end,
    };
  }

  reset() {
    if (!this.isEnabled) {
      return;
    }

    this.create = Date.now();
    if (this.options.keepPrevDetail) {
      Object.values(this.detail).forEach((item) => {
        item.start = Date.now();
      });
    } else {
      this.detail = {};
    }
  }

  done({ minDuration }: { minDuration?: number } = {}) {
    if (!this.isEnabled) {
      return;
    }

    const done = Date.now();
    repeatTimesMap[this.logName] = (repeatTimesMap?.[this.logName] ?? 0) + 1;
    const result = {
      duration: done - this.create,
      detail: this.detail,
      create: this.create,
      createAt: formatDateFns(new Date(this.create), timeFormat),
      done,
      doneAt: formatDateFns(new Date(done), timeFormat),
      params: this.options.params,
      repeat: repeatTimesMap[this.logName],
    };
    if (result.duration >= (minDuration ?? -10)) {
      console.log(`@@PERF:::${this.logName}`, result);
    }
    return result;
  }
}

function createPerf(options: IPerformanceTimerOptions) {
  const perf = new PerformanceTimer(options);
  perf.reset();
  return perf;
}

export default {
  createPerf,
  updatePerformanceTimerLogConfig,
  getPerformanceTimerLogConfig,
};
