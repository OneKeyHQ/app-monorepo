import type { SimpleDbEntityBase } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityBase';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { REPLACE_WHOLE_STATE } from '@onekeyhq/shared/src/background/backgroundUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import ServiceBase from '../ServiceBase';

import {
  applyCleanupStrategy,
  findMatchingPolicies,
  updateLastWriteTime,
} from './utils';

import type { CleanupPolicy, ReduxStatePath, SimpleDbDataPath } from './types';

@backgroundClass()
export default class ServiceDataCleanup extends ServiceBase {
  /**
   * Check all tracked writes and apply all cleanup policies.
   */
  @backgroundMethod()
  async cleanupStaleData() {
    const lastWriteKeys = appStorage
      .getAllKeysOfSetting()
      .filter(
        (key) =>
          key.startsWith('lw:') || key.startsWith('onekey-app-setting\\lw:'),
      );

    for (let settingKey of lastWriteKeys) {
      settingKey = settingKey.replace('onekey-app-setting\\', '');
      const lastWriteTime = appStorage.getSettingNumber(settingKey);
      if (lastWriteTime === undefined) {
        appStorage.deleteSetting(settingKey);
        // eslint-disable-next-line no-continue
        continue;
      }
      const lastWriteKey = settingKey.slice(3); // remove 'lw:'
      const matchingPolicies = findMatchingPolicies(lastWriteKey);
      if (matchingPolicies.length === 0) {
        appStorage.deleteSetting(settingKey);
        debugLogger.dataCleanup.info(
          `No matching policy found for an existing key ${settingKey}. Removed.`,
        );
      } else {
        for (const policy of matchingPolicies) {
          await this.applyCleanupPolicy(policy, lastWriteTime, lastWriteKey);
        }
      }
    }
  }

  /**
   * Call to notify the Data Cleanup Service that a write to a Redux state has happened. This should be usually called in Redux reducers.
   *
   * Data Cleanup Service will keep track of the last write time for the given entity and path, and will apply the cleanup policy if the write is stale.
   */
  @backgroundMethod()
  notifyReduxWrite(statePath: ReduxStatePath) {
    updateLastWriteTime(`r:${statePath}`);
  }

  /**
   * Call to notify the Data Cleanup Service that a write to SimpleDb has happened. This should be usually called in a subclass of SimpleDbEntityBase.
   *
   * Data Cleanup Service will keep track of the last write time for the given entity and path, and will apply the cleanup policy if the write is stale.
   */
  @backgroundMethod()
  notifySimpleDbWrite<TSimpleDbEntity extends SimpleDbEntityBase<unknown>>(
    simpleDbEntity: TSimpleDbEntity,
    dataPath: SimpleDbDataPath<TSimpleDbEntity>,
  ) {
    updateLastWriteTime(`s:${simpleDbEntity.entityName}:${dataPath}`);
  }

  async applyCleanupPolicy(
    policy: CleanupPolicy,
    lastWriteTime: number,
    lastWriteKey: string,
  ) {
    if (policy.source === 'redux') {
      const { state } = await this.backgroundApi.getState();
      if (
        applyCleanupStrategy(
          policy.strategy,
          state,
          lastWriteKey.slice(2), // remove 'r:'
          lastWriteTime,
        )
      ) {
        this.backgroundApi.dispatch({
          type: REPLACE_WHOLE_STATE,
          payload: state,
          $isDispatchFromBackground: true,
        });
        updateLastWriteTime(lastWriteKey);
        debugLogger.dataCleanup.info(
          `Data cleanup applied for ${lastWriteKey}.`,
        );
      } else {
        debugLogger.dataCleanup.info(
          `No stale data found for ${lastWriteKey}.`,
        );
      }
    } else if (policy.source === 'simpledb') {
      const [entityName, path] = lastWriteKey.slice(2).split(':'); // remove 's:'
      const simpleDbEntity = simpleDb[
        entityName as keyof typeof simpleDb
      ] as SimpleDbEntityBase<unknown>;
      if (!simpleDbEntity) {
        debugLogger.dataCleanup.error(
          `Cannot get a SimpleDbEntity instance for ${entityName}.`,
        );
        return;
      }
      const data = await simpleDbEntity.getRawData();
      if (!data) return;
      if (applyCleanupStrategy(policy.strategy, data, path, lastWriteTime)) {
        await simpleDbEntity.setRawData(data);
        updateLastWriteTime(lastWriteKey);
        debugLogger.dataCleanup.info(
          `Data cleanup applied for ${lastWriteKey}.`,
        );
      } else {
        debugLogger.dataCleanup.info(
          `No stale data found for ${lastWriteKey}.`,
        );
      }
    } else {
      throw new Error('Unknown source for the data cleanup policy.');
    }
  }
}
