/* cspell:ignore IMMKV */
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMMKVInstance } from '@onekeyhq/shared/src/storage/instance/createMMKVSyncStorage';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import {
  PERP_JOTAI_DISPLAY_SNAPSHOT_KEY,
  perpSnapshotCache,
} from '../../dbs/simple/base/simpleDbSnapshotCacheUtils';

import { EAtomNames } from './atomNames';
import { jotaiInitFromUi } from './jotaiInitFromUi';
import { buildJotaiStorageKey } from './jotaiStorage';
import {
  MMKV_MIGRATION_COMPLETE_KEY,
  getCloudSyncStorageEnvironment,
  getEnvironmentScopedCloudSyncStorageKey,
} from './jotaiStorageConsts';

import type { IJotaiNativeStorageHydration } from './jotaiInitFromNativeStorageTypes';

/**
 * Hydrate the UI runtime's Jotai store from the persisted states directly.
 *
 * The background runtime owns these atoms and is still the only writer, but
 * what it would send back at startup is a copy of a file this runtime can
 * read itself. Reading it here takes the background runtime's boot — the
 * single largest item on the cold-start path — out from in front of the first
 * frame; the RPC hydration still runs afterwards and remains canonical.
 *
 * Values land through the same snapshot injection the RPC path uses, so an
 * atom picks its value up when it is first created and nothing is set twice.
 *
 * The fast path steps aside rather than guessing whenever it cannot be sure
 * the file is the truth: Travel Mode (where what may be read is bg's
 * decision), a store that has not finished migrating off AsyncStorage, or a
 * store that holds nothing yet.
 */
export async function hydrateJotaiFromNativeStorage(): Promise<IJotaiNativeStorageHydration> {
  if (!platformEnv.isNativeMainThread) {
    return { hydrated: false, atomCount: 0, reason: 'not-main-runtime' };
  }
  if (travelModeManager.isMaskingDataSync()) {
    return { hydrated: false, atomCount: 0, reason: 'travel-mode' };
  }

  let mmkv: IMMKVInstance | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mmkv =
      require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance')
        .default as IMMKVInstance;
  } catch {
    mmkv = undefined;
  }
  if (!mmkv) {
    return { hydrated: false, atomCount: 0, reason: 'store-unavailable' };
  }

  // The same marker bg's storage checks before it trusts the file. Without it
  // the values still live in AsyncStorage, which only bg can read.
  try {
    if (mmkv.getString(MMKV_MIGRATION_COMPLETE_KEY) !== '1') {
      return { hydrated: false, atomCount: 0, reason: 'not-migrated' };
    }
  } catch {
    return { hydrated: false, atomCount: 0, reason: 'store-unavailable' };
  }

  let cloudSyncEnvironment: 'prod' | 'test' | undefined;
  try {
    const dev = mmkv.getString(
      buildJotaiStorageKey(EAtomNames.devSettingsPersistAtom),
    );
    cloudSyncEnvironment = getCloudSyncStorageEnvironment(
      dev
        ? (JSON.parse(dev) as Parameters<
            typeof getCloudSyncStorageEnvironment
          >[0])
        : undefined,
      !!platformEnv.isDev || !!platformEnv.isE2E,
    );
  } catch {
    // The background startup snapshot will provide the authoritative state.
  }
  const states: Partial<Record<EAtomNames, unknown>> = {};
  let atomCount = 0;
  Object.values(EAtomNames).forEach((name) => {
    try {
      if (name === EAtomNames.perpsAccountDisplaySnapshotAtom) {
        const snapshot = perpSnapshotCache.get(
          PERP_JOTAI_DISPLAY_SNAPSHOT_KEY,
        )?.data;
        if (snapshot !== undefined && snapshot !== null) {
          states[name] = snapshot;
          atomCount += 1;
        }
        return;
      }
      const key = buildJotaiStorageKey(name);
      if (
        name === EAtomNames.primeCloudSyncPersistAtom &&
        !cloudSyncEnvironment
      )
        return;
      const raw = mmkv?.getString(
        name === EAtomNames.primeCloudSyncPersistAtom
          ? getEnvironmentScopedCloudSyncStorageKey(key, cloudSyncEnvironment)
          : key,
      );
      if (raw === undefined) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      // An atom left with its hardcoded default is exactly what an absent key
      // means, so a null payload is skipped rather than injected.
      if (parsed !== null) {
        states[name] = parsed;
        atomCount += 1;
      }
    } catch {
      // A single unreadable atom is a miss, not a failed startup.
    }
  });
  if (atomCount === 0) {
    return { hydrated: false, atomCount: 0, reason: 'empty' };
  }

  await jotaiInitFromUi({ states, useSnapshotInjection: true });
  return { hydrated: true, atomCount };
}
