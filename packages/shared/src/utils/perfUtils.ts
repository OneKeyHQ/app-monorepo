import { isNil } from 'lodash';

import appStorage from '../storage/appStorage';

export enum EPerformanceTimerLogNames {
  localDB__getAccount = 'localDB__getAccount',
  localDB__getIndexedAccount = 'localDB__getIndexedAccount',
  localDB__getIndexedAccountByAccount = 'localDB__getIndexedAccountByAccount',
  simpleDB__getAccountTokenList = 'simpleDB__getAccountTokenList',
  localDB__getAllNetworkAccounts_EachAccount = 'localDB__getAllNetworkAccounts_EachAccount',
  allNetwork__getAccountLocalTokens = 'allNetwork__getAccountLocalTokens',
  allNetwork__useAllNetworkRequests = 'allNetwork__useAllNetworkRequests',
  allNetwork__handleAllNetworkCacheRequests = 'allNetwork__handleAllNetworkCacheRequests',
}

const configStorageKey = '$$ONEKEY_PERF_TIMER_LOG_CONFIG';
function getPerformanceTimerLogConfigMap() {
  try {
    return JSON.parse(
      appStorage.syncStorage.getString(configStorageKey) || `{}`,
    ) as Record<string, boolean>;
  } catch (e) {
    return {};
  }
}

function updatePerformanceTimerLogConfig(
  logName: EPerformanceTimerLogNames,
  value: boolean,
) {
  const configMap = getPerformanceTimerLogConfigMap();
  appStorage.syncStorage.set(
    configStorageKey,
    JSON.stringify({
      ...configMap,
      [logName]: value,
    }),
  );
}

function getPerformanceTimerLogConfig(logName: EPerformanceTimerLogNames) {
  return Boolean(getPerformanceTimerLogConfigMap()?.[logName] ?? false);
}

class PerformanceTimer {
  constructor(logName: EPerformanceTimerLogNames) {
    this.logName = logName;
  }

  private logName: EPerformanceTimerLogNames;

  private beginAt = Date.now();

  private detail: {
    [name: string]: {
      start: number | undefined;
      end: number | undefined;
      duration: number | undefined;
      params?: Record<string, any>;
    };
  } = {};

  _isEnabled: boolean | undefined;

  get isEnabled() {
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
  }

  reset() {
    if (!this.isEnabled) {
      return;
    }

    this.beginAt = Date.now();
    this.detail = {};
  }

  done({ minDuration }: { minDuration?: number } = {}) {
    if (!this.isEnabled) {
      return;
    }

    const finishAt = Date.now();
    const result = {
      duration: finishAt - this.beginAt,
      detail: this.detail,
      beginAt: this.beginAt,
      finishAt,
    };
    if (result.duration >= (minDuration ?? -10)) {
      console.log(`@@PERF:::${this.logName}`, result);
    }
    return result;
  }
}

function perfTimer(logName: EPerformanceTimerLogNames) {
  const perf = new PerformanceTimer(logName);
  perf.reset();
  return perf;
}

export default {
  perfTimer,
  updatePerformanceTimerLogConfig,
  getPerformanceTimerLogConfig,
};
