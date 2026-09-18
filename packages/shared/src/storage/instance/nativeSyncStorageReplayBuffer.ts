import { SWR_CACHE_MAX_ENTRIES } from '../../utils/swrCacheLimits';

import type { INativeSyncStorageLocalMutation } from '../nativeStorageTypes';

const SWR_CACHE_KEY = 'onekey_swr_cache';
const MAX_REPLAY_SWR_CHARS = 10 * 1024 * 1024;

// Canonical entries describe the final value (or deletion), so newer entries
// supersede older ones without replaying every intermediate SWR snapshot.
export function appendCompactedLocalMutation(
  mutations: INativeSyncStorageLocalMutation[],
  mutation: INativeSyncStorageLocalMutation,
): boolean {
  if (mutation.operation === 'clear') {
    mutations.splice(0, mutations.length, mutation);
    return true;
  }
  if (mutation.operation === 'patchSWR') {
    let previousIndex = -1;
    for (let index = mutations.length - 1; index >= 0; index -= 1) {
      const pending = mutations[index];
      if (
        pending.operation === 'clear' ||
        ('key' in pending && pending.key === SWR_CACHE_KEY)
      )
        break;
      if (pending.operation === 'patchSWR') {
        previousIndex = index;
        break;
      }
    }
    const previous = mutations[previousIndex];
    const entries = new Map(
      previous?.operation === 'patchSWR' ? previous.entries : [],
    );
    mutation.entries.forEach(([key, value]) => entries.set(key, value));
    let chars = 0;
    entries.forEach((value, key) => {
      chars += key.length + (value?.length ?? 0);
    });
    if (entries.size > SWR_CACHE_MAX_ENTRIES || chars > MAX_REPLAY_SWR_CHARS)
      return false;
    if (previousIndex >= 0) mutations.splice(previousIndex, 1);
    mutations.push({ operation: 'patchSWR', entries: [...entries] });
    return true;
  }
  for (let index = mutations.length - 1; index >= 0; index -= 1) {
    const pending = mutations[index];
    if (pending.operation === 'clear') break;
    if (
      ('key' in pending && pending.key === mutation.key) ||
      (mutation.key === SWR_CACHE_KEY && pending.operation === 'patchSWR')
    ) {
      mutations.splice(index, 1);
    }
  }
  mutations.push(mutation);
  return true;
}
