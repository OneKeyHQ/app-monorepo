import { isNil } from 'lodash';

import appStorage from '../storage/appStorage';
import { EAppSyncStorageKeys } from '../storage/syncStorage';

import { formatDateFns } from './dateUtils';

export enum EPerformanceTimerLogNames {
  localDB__getAccount = 'localDB__getAccount',
  localDB__getIndexedAccount = 'localDB__getIndexedAccount',
  localDB__getIndexedAccountByAccount = 'localDB__getIndexedAccountByAccount',
  simpleDB__getAccountTokenList = 'simpleDB__getAccountTokenList',
  simpleDB__updateAccountTokenList = 'simpleDB__updateAccountTokenList',
  allNetwork__getAllNetworkAccounts_EachAccount = 'allNetwork__getAllNetworkAccounts_EachAccount',
  allNetwork__getAccountLocalTokens = 'allNetwork__getAccountLocalTokens',
  allNetwork__useAllNetworkRequests = 'allNetwork__useAllNetworkRequests',
  allNetwork__handleAllNetworkCacheRequests = 'allNetwork__handleAllNetworkCacheRequests',
}

function getPerformanceTimerLogConfigMap() {
  return (
    appStorage.syncStorage.getObject<Record<string, boolean>>(
      EAppSyncStorageKeys.onekey_perf_timer_log_config,
    ) ?? {}
  );
}

function updatePerformanceTimerLogConfig(
  logName: EPerformanceTimerLogNames,
  value: boolean,
) {
  const configMap = getPerformanceTimerLogConfigMap();

  appStorage.syncStorage.setObject(
    EAppSyncStorageKeys.onekey_perf_timer_log_config,
    {
      ...configMap,
      [logName]: value,
    },
  );
}

function getPerformanceTimerLogConfig(logName: EPerformanceTimerLogNames) {
  return Boolean(getPerformanceTimerLogConfigMap()?.[logName] ?? false);
}

const repeatTimesMap: Record<EPerformanceTimerLogNames, number> = {} as any;

const timeFormat = 'HH:mm:ss.SSS';
class PerformanceTimer {
  constructor(
    logName: EPerformanceTimerLogNames,
    params?: Record<string, any>,
  ) {
    this.logName = logName;
    this.params = params;
  }

  params?: Record<string, any>;

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

  markEnd(name: string) {
    if (!this.isEnabled) {
      return;
    }

    if (!this.detail[name]) {
      return;
    }
    this.detail[name].end = Date.now();
    this.detail[name].duration =
      (this?.detail?.[name]?.end ?? 0) - (this?.detail?.[name]?.start ?? 0);

    this.detail[name].endAt = formatDateFns(
      new Date(this?.detail?.[name]?.end ?? 0),
      timeFormat,
    );
    this.detail[name].startAt = formatDateFns(
      new Date(this?.detail?.[name]?.start ?? 0),
      timeFormat,
    );
  }

  reset() {
    if (!this.isEnabled) {
      return;
    }

    this.create = Date.now();
    this.detail = {};
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
      params: this.params,
      repeat: repeatTimesMap[this.logName],
    };
    if (result.duration >= (minDuration ?? -10)) {
      console.log(`@@PERF:::${this.logName}`, result);
    }
    return result;
  }
}

function createPerf(
  logName: EPerformanceTimerLogNames,
  params?: Record<string, any>,
) {
  const perf = new PerformanceTimer(logName, params);
  perf.reset();
  return perf;
}

export default {
  createPerf,
  updatePerformanceTimerLogConfig,
  getPerformanceTimerLogConfig,
};
