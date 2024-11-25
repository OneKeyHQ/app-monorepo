import { debounce } from 'lodash';

import type { Toast } from '@onekeyhq/components';

import dateUtils from '../dateUtils';

const logName = '@@indexedDB_tx_create: ';
const isEnabled = true;
const resetModeEnabled = true;
let resetStartTime: number | undefined;
const maxIndexedDbCallDetailsSize = 49;
const toastWarningSize = 20;

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

let indexedDBResult: {
  [key: string]: number;
} = {};

const indexedDBResultAll: {
  [key: string]: number;
} = {};

function resetData() {
  indexedDBResult = {};
  localDbCallDetails = {};
  simpleDbCallDetails = {};
  appStorageCallDetails = {};
  resetStartTime = undefined;
}

function sortMapData(data: { [key: string]: number }) {
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
  if (!isEnabled) {
    return;
  }
  clearTimeout(resetTimer);
  if (resetModeEnabled && autoReset) {
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
  if (process.env.NODE_ENV !== 'production' && isEnabled) {
    console.log(
      isWarning ? `\x1b[33m${logName}\x1b[0m` : logName,
      dateUtils.formatTime(new Date(), { formatTemplate: 'HH:mm:ss.SSS' }),
      sortMapData(indexedDBResult),
    );
    console.groupCollapsed('\t', logName, 'Details');
    console.log(
      {
        ...localDbCallDetails,
        ...simpleDbCallDetails,
        ...appStorageCallDetails,
      },
      sortMapData(indexedDBResultAll),
    );
    console.groupEnd();
  }
}
const logResultDebounced = debounce(logResult, 600, {
  leading: true,
  trailing: true,
});

function toastWarningAndReset() {
  if (!isEnabled) {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  (globalThis?.$$Toast as typeof Toast | undefined)?.error({
    title: 'IndexedDB is being accessed too frequently',
    message: JSON.stringify(sortMapData(indexedDBResult)),
  });
  logResult({ isWarning: true });
  resetData();
}

export function logLocalDbCall(method: string, table: string, params: any[]) {
  if (process.env.NODE_ENV !== 'production' && isEnabled) {
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
    if (localDbCallDetails[method][table].total > 500) {
      // debugger;
    }
  }
}

export function logSimpleDbCall(method: string, entity: string) {
  if (process.env.NODE_ENV !== 'production' && isEnabled) {
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
  }
}

export function logAppStorageCall(method: string, key: string) {
  if (process.env.NODE_ENV !== 'production' && isEnabled) {
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
  }
}

export function logIndexedDBCreateTx() {
  try {
    if (
      process.env.NODE_ENV !== 'production' &&
      isEnabled &&
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
        // console.log('@@indexedDB_tx_create: ', {
        //   mode, // readonly | readwrite
        //   db: this.name,
        //   dbVersion: this.version,
        //   storeNames,
        //   options,
        // });

        clearTimeout(resetTimer);
        logResultDebounced({ autoReset: true });
        const key = `${this.name}_${mode || 'undefined'}`;
        indexedDBResult[key] = (indexedDBResult[key] || 0) + 1;
        indexedDBResultAll[key] = (indexedDBResultAll[key] || 0) + 1;
        if (indexedDBResult[key] > toastWarningSize) {
          toastWarningAndReset();
        }
        logResultDebounced({ autoReset: true });

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
