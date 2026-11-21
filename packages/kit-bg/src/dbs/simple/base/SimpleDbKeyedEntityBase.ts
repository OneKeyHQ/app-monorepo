import { Semaphore } from 'async-mutex';
import { isFunction, isString } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import type { ITravelModeAwareAsyncStorage } from '@onekeyhq/shared/src/storage/appStorageTypes';
import appStorageUtils from '@onekeyhq/shared/src/storage/appStorageUtils';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import { getSimpleDbEntityKey } from './simpleDbFacadeCompatibility';

type ISimpleDbKeyedSavedRecord<TRecord> = {
  data: TRecord | undefined;
  updatedAt: number;
};

/**
 * Base class for newly added `SimpleDbEntity` implementations that must isolate
 * their storage by both physical file and individual record key.
 *
 * Each record is stored under `simple_db_v5:<entityName>:<subKey>`:
 * - iOS / Android: automatically routed by `nativeStorageExecutor` to a
 *   dedicated MMKV file (`onekey-simple-db-<entityName>`), where each `subKey`
 *   is an independent MMKV entry. Updating one `subKey` never rewrites sibling
 *   keys or touches `onekey-app-storage-v1`.
 * - Desktop / Web / Extension: stored as an independent key in IndexedDB
 *   (`OneKeyStorageSimpleDB`) or `ExtensionStorage`.
 */
export abstract class SimpleDbKeyedEntityBase<TRecord> {
  appStorage: ITravelModeAwareAsyncStorage =
    storageHub.$webStorageSimpleDB || storageHub.appStorage;

  private readonly keyMutexes = new Map<string, Semaphore>();

  abstract readonly entityName: string;

  private normalizeSubKey(subKey: string): string {
    const trimmed = subKey.trim();
    if (!trimmed) {
      throw new OneKeyLocalError(
        `SimpleDbKeyedEntityBase (${this.entityName}): subKey must be a non-empty string`,
      );
    }
    return trimmed;
  }

  buildRecordStorageKey(subKey: string): string {
    return `${getSimpleDbEntityKey(this.entityName)}:${this.normalizeSubKey(subKey)}`;
  }

  private getMutexForSubKey(subKey: string): Semaphore {
    const normalized = this.normalizeSubKey(subKey);
    let mutex = this.keyMutexes.get(normalized);
    if (!mutex) {
      mutex = new Semaphore(1);
      this.keyMutexes.set(normalized, mutex);
    }
    return mutex;
  }

  private parseSavedRecord(savedDataStr: unknown): TRecord | undefined {
    if (savedDataStr === null || savedDataStr === undefined) {
      return undefined;
    }
    if (isString(savedDataStr)) {
      try {
        const parsed = JSON.parse(
          savedDataStr,
        ) as ISimpleDbKeyedSavedRecord<TRecord>;
        return parsed?.data;
      } catch {
        return undefined;
      }
    }
    const obj = savedDataStr as Partial<ISimpleDbKeyedSavedRecord<TRecord>>;
    return obj?.data;
  }

  protected async getRecordInner(subKey: string): Promise<TRecord | undefined> {
    const storageKey = this.buildRecordStorageKey(subKey);
    const raw = await this.appStorage.getItem(storageKey);
    return this.parseSavedRecord(raw);
  }

  @backgroundMethod()
  async getRecord(subKey: string): Promise<TRecord | undefined> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: () =>
        this.getMutexForSubKey(subKey).runExclusive(() =>
          this.getRecordInner(subKey),
        ),
      onBlocked: () => undefined,
    });
  }

  @backgroundMethod()
  async setRecord(
    subKey: string,
    dataOrBuilder:
      | TRecord
      | ((prev: TRecord | undefined) => TRecord | Promise<TRecord>),
  ): Promise<TRecord | undefined> {
    const storageKey = this.buildRecordStorageKey(subKey);
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: () =>
        this.getMutexForSubKey(subKey).runExclusive(async () => {
          let nextData: TRecord;
          if (isFunction(dataOrBuilder)) {
            const prevData = await this.getRecordInner(subKey);
            nextData = await dataOrBuilder(prevData);
            if (prevData !== undefined && Object.is(nextData, prevData)) {
              return nextData;
            }
          } else {
            nextData = dataOrBuilder;
          }
          const savedData: ISimpleDbKeyedSavedRecord<TRecord> = {
            data: nextData,
            updatedAt: Date.now(),
          };
          await this.appStorage.setItem(
            storageKey,
            appStorageUtils.canSaveAsObject() && !isString(savedData)
              ? (savedData as any)
              : JSON.stringify(savedData),
          );
          return nextData;
        }),
      onBlocked: () => undefined,
    });
  }

  @backgroundMethod()
  async removeRecord(subKey: string): Promise<void> {
    const storageKey = this.buildRecordStorageKey(subKey);
    const environment = await travelModeManager.getRuntimeEnvironment();
    await environment.persistence.run({
      operation: () =>
        this.getMutexForSubKey(subKey).runExclusive(async () => {
          await this.appStorage.removeItem(storageKey);
        }),
      onBlocked: () => undefined,
    });
  }

  @backgroundMethod()
  async clearRecords(subKeys: readonly string[]): Promise<void> {
    for (const subKey of subKeys) {
      await this.removeRecord(subKey);
    }
  }
}
