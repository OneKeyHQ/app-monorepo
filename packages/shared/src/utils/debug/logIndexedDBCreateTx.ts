import { cloneDeep, debounce, isEqual } from 'lodash';

import appGlobals from '../../appGlobals';
import dateUtils from '../dateUtils';

const IS_ENABLED = true;
const DEBUGGER_MODE_ENABLED = true;
const toastWarningSize = 30;
// ----------------------------------------------
const logName = '@@indexedDB_tx_create: ';
const maxIndexedDbCallDetailsSize = 50;
const maxRecentCallsSize = 2000;

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
};

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

const globalRecentCalls: Array<[string, string, any[]] | [string, string]> = [];

let indexedDBResult: {
  [key: string]: number;
} = {};

const indexedDBResultAll: {
  [key: string]: number;
} = {};

let lastLogIndexedDBResultAll:
  | Partial<{
      [key: string]: number;
    }>
  | undefined;

function getNowString() {
  return dateUtils.formatTime(new Date(), { formatTemplate: 'HH:mm:ss.SSS' });
}

function resetData() {
  if (!IS_ENABLED) {
    return;
  }
  if (DEBUGGER_MODE_ENABLED) {
    indexedDBResult = {};
    localDbCallDetails = {};
    simpleDbCallDetails = {};
    appStorageCallDetails = {};
    resetStartTime = undefined;
    globalRecentCalls.push([
      getNowString(),
      '---------- resetData ------------',
    ]);
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

function logResult({
  autoReset,
  isWarning,
}: {
  autoReset?: boolean;
  isWarning?: boolean;
} = {}) {
  clearTimeout(resetTimer);
  if (!IS_ENABLED) {
    return;
  }

  if (process.env.NODE_ENV !== 'production' && IS_ENABLED) {
    const logDataAll = cloneDeep(sortMapData(indexedDBResultAll));

    if (!isEqual(logDataAll, lastLogIndexedDBResultAll)) {
      const logData = cloneDeep(sortMapData(indexedDBResult));
      console.log(
        isWarning ? `\x1b[33m${logName}\x1b[0m` : logName,
        getNowString(),
        logData,
      );

      console.groupCollapsed('\t', logName, 'Details');
      console.log(
        cloneDeep({
          ...localDbCallDetails,
          ...simpleDbCallDetails,
          ...appStorageCallDetails,
        }),
      );
      console.log({
        globalStats: logDataAll,
        globalRecentCalls,
      });
      console.groupEnd();

      lastLogIndexedDBResultAll = logDataAll;
    }
  }

  if (DEBUGGER_MODE_ENABLED && autoReset) {
    if (!resetStartTime) {
      resetStartTime = Date.now();
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetData();
      }, 3000);
    } else {
      const now = Date.now();
      if (now - resetStartTime > 3000) {
        resetData();
      } else {
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          resetData();
        }, 3000 - (now - resetStartTime));
      }
    }
  }
}
const logResultDebounced = debounce(logResult, 600, {
  leading: true,
  trailing: true,
});

function toastWarningAndReset(key: string) {
  if (!IS_ENABLED) {
    return;
  }
  if (DEBUGGER_MODE_ENABLED) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    appGlobals?.$Toast?.error({
      title: 'IndexedDB is being accessed too frequently',
      message: JSON.stringify(sortMapData(indexedDBResult)),
    });
    logResult({ isWarning: true });
    if (shouldDbTxCreatedDebuggerRule[key]) {
      debugger;
    }
    resetData();
  }
}

export function logLocalDbCall(method: string, table: string, params: any[]) {
  if (!IS_ENABLED) {
    return;
  }
  if (process.env.NODE_ENV !== 'production' && IS_ENABLED) {
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
      if (DEBUGGER_MODE_ENABLED) {
        logResult();
        debugger;
      }
    }
  }
}

export function logSimpleDbCall(method: string, entity: string) {
  if (!IS_ENABLED) {
    return;
  }
  if (process.env.NODE_ENV !== 'production' && IS_ENABLED) {
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

export function logAppStorageCall(method: string, key: string) {
  if (!IS_ENABLED) {
    return;
  }
  if (process.env.NODE_ENV !== 'production' && IS_ENABLED) {
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
  }
}

export function logIndexedDBCreateTx() {
  if (!IS_ENABLED) {
    return;
  }
  try {
    if (
      process.env.NODE_ENV !== 'production' &&
      IS_ENABLED &&
      globalThis?.IDBDatabase?.prototype
    ) {
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
        logResultDebounced({ autoReset: true });
        const key = `${this.name}_${mode || 'undefined'}`;
        indexedDBResult[key] = (indexedDBResult[key] || 0) + 1;
        indexedDBResultAll[key] = (indexedDBResultAll[key] || 0) + 1;
        if (indexedDBResult[key] > toastWarningSize) {
          toastWarningAndReset(key);
        }
        logResultDebounced({ autoReset: true });

        globalRecentCalls.slice(-1 * maxRecentCallsSize);

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
