import { Semaphore } from 'async-mutex';
import { isFunction, isNil, isString } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import type { AsyncStorageStatic } from '@onekeyhq/shared/src/storage/appStorageTypes';
import appStorageUtils from '@onekeyhq/shared/src/storage/appStorageUtils';
import dbPerfMonitor from '@onekeyhq/shared/src/utils/debug/dbPerfMonitor';

import {
  type IUnreadableSelfHealLogger,
  getStorageErrorMeta,
  retryUnreadableStorageRead,
} from './retryUnreadableStorageRead';
import { getSimpleDbEntityKey } from './simpleDbFacadeCompatibility';
import { isUnreadableStorageValueError } from './unreadableStorageValueError';

type ISimpleDbEntitySavedData<T> = {
  data: T;
  updatedAt: number;
};

abstract class SimpleDbEntityBase<T> {
  // Do not use appStorageInstance directly, use this.appStorage instead
  appStorage: AsyncStorageStatic =
    storageHub.$webStorageSimpleDB || storageHub.appStorage;

  mutex = new Semaphore(1);

  abstract readonly entityName: string;

  abstract readonly enableCache: boolean;

  // Default on: this Chromium signature means the record is already
  // unreadable, and builder setRawData cannot repair it. Leaving the dead
  // key blocks the whole entity (and often the app). Matcher + 50/500/1000ms
  // retries + write-overlap veto still avoid transient-IO deletes
  // (OK-59997 / OK-61648). Opt out only for diagnostic loud-fail entities.
  protected readonly enableUnreadableRecordSelfHeal: boolean = true;

  get entityKey() {
    return getSimpleDbEntityKey(this.entityName);
  }

  // localStorage.getItem may return null if data not exists
  cachedRawData: T | undefined | null;

  private cachedRawDataPromise:
    | Promise<T | undefined | null>
    | undefined
    | null = null;

  private transactionReadSnapshot: { data: T | undefined | null } | undefined;

  updatedAt = 0;

  // Bumped when a persisted write starts so a failing read can tell whether a
  // concurrent setRawData started after the read began.
  private writeSeq = 0;

  // Writes currently awaiting setItem; a failing read must not delete while
  // one is in flight or was in flight when the read began.
  private pendingWrites = 0;

  // Bumped by clearRawDataCache and setRawData so a read that was already in
  // flight cannot re-publish a stale value into the memory cache afterwards.
  private readGeneration = 0;

  // Stays protected and sync: both call sites need the cache cleared within the
  // same tick, and SimpleDbEntityAsyncMethods requires every *public* entity
  // method to be async — widening this would break that contract.
  protected clearRawDataCache() {
    this.readGeneration += 1;
    this.cachedRawData = null;
    this.cachedRawDataPromise = null;
  }

  private logUnreadableSelfHeal: IUnreadableSelfHealLogger = (params) => {
    try {
      defaultLogger.app.storage.simpleDbUnreadableSelfHeal({
        entityName: this.entityName,
        entityKey: this.entityKey,
        ...params,
      });
    } catch (error) {
      // Logging must never block self-heal (e.g. desktopApi not ready yet).
      console.error(
        '[simpleDb self-heal log failed]',
        this.entityName,
        params.phase,
        error,
      );
    }
  };

  @backgroundMethod()
  async getRawData(): Promise<T | undefined | null> {
    if (this.transactionReadSnapshot) {
      return Promise.resolve(this.transactionReadSnapshot.data);
    }
    if (this.enableCache && !isNil(this.cachedRawData)) {
      return Promise.resolve(this.cachedRawData);
    }
    if (this.cachedRawDataPromise) {
      return this.cachedRawDataPromise;
    }
    this.cachedRawDataPromise = (async () => {
      dbPerfMonitor.logSimpleDbCall('getRawData', this.entityName);
      const writeSeqBefore = this.writeSeq;
      const pendingWritesBefore = this.pendingWrites;
      const readGenerationBefore = this.readGeneration;
      let savedDataStr: string | null = null;
      try {
        savedDataStr = await this.appStorage.getItem(this.entityKey);
      } catch (error) {
        if (
          !this.enableUnreadableRecordSelfHeal ||
          !isUnreadableStorageValueError(error)
        ) {
          throw error;
        }
        const meta = getStorageErrorMeta(error);
        this.logUnreadableSelfHeal({
          phase: 'detected',
          errorName: meta.errorName,
          errorMessage: meta.errorMessage,
        });
        // Backoff retries, then drop the dead record so builder-based
        // setRawData can rebuild it. Use appStorage directly — clearRawData()
        // would deadlock on the shared mutex. Any write overlapping this read
        // vetoes the delete: pending at read start, still pending now, or
        // started since.
        savedDataStr = await retryUnreadableStorageRead({
          read: () => this.appStorage.getItem(this.entityKey),
          shouldDelete: () =>
            pendingWritesBefore === 0 &&
            this.pendingWrites === 0 &&
            this.writeSeq === writeSeqBefore,
          onDelete: async () => {
            await this.appStorage
              .removeItem(this.entityKey)
              .catch(() => undefined);
          },
          errorMeta: meta,
          log: (entry) => this.logUnreadableSelfHeal(entry),
        });
      }
      let updatedAt = 0;
      // @ts-ignore
      let data: T | undefined | null;
      if (isString(savedDataStr)) {
        try {
          const savedData = JSON.parse(
            savedDataStr,
          ) as ISimpleDbEntitySavedData<T>;
          data = savedData?.data;
          updatedAt = savedData?.updatedAt;
        } catch (err) {
          console.error(err);
          data = null;
        }
      } else {
        const savedDataObj = savedDataStr as unknown as
          | {
              data: T | undefined;
              updatedAt: number;
            }
          | undefined
          | null;
        if (!isNil(savedDataObj?.updatedAt) || !isNil(savedDataObj?.data)) {
          updatedAt = savedDataObj?.updatedAt;
          data = savedDataObj?.data;
        } else {
          data = savedDataObj as any;
        }
      }
      this.updatedAt = updatedAt ?? 0;
      // Skip the cache when clearRawData ran while this read was in flight,
      // otherwise the stale value would resurrect the just-cleared record on
      // the next builder-based write.
      if (this.enableCache && this.readGeneration === readGenerationBefore) {
        this.cachedRawData = data;
      }
      return data;
    })().finally(() => {
      this.cachedRawDataPromise = null;
    });
    return this.cachedRawDataPromise;
  }

  @backgroundMethod()
  async setRawData(
    dataOrBuilder:
      | T
      | ((rawData: T | null | undefined) => T)
      | ((rawData: T | null | undefined) => Promise<T>),
  ) {
    return this.mutex.runExclusive(async () => {
      const updatedAt = Date.now();
      let data: T | undefined;

      if (isFunction(dataOrBuilder)) {
        const rawData = await this.getRawData();
        data = await dataOrBuilder(rawData);
      } else {
        data = dataOrBuilder;
      }

      if (this.enableCache) {
        this.cachedRawData = data;
      }
      this.cachedRawDataPromise = null;
      const savedData: ISimpleDbEntitySavedData<T> = {
        data,
        updatedAt,
      };

      dbPerfMonitor.logSimpleDbCall('setRawData', this.entityName);
      this.writeSeq += 1;
      this.readGeneration += 1;
      this.pendingWrites += 1;
      try {
        await this.appStorage.setItem(
          this.entityKey,
          appStorageUtils.canSaveAsObject() && !isString(savedData)
            ? (savedData as any)
            : JSON.stringify(savedData),
        );
      } finally {
        this.pendingWrites -= 1;
      }

      this.updatedAt = updatedAt;
      return data;
    });
  }

  protected async setRawDataTransaction({
    afterPublish,
    beforePublish,
    build,
    shouldCommit,
  }: {
    afterPublish?: (data: T) => boolean;
    beforePublish?: (data: T) => Promise<boolean> | boolean;
    build: (
      rawData: T | null | undefined,
    ) => Promise<{ data: T } | undefined> | { data: T } | undefined;
    shouldCommit: () => boolean;
  }): Promise<{
    committed: boolean;
    data: T | null | undefined;
    previousData: T | null | undefined;
  }> {
    return this.mutex.runExclusive(async () => {
      const previousData = await this.getRawData();
      const previousUpdatedAt = this.updatedAt;
      const next = await build(previousData);
      if (!next || !shouldCommit()) {
        return {
          committed: false,
          data: previousData,
          previousData,
        };
      }

      const updatedAt = Date.now();
      const savedData: ISimpleDbEntitySavedData<T> = {
        data: next.data,
        updatedAt,
      };
      const previousSavedData: ISimpleDbEntitySavedData<T> | undefined =
        previousUpdatedAt
          ? {
              data: previousData as T,
              updatedAt: previousUpdatedAt,
            }
          : undefined;
      const serializeSavedData = (value: ISimpleDbEntitySavedData<T>): string =>
        appStorageUtils.canSaveAsObject() && !isString(value)
          ? (value as unknown as string)
          : JSON.stringify(value);
      let restoreCompleted = false;
      let writeAttempted = false;
      const restorePreviousData = async () => {
        this.transactionReadSnapshot = { data: previousData };
        if (this.enableCache) {
          this.cachedRawData = previousData;
        }
        this.cachedRawDataPromise = null;
        this.updatedAt = previousUpdatedAt;
        this.writeSeq += 1;
        this.readGeneration += 1;
        if (previousSavedData) {
          await this.appStorage.setItem(
            this.entityKey,
            serializeSavedData(previousSavedData),
          );
        } else {
          await this.appStorage.removeItem(this.entityKey);
        }
        restoreCompleted = true;
      };
      const buildRejectedResult = () => ({
        committed: false,
        data: previousData,
        previousData,
      });

      // Keep readers on the pre-transaction snapshot until both persistence
      // and the caller's cancellation check have completed.
      this.transactionReadSnapshot = { data: previousData };
      this.cachedRawDataPromise = null;
      dbPerfMonitor.logSimpleDbCall('setRawData', this.entityName);
      this.writeSeq += 1;
      this.readGeneration += 1;
      this.pendingWrites += 1;
      try {
        writeAttempted = true;
        await this.appStorage.setItem(
          this.entityKey,
          serializeSavedData(savedData),
        );

        // A background RPC that arrived while setItem was pending runs on a
        // task, not a promise microtask. Yield one task before the final guard
        // so its synchronous cancellation intent is observable here.
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });

        if (!shouldCommit()) {
          await restorePreviousData();
          return buildRejectedResult();
        }
        if (beforePublish && !(await beforePublish(next.data))) {
          await restorePreviousData();
          return buildRejectedResult();
        }
        if (!shouldCommit()) {
          await restorePreviousData();
          return buildRejectedResult();
        }

        if (this.enableCache) {
          this.cachedRawData = next.data;
        }
        this.cachedRawDataPromise = null;
        this.updatedAt = updatedAt;
        this.transactionReadSnapshot = undefined;
        if (afterPublish && !afterPublish(next.data)) {
          await restorePreviousData();
          return buildRejectedResult();
        }
        return {
          committed: true,
          data: next.data,
          previousData,
        };
      } catch (error) {
        // A rollback invoked from the guarded path is still inside this try.
        // If its first storage write fails, retry it here instead of treating
        // the attempted rollback as complete and leaving rejected data on disk.
        if (writeAttempted && !restoreCompleted) {
          await restorePreviousData();
        }
        throw error;
      } finally {
        this.pendingWrites -= 1;
        this.transactionReadSnapshot = undefined;
      }
    });
  }

  @backgroundMethod()
  async clearRawData() {
    // Share the entity mutex with setRawData so a "Clear cache" can't interleave
    // with an in-flight setRawData. Without it, a setRawData builder that already
    // captured the old rawData would still setItem() AFTER this removeItem(),
    // resurrecting the just-cleared cache (reading the in-mutex rawData inside the
    // builder only closes the other half of the race — where clear lands before
    // the builder's getRawData). Serializing clear and write makes them atomic:
    // clear either fully precedes a setRawData (its builder then reads empty) or
    // fully follows it (it removes what was just written). Safe from re-entrancy —
    // nothing inside calls setRawData/clearRawData.
    return this.mutex.runExclusive(async () => {
      if (this.enableCache) {
        this.clearRawDataCache();
      }
      return this.appStorage.removeItem(this.entityKey);
    });
  }
}
export { SimpleDbEntityBase };
