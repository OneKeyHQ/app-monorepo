import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export const MMKV_MIGRATION_COMPLETE_KEY = '__mmkv_migration_v1__';

export const PASSWORD_CONTROL_STORAGE_KEY = 'g_states_v5:passwordPersistAtom';

export const MANUAL_LOCK_CONTROL_STORAGE_KEY =
  'g_states_v5:passwordPersistManualLockStateAtom';

export const SETTINGS_CONTROL_STORAGE_KEY = 'g_states_v5:settingsPersistAtom';

export const CURRENCY_REFERENCE_STORAGE_KEY = 'g_states_v5:currencyPersistAtom';

type ICloudSyncStorageDevSettings = {
  enabled?: boolean;
  settings?: { enableTestEndpoint?: boolean };
};

export function getCloudSyncStorageEnvironment(
  settings: ICloudSyncStorageDevSettings | undefined,
  defaultTest: boolean,
): 'prod' | 'test' {
  const enabled =
    settings && Object.hasOwn(settings, 'enabled')
      ? !!settings.enabled
      : defaultTest;
  const enableTest =
    settings && Object.hasOwn(settings, 'settings')
      ? !!settings.settings?.enableTestEndpoint
      : defaultTest;
  return enabled && enableTest ? 'test' : 'prod';
}

// The owning runtime keeps its storage namespace until the API-node restart.
let cloudSyncStorageEnvironment: 'prod' | 'test' | undefined;

export function initializeCloudSyncStorageEnvironment(env: 'prod' | 'test') {
  if (cloudSyncStorageEnvironment && cloudSyncStorageEnvironment !== env) {
    throw new OneKeyLocalError(
      'Cloud Sync storage environment changed; restart required',
    );
  }
  cloudSyncStorageEnvironment = env;
}

export function getCloudSyncStorageEnvironmentForRuntime() {
  return cloudSyncStorageEnvironment;
}

export function getEnvironmentScopedCloudSyncStorageKey(
  productionKey: string,
  env = cloudSyncStorageEnvironment,
) {
  return env === 'test' ? `${productionKey}:test` : productionKey;
}
