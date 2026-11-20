import { createMMKV } from 'react-native-mmkv';

import { getIsolatedSimpleDbMMKVId } from '../simpleDbStorageIsolation';

import type { IMMKVInstance } from '../nativeStorageExecutor';

const isolatedMMKVInstances = new Map<string, IMMKVInstance>();

export function getIsolatedSimpleDbMMKVByEntityName(
  entityName: string,
): IMMKVInstance {
  const mmkvId = getIsolatedSimpleDbMMKVId(entityName);
  let instance = isolatedMMKVInstances.get(mmkvId);
  if (!instance) {
    instance = createMMKV({
      id: mmkvId,
    }) as unknown as IMMKVInstance;
    isolatedMMKVInstances.set(mmkvId, instance);
  }
  return instance;
}

export function getOpenedIsolatedSimpleDbMMKVInstances(): IMMKVInstance[] {
  return [...isolatedMMKVInstances.values()];
}
