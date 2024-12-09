import { cloneDeep, debounce, isEqual, merge } from 'lodash';

import appGlobals from '../../appGlobals';
import platformEnv from '../../platformEnv';
import { syncStorage } from '../../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../../storage/syncStorageKeys';
import dateUtils from '../dateUtils';

type IOneKeyDBPerfMonitorSettings = {
  isEnabled?: boolean;
  toastWarningEnabled: boolean | undefined;
  toastWarningSize: number;
  consoleLogEnabled: boolean | undefined;
  debuggerEnabled: boolean | undefined;
};

const logName = '@@db_perf_monitor: ';
const maxIndexedDbCallDetailsSize = 50;
const maxRecentCallsSize = 2000;
const resetThreshold = 3000;

const defaultSettings: IOneKeyDBPerfMonitorSettings = {
  toastWarningEnabled: true,
  toastWarningSize: 70,
  consoleLogEnabled: false,
  debuggerEnabled: false,
};

const shouldDbTxCreatedDebuggerRule: Record<string, boolean> = {
  'OneKeyStorage_readonly': false,
  'OneKeyStorage_readwrite': false,
  'OneKeyV5_readonly': false,
  'OneKeyV5_readwrite': false,
};

const shouldLocalDbDebuggerRule: Record<string, number> = {
  'localDb.txGetRecordById__IndexedAccount': 999,
  'localDb.txGetAllRecords__IndexedAccount': 999,
  'localDb.txGetAllRecords__Account': 999,
  'localDb.txGetRecordById__Wallet': 999,
  'localDb.txGetRecordById__Account': 999,
  'appStorage.getItem__simple_db_v5:localHistory': 999,
  'appStorage.getItem__simple_db_v5:LocalNFTs': 999,
  'appStorage.getItem__simple_db_v5:localTokens': 999,
  'appStorage.getItem__simple_db_v5:dappConnection': 999,
};

const IS_ENABLED =
  platformEnv.isDev ||
  Boolean(
    syncStorage?.getBoolean(EAppSyncStorageKeys.onekey_developer_mode_enabled),
  );

let settings: IOneKeyDBPerfMonitorSettings | undefined = (() => {
  if (!IS_ENABLED) {
    return undefined;
  }
  const savedSettings = syncStorage?.getObject(
    EAppSyncStorageKeys.onekey_db_perf_monitor,
  );
  return merge(
    {
      ...defaultSettings,
    },
    savedSettings,
    {
      isEnabled: IS_ENABLED,
    },
  );
})();

function getSettings() {
  if (!IS_ENABLED) {
    return undefined;
  }
  return settings;
}

function updateSettings(newSettings: Partial<IOneKeyDBPerfMonitorSettings>) {
  if (!IS_ENABLED) {
    return undefined;
  }
  settings = merge(settings, newSettings, {
    isEnabled: IS_ENABLED,
  });
  syncStorage?.setObject(EAppSyncStorageKeys.onekey_db_perf_monitor, settings);
}

// ----------------------------------------------

let resetStartTime: number | undefined;

let appStorageCallDetails: {
  [method: string]: {
    details: {
      [key: string]: number;
    };
    total: number;
  };
} = {};

let simpleDbCallDetails: {
  [method: string]: {
    details: {
      [entity: string]: number;
    };
    total: number;
  };
} = {};

let localDbCallDetails: {
  [method: string]: {
    [table: string]: {
      calls: any[];
      total: number;
    };
  };
} = {};

let globalRecentCalls: Array<[string, string, any[]] | [string, string]> = [];

let indexedDBResult: {
  [key: string]: number;
} = {};

let indexedDBResultAll: {
  [key: string]: number;
} = {};

let lastLogIndexedDBResultAll:
  | Partial<{
      [key: string]: number;
    }>
  | undefined;

function getNowString() {
  if (!IS_ENABLED) {
    return '--';
  }
  return dateUtils.formatTime(new Date(), { formatTemplate: 'HH:mm:ss.SSS' });
}

function doResetData() {
  if (!IS_ENABLED) {
    return;
  }
  indexedDBResult = {};
  localDbCallDetails = {};
  simpleDbCallDetails = {};
  appStorageCallDetails = {};
  resetStartTime = undefined;
  globalRecentCalls.push([getNowString(), '---------- resetData ------------']);
}

function resetData() {
  if (!IS_ENABLED) {
    return;
  }
  if (settings?.toastWarningEnabled) {
    doResetData();
  }
}

function sortMapData(data: { [key: string]: number }) {
  if (!IS_ENABLED) {
    return;
  }
  const sortedResult: Partial<{
    [key: string]: number;
  }> = {};
  Object.keys(data)
    .sort()
    .forEach((key) => {
      sortedResult[key] = data[key];
    });
  return sortedResult;
}

let resetTimer: NodeJS.Timeout | undefined;

type ILogResultParams = {
  autoReset?: boolean;
  isWarning?: boolean;
  muteLog?: boolean;
};
function logResult({ autoReset, isWarning, muteLog }: ILogResultParams = {}) {
  clearTimeout(resetTimer);
  if (!IS_ENABLED) {
    return;
  }

  if (IS_ENABLED && !muteLog) {
    const logDataAll = cloneDeep(sortMapData(indexedDBResultAll));

    if (!isEqual(logDataAll, lastLogIndexedDBResultAll)) {
      const logData = cloneDeep(sortMapData(indexedDBResult));

      console.log(
        isWarning ? `\x1b[33m${logName}\x1b[0m` : logName,
        getNowString(),
        logData,
      );

      console.groupCollapsed('\t', logName, 'Details');
      console.log({
        globalStats: logDataAll,
        globalRecentCalls,
        currentStats: logData,
        currentCallsDetail: cloneDeep({
          ...localDbCallDetails,
          ...simpleDbCallDetails,
          ...appStorageCallDetails,
        }),
      });
      console.groupEnd();

      lastLogIndexedDBResultAll = logDataAll;
    }
  }

  if (settings?.toastWarningEnabled && autoReset) {
    if (!resetStartTime) {
      resetStartTime = Date.now();
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetData();
      }, resetThreshold);
    } else {
      const now = Date.now();
      if (now - resetStartTime > resetThreshold) {
        resetData();
      } else {
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          resetData();
        }, resetThreshold - (now - resetStartTime));
      }
    }
  }
}
const logResultDebounced = debounce(logResult, 600, {
  leading: true,
  trailing: true,
});

function resetAllData() {
  if (!IS_ENABLED) {
    return;
  }
  doResetData();
  globalRecentCalls = [];
  indexedDBResultAll = {};
  lastLogIndexedDBResultAll = undefined;

  logResult();
}

let atomInitChecked = false;

function toastWarningAndReset(key: string) {
  if (!IS_ENABLED) {
    return;
  }
  if (settings?.toastWarningEnabled) {
    let shouldShowToast = true;
    if (!atomInitChecked) {
      const atomInitCalls = globalRecentCalls.filter((item) =>
        item?.[1]?.startsWith('appStorage.getItem__g_states_v5:'),
      );
      if (
        key === 'OneKeyStorage_readonly' &&
        atomInitCalls &&
        atomInitCalls?.length >= 30
      ) {
        atomInitChecked = true;
        shouldShowToast = false;
      }
    }

    if (shouldShowToast) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      appGlobals?.$Toast?.error({
        title: 'IndexedDB is being accessed too frequently',
        message: JSON.stringify(sortMapData(indexedDBResult)),
        // TODO copy message button by pass down onToast callback
      });
    }
    logResult({ isWarning: true });

    if (shouldDbTxCreatedDebuggerRule[key]) {
      if (settings?.debuggerEnabled) {
        debugger;
      }
    }
    resetData();
  }
}

function logLocalDbCall(method: string, table: string, params: any[]) {
  if (!IS_ENABLED) {
    return;
  }
  if (IS_ENABLED) {
    // eslint-disable-next-line no-param-reassign
    method = `localDb.${method}`;
    localDbCallDetails[method] = localDbCallDetails[method] || {};
    localDbCallDetails[method][table] = localDbCallDetails[method][table] || {
      calls: [],
      total: 0,
    };
    localDbCallDetails[method][table].calls.push(params);
    if (
      localDbCallDetails[method][table].calls.length >
      maxIndexedDbCallDetailsSize
    ) {
      // limit the calls array size
      localDbCallDetails[method][table].calls = localDbCallDetails[method][
        table
      ].calls.slice(-1 * maxIndexedDbCallDetailsSize);
    }
    localDbCallDetails[method][table].total += 1;

    globalRecentCalls.push([getNowString(), `${method}__${table}`, params]);

    if (
      shouldLocalDbDebuggerRule[`${method}__${table}`] &&
      localDbCallDetails[method][table].total >=
        shouldLocalDbDebuggerRule[`${method}__${table}`]
    ) {
      logResult();
      if (settings?.debuggerEnabled) {
        debugger;
      }
    }
  }
}

function logSimpleDbCall(method: string, entity: string) {
  if (!IS_ENABLED) {
    return;
  }
  if (IS_ENABLED) {
    // eslint-disable-next-line no-param-reassign
    method = `simpleDb.${method}`;
    simpleDbCallDetails[method] = simpleDbCallDetails[method] || {
      details: {},
      total: 0,
    };
    simpleDbCallDetails[method].details[entity] =
      simpleDbCallDetails[method].details[entity] || 0;
    simpleDbCallDetails[method].details[entity] += 1;
    simpleDbCallDetails[method].total += 1;

    globalRecentCalls.push([getNowString(), `${method}__${entity}`]);
  }
}

function logAppStorageCall(method: string, key: string) {
  if (!IS_ENABLED) {
    return;
  }
  if (IS_ENABLED) {
    // eslint-disable-next-line no-param-reassign
    method = `appStorage.${method}`;
    appStorageCallDetails[method] = appStorageCallDetails[method] || {
      details: {},
      total: 0,
    };
    appStorageCallDetails[method].details[key] =
      appStorageCallDetails[method].details[key] || 0;
    appStorageCallDetails[method].details[key] += 1;
    appStorageCallDetails[method].total += 1;

    globalRecentCalls.push([getNowString(), `${method}__${key}`]);

    if (
      shouldLocalDbDebuggerRule[`${method}__${key}`] &&
      appStorageCallDetails[method].details[key] >=
        shouldLocalDbDebuggerRule[`${method}__${key}`]
    ) {
      logResult();
      if (settings?.debuggerEnabled) {
        debugger;
      }
    }
  }
}

function logIndexedDBCreateTx() {
  if (!IS_ENABLED) {
    return;
  }
  try {
    if (IS_ENABLED && globalThis?.IDBDatabase?.prototype) {
      // @ts-ignore
      if (globalThis.IDBDatabase.prototype?.transactionOriginal) {
        // avoid infinite loop injection
        return;
      }

      // @ts-ignore
      globalThis.IDBDatabase.prototype.transactionOriginal =
        // eslint-disable-next-line @typescript-eslint/unbound-method
        globalThis.IDBDatabase.prototype.transaction;
      globalThis.IDBDatabase.prototype.transaction = function (
        storeNames: string | string[],
        mode?: IDBTransactionMode,
        options?: IDBTransactionOptions,
      ) {
        clearTimeout(resetTimer);

        logResultDebounced({
          autoReset: true,
          muteLog: !settings?.consoleLogEnabled,
        });
        const key = `${this.name}_${mode || 'undefined'}`;
        indexedDBResult[key] = (indexedDBResult[key] || 0) + 1;
        indexedDBResultAll[key] = (indexedDBResultAll[key] || 0) + 1;
        if (
          settings?.toastWarningSize &&
          indexedDBResult[key] >= settings?.toastWarningSize
        ) {
          toastWarningAndReset(key);
        }
        logResultDebounced({
          autoReset: true,
          muteLog: !settings?.consoleLogEnabled,
        });

        globalRecentCalls = globalRecentCalls.slice(-1 * maxRecentCallsSize);

        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return globalThis.IDBDatabase.prototype.transactionOriginal.apply(
          // @ts-ignore
          this,
          // @ts-ignore
          // eslint-disable-next-line prefer-rest-params
          arguments,
        );
      };
    }
  } catch (e) {
    //
  }
}

export default {
  getSettings,
  updateSettings,
  resetAllData,
  logIndexedDBCreateTx,
  logLocalDbCall,
  logSimpleDbCall,
  logAppStorageCall,
};
