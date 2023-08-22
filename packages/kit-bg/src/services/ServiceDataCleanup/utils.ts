import { get, set } from 'lodash';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { cleanupPolicies } from './policy';

import type { BaseCleanupPolicy, CleanupPolicy } from './types';

export const cachedMatchingPolicies = new Map<string, CleanupPolicy[]>();

export function findMatchingPolicies(lastWriteKey: string) {
  if (cachedMatchingPolicies.has(lastWriteKey)) {
    const policies = cachedMatchingPolicies.get(lastWriteKey);
    if (policies) return policies;
  }
  const policies = cleanupPolicies.filter((policy) => {
    if (policy.source === 'redux') {
      return policy.statePath.some(
        (path) =>
          lastWriteKey === `r:${path}` || lastWriteKey.startsWith(`r:${path}.`),
      );
    }
    if (policy.source === 'simpledb') {
      return policy.dataPath.some(
        (path) =>
          lastWriteKey === `s:${policy.simpleDbEntity.entityName}:${path}` ||
          lastWriteKey.startsWith(
            `s:${policy.simpleDbEntity.entityName}:${path}.`,
          ),
      );
    }
    return false;
  });
  cachedMatchingPolicies.set(lastWriteKey, policies);
  return policies;
}

export function updateLastWriteTime(lastWriteKey: string) {
  if (findMatchingPolicies(lastWriteKey).length === 0) {
    return;
  }
  appStorage.setSetting(`lw:${lastWriteKey}`, Date.now());
}

export function applyCleanupStrategy(
  strategy: BaseCleanupPolicy['strategy'],
  dataToModify: any,
  dataPath: string,
  lastWriteTime: number,
) {
  const now = Date.now();
  let modified = false;
  if (
    strategy.type === 'reset-on-expiry' &&
    now - lastWriteTime > strategy.expiry * 1000
  ) {
    set(dataToModify, dataPath, strategy.resetToValue);
    modified = true;
  } else if (strategy.type === 'array-slice') {
    const array = get(dataToModify, dataPath);
    if (Array.isArray(array) && array.length > strategy.maxToKeep) {
      const start =
        strategy.keepItemsAt === 'head' ? 0 : array.length - strategy.maxToKeep;
      set(
        dataToModify,
        dataPath,
        array.slice(start, start + strategy.maxToKeep),
      );
      modified = true;
    }
  }
  return modified;
}
