import { get, set } from 'lodash';

import type { SimpleDbEntityBase } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityBase';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type { IAppState } from '@onekeyhq/kit/src/store';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { REPLACE_WHOLE_STATE } from '@onekeyhq/shared/src/background/backgroundUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from '../ServiceBase';

import { cleanupPolicies } from './policy';
import { updateLastWriteTime } from './utils';

import type { CleanupPolicy, ReduxStatePath, SimpleDbDataPath } from './types';

const simpleDbInstanceLookup = Object.fromEntries(
  Object.values(simpleDb).map((instance: SimpleDbEntityBase<unknown>) => [
    instance.entityName,
    instance,
  ]),
) as Record<string, SimpleDbEntityBase<unknown>>;

@backgroundClass()
export default class ServiceDataCleanup extends ServiceBase {
  /**
   * Check all tracked writes and apply all cleanup policies.
   */
  @backgroundMethod()
  async cleanupStaleData() {
    const now = Date.now();

    if (
      now - (await simpleDb.lastWrite.getDataCleanupLastRun()) <
      86400 * 1000
    ) {
      // Data cleanup is run at most once per day
      return;
    }

    const lastWriteKeysToReset: { redux: string[]; simpleDb: string[] } = {
      redux: [],
      simpleDb: [],
    };

    let cachedReduxState: IAppState | undefined;
    const getCachedReduxState = async () => {
      if (!cachedReduxState) {
        cachedReduxState = (await this.backgroundApi.getState()).state;
      }
      return cachedReduxState;
    };

    const cachedSimpleDbRawData: Record<string, unknown> = {};
    const getCachedSimpleDbRawData = async (
      simpleDbEntity: SimpleDbEntityBase<unknown>,
    ) => {
      let data = cachedSimpleDbRawData[simpleDbEntity.entityName];
      if (!data) {
        data = await simpleDbEntity.getRawData();
        cachedSimpleDbRawData[simpleDbEntity.entityName] = data;
      }
      return data;
    };

    let reduxStateModified = false;
    const simpleDbModified: Record<string, boolean> = {};
    const markCachedDataAsModified = (policy: CleanupPolicy) => {
      if (policy.source === 'redux') {
        reduxStateModified = true;
      } else if (policy.source === 'simpleDb') {
        simpleDbModified[policy.simpleDbEntity.entityName] = true;
      }
    };

    for (const policy of cleanupPolicies) {
      const { strategy } = policy;
      if (strategy.type === 'reset-on-expiry') {
        const expiredPaths = (
          await Promise.all(
            policy.dataPaths.map((dataPath) =>
              simpleDb.lastWrite.getExpiredKeys(
                policy.source,
                strategy.expiry,
                policy.source === 'redux'
                  ? dataPath
                  : `${policy.simpleDbEntity.entityName}:${dataPath}`,
                now,
              ),
            ),
          )
        ).flat();
        if (expiredPaths.length === 0) {
          debugLogger.dataCleanup.info(
            `No expired paths found for policy.`,
            policy,
          );
          // eslint-disable-next-line no-continue
          continue;
        }
        debugLogger.dataCleanup.info(
          `Found expired paths ${expiredPaths.join(', ')}`,
          policy,
        );
        if (policy.source === 'redux') {
          for (const path of expiredPaths) {
            set(await getCachedReduxState(), path, strategy.resetToValue);
          }
          lastWriteKeysToReset.redux.push(...expiredPaths);
        } else if (policy.source === 'simpleDb') {
          const data = await getCachedSimpleDbRawData(policy.simpleDbEntity);
          // eslint-disable-next-line no-continue
          if (!data) continue;
          for (const path of expiredPaths) {
            const [, realPath] = path.split(':');
            set(data, realPath, strategy.resetToValue);
          }
          lastWriteKeysToReset.simpleDb.push(...expiredPaths);
        }
        markCachedDataAsModified(policy);
      } else {
        let dataToModify: any;
        if (policy.source === 'redux') {
          dataToModify = await getCachedReduxState();
        } else if (policy.source === 'simpleDb') {
          dataToModify = getCachedSimpleDbRawData(policy.simpleDbEntity);
          // eslint-disable-next-line no-continue
          if (!dataToModify) continue;
        }
        for (const path of policy.dataPaths) {
          const dataAtPath = get(dataToModify, path);
          if (strategy.type === 'array-slice') {
            if (
              Array.isArray(dataAtPath) &&
              dataAtPath.length > strategy.maxToKeep
            ) {
              const start =
                strategy.keepItemsAt === 'head'
                  ? 0
                  : dataAtPath.length - strategy.maxToKeep;
              const slicedArray = dataAtPath.slice(
                start,
                start + strategy.maxToKeep,
              );
              set(dataToModify, path, slicedArray);
              debugLogger.dataCleanup.info(
                `Applied array-slice strategy at path [${path}]. Before: ${dataAtPath.length}, after: ${slicedArray.length}.`,
                policy,
              );
              markCachedDataAsModified(policy);
            }
          } else if (strategy.type === 'custom') {
            const newData = await strategy.run(dataAtPath);
            if (newData === dataAtPath) {
              // eslint-disable-next-line no-continue
              continue;
            }
            set(dataToModify, path, newData);
            debugLogger.dataCleanup.info(
              `Applied custom custom at path [${path}].`,
              policy,
            );
            markCachedDataAsModified(policy);
          }
        }
      }
    }

    await simpleDb.lastWrite.multiSet('redux', lastWriteKeysToReset.redux, now);
    await simpleDb.lastWrite.multiSet(
      'simpleDb',
      lastWriteKeysToReset.simpleDb,
      now,
    );
    debugLogger.dataCleanup.info(
      'Last write timestamp for expired paths has been reset.',
      lastWriteKeysToReset,
    );

    if (reduxStateModified) {
      // batch all updates to redux state into a single dispatch
      this.backgroundApi.dispatch({
        type: REPLACE_WHOLE_STATE,
        payload: cachedReduxState,
        $isDispatchFromBackground: true,
      });
      debugLogger.dataCleanup.info(
        'Dispatched a REPLACE_WHOLE_STATE action to update redux state.',
      );
    }
    for (const [entityName, data] of Object.entries(cachedSimpleDbRawData)) {
      // batch all updates to simpleDb into a single setRawData call
      if (simpleDbModified[entityName]) {
        await simpleDbInstanceLookup[entityName].setRawData(data);
        debugLogger.dataCleanup.info(
          `Data saved on SimpleDb entity ${entityName}.`,
        );
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
    updateLastWriteTime('redux', statePath);
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
    updateLastWriteTime('simpleDb', `${simpleDbEntity.entityName}:${dataPath}`);
  }
}
