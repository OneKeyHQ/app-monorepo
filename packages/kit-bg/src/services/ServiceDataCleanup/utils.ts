import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { cleanupPolicies } from './policy';

export const findMatchingPolicies = memoizee((lastWriteKey: string) => {
  const policies = cleanupPolicies.filter((policy) => {
    if (policy.source === 'redux') {
      return policy.dataPaths.some(
        (path) => lastWriteKey === path || lastWriteKey.startsWith(`${path}.`),
      );
    }
    if (policy.source === 'simpleDb') {
      return policy.dataPaths.some(
        (path) =>
          lastWriteKey === `${policy.simpleDbEntity.entityName}:${path}` ||
          lastWriteKey.startsWith(
            `${policy.simpleDbEntity.entityName}:${path}.`,
          ),
      );
    }
    return false;
  });
  return policies;
});

export function updateLastWriteTime(
  source: 'redux' | 'simpleDb',
  lastWriteKey: string,
  now = Date.now(),
) {
  if (findMatchingPolicies(lastWriteKey).length === 0) {
    debugLogger.dataCleanup.warn(
      `updateLastWriteTime: no matching policy found for key ${lastWriteKey}. Ignored.`,
    );
    return;
  }
  simpleDb.lastWrite.set(source, lastWriteKey, now);
}
