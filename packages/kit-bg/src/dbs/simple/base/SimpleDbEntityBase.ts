import { Semaphore } from 'async-mutex';
import { isFunction, isNil, isString } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import appStorageUtils from '@onekeyhq/shared/src/storage/appStorageUtils';
import dbPerfMonitor from '@onekeyhq/shared/src/utils/debug/dbPerfMonitor';

import { getSimpleDbEntityKey } from './simpleDbFacadeCompatibility';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

type ISimpleDbEntitySavedData<T> = {
  data: T;
  updatedAt: number;
};

// Chromium rejects reads with exactly this signature when a value's external
// blob file is corrupted (e.g. crash mid-write); the record then stays
// unreadable forever. Match nothing broader: UnknownError without this
// message and NotReadableError both cover transient IO conditions where
// deleting would lose recoverable data (OK-59997).
function isUnreadableStorageValueError(error: unknown): boolean {
  const { name, message } = (error ?? {}) as {
    name?: string;
    message?: string;
  };
  return (
    name === 'UnknownError' &&
    Boolean(message?.includes('Failed to read large IndexedDB value'))
  );
}
abstract class SimpleDbEntityBase<T> {
  // Do not use appStorageInstance directly, use this.appStorage instead
  appStorage: AsyncStorageStatic =
    storageHub.$webStorageSimpleDB || storageHub.appStorage;

  mutex = new Semaphore(1);

  abstract readonly entityName: string;

  abstract readonly enableCache: boolean;

  // Deleting an unreadable record is only safe for entities whose data can be
  // fully rebuilt (OK-59997's perp cache); user-authored entities must keep
  // failing loudly instead, so self-heal is opt-in per entity.
  protected readonly enableUnreadableRecordSelfHeal: boolean = false;

  get entityKey() {
    return getSimpleDbEntityKey(this.entityName);
  }

  // localStorage.getItem may return null if data not exists
  cachedRawData: T | undefined | null;

  private cachedRawDataPromise:
    | Promise<T | undefined | null>
    | undefined
    | null = null;

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

  @backgroundMethod()
  clearRawDataCache() {
    this.readGeneration += 1;
    this.cachedRawData = null;
    this.cachedRawDataPromise = null;
  }

  @backgroundMethod()
  async getRawData(): Promise<T | undefined | null> {
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
        try {
          // One retry separates transient IO failures from true corruption.
          savedDataStr = await this.appStorage.getItem(this.entityKey);
        } catch (retryError) {
          if (!isUnreadableStorageValueError(retryError)) {
            throw retryError;
          }
          console.error(retryError);
          // Drop the dead record so builder-based setRawData can rebuild it;
          // use appStorage directly — clearRawData() would deadlock on the
          // shared mutex. Any write overlapping this read vetoes the delete:
          // pending at read start, still pending now, or started since. (A
          // write starting after this check wins anyway — same-store ops keep
          // issue order, so its setItem lands after this removeItem.)
          if (
            pendingWritesBefore === 0 &&
            this.pendingWrites === 0 &&
            this.writeSeq === writeSeqBefore
          ) {
            await this.appStorage
              .removeItem(this.entityKey)
              .catch(() => undefined);
          }
        }
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
