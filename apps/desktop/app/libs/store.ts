import fs from 'fs';
import path from 'path';

import { app, safeStorage } from 'electron';
import logger from 'electron-log/main';
import Store from 'electron-store';

import { EDesktopStoreKeys } from '@onekeyhq/shared/types/desktop';
import type {
  IDesktopStoreFallbackUpdateBundleData,
  IDesktopStoreMap,
  IDesktopStoreUpdateBundleData,
  IDesktopStoreUpdateSettings,
} from '@onekeyhq/shared/types/desktop';

const store = new Store<IDesktopStoreMap>({ name: 'OneKey' });

export type ILocalStore = {
  getUpdateSettings(): IDesktopStoreUpdateSettings;
  setUpdateSettings(updateSettings: IDesktopStoreUpdateSettings): void;
  clear(): void;
};

export const instance = store;

export const clear = () => {
  store.clear();
};

export const getUpdateSettings = () =>
  store.get(EDesktopStoreKeys.UpdateSettings, {
    useTestFeedUrl: false,
  });

export const setUpdateSettings = (
  updateSettings: IDesktopStoreUpdateSettings,
): void => {
  store.set(EDesktopStoreKeys.UpdateSettings, updateSettings);
};

export const getDevTools = () => store.get(EDesktopStoreKeys.DevTools, false);

export const setDevTools = (devTools: boolean) => {
  store.set(EDesktopStoreKeys.DevTools, devTools);
};

export const getDisableKeyboardShortcuts = () =>
  store.get(EDesktopStoreKeys.DisableKeyboardShortcuts, {
    disableAllShortcuts: false,
  });

export const setDisableKeyboardShortcuts = (config: {
  disableAllShortcuts?: boolean;
}) => {
  store.set(EDesktopStoreKeys.DisableKeyboardShortcuts, {
    ...getDisableKeyboardShortcuts(),
    ...config,
  });
};

export const getTheme = () => store.get(EDesktopStoreKeys.Theme, 'system');

export const setTheme = (theme: string) =>
  store.set(EDesktopStoreKeys.Theme, theme);

export const getLanguage = () =>
  store.get(EDesktopStoreKeys.Language, 'system');

export const setLanguage = (lang: string) =>
  store.set(EDesktopStoreKeys.Language, lang);

export const getWinBounds = (): Electron.Rectangle =>
  store.get(EDesktopStoreKeys.WinBounds, {} as any);

export const setWinBounds = (bounds: Electron.Rectangle) =>
  store.set(EDesktopStoreKeys.WinBounds, bounds);

export const clearUpdateSettings = () => {
  store.delete(EDesktopStoreKeys.UpdateSettings);
};

export const getSecureItem = (key: string) => {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    logger.error('safeStorage is not available');
    return undefined;
  }
  const item = store.get(EDesktopStoreKeys.EncryptedData, {});
  const value = item[key];
  if (value) {
    try {
      const result = safeStorage.decryptString(Buffer.from(value, 'hex'));
      return result;
    } catch (_e) {
      logger.error(`failed to decrypt ${key}`);
      return undefined;
    }
  }
};

export const setSecureItem = (key: string, value: string): void => {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    logger.error('safeStorage is not available');
    return undefined;
  }
  try {
    const items = store.get(EDesktopStoreKeys.EncryptedData, {});
    items[key] = safeStorage.encryptString(value).toString('hex');
    store.set(EDesktopStoreKeys.EncryptedData, items);
  } catch (_e) {
    logger.error(`failed to encrypt ${key}`);
  }
};

export const deleteSecureItem = (key: string) => {
  const items = store.get(EDesktopStoreKeys.EncryptedData, {});
  delete items[key];
  store.set(EDesktopStoreKeys.EncryptedData, items);
};

export const isSecureStorageAvailable = (): boolean => {
  const available = safeStorage.isEncryptionAvailable();
  if (!available) {
    return false;
  }
  // On Linux, check if we have a real secure backend (not basic_text)
  // basic_text means data is encrypted with a hardcoded password, which is not secure
  if (process.platform === 'linux') {
    const backend = safeStorage.getSelectedStorageBackend();
    if (backend === 'basic_text') {
      logger.warn(
        'safeStorage backend is basic_text, secure storage is not truly secure',
      );
      return false;
    }
  }
  return true;
};

export const setASCFile = (ascFile: string) => {
  store.set(EDesktopStoreKeys.ASCFile, ascFile);
};

export const getASCFile = () => store.get(EDesktopStoreKeys.ASCFile, '');

export const clearASCFile = () => {
  store.delete(EDesktopStoreKeys.ASCFile);
};

export const setUpdateBuildNumber = (buildNumber: string) => {
  store.set(EDesktopStoreKeys.UpdateBuildNumber, buildNumber);
};

export const getUpdateBuildNumber = () =>
  store.get(EDesktopStoreKeys.UpdateBuildNumber, '');

export const clearUpdateBuildNumber = () => {
  store.delete(EDesktopStoreKeys.UpdateBuildNumber);
};

export const setUpdateBundleData = (
  updateBundleData: IDesktopStoreUpdateBundleData,
) => {
  store.set(EDesktopStoreKeys.UpdateBundleData, updateBundleData);
};

export const getUpdateBundleData = () =>
  store.get(
    EDesktopStoreKeys.UpdateBundleData,
    {} as IDesktopStoreUpdateBundleData,
  );

export const clearUpdateBundleData = () => {
  store.delete(EDesktopStoreKeys.UpdateBundleData);
};

export const setFallbackUpdateBundleData = (
  fallbackUpdateBundleData: IDesktopStoreFallbackUpdateBundleData,
) => {
  store.set(
    EDesktopStoreKeys.FallbackUpdateBundleData,
    fallbackUpdateBundleData,
  );
};

export const getFallbackUpdateBundleData = () =>
  store.get(
    EDesktopStoreKeys.FallbackUpdateBundleData,
    [] as IDesktopStoreFallbackUpdateBundleData,
  );

export const clearFallbackUpdateBundleData = () => {
  store.delete(EDesktopStoreKeys.FallbackUpdateBundleData);
};

export const setNativeVersion = (nativeVersion: string) => {
  store.set(EDesktopStoreKeys.NativeVersion, nativeVersion);
};

export const getNativeVersion = () =>
  store.get(EDesktopStoreKeys.NativeVersion, '');

export const setNativeBuildNumber = (buildNumber: string) => {
  store.set(EDesktopStoreKeys.NativeBuildNumber, buildNumber);
};

export const getNativeBuildNumber = () =>
  store.get(EDesktopStoreKeys.NativeBuildNumber, '');

// ==================== GPU Crash Statistics ====================
// Functions for tracking GPU crash events
export const recordGPUCrash = () => {
  const crashes = store.get(EDesktopStoreKeys.GPUCrashCount, 0);
  const newCount = crashes + 1;
  store.set(EDesktopStoreKeys.GPUCrashCount, newCount);
  store.set(EDesktopStoreKeys.LastGPUCrashTime, Date.now());
  logger.error(`GPU crash recorded. Total crashes: ${newCount}`);
};

export const getGPUCrashStats = () => ({
  count: store.get(EDesktopStoreKeys.GPUCrashCount, 0),
  lastCrashTime: store.get(EDesktopStoreKeys.LastGPUCrashTime, 0),
});

export const clearGPUCrashStats = () => {
  store.delete(EDesktopStoreKeys.GPUCrashCount);
  store.delete(EDesktopStoreKeys.LastGPUCrashTime);
  logger.info('GPU crash statistics cleared');
};

// ==================== Boot Recovery ====================
export const getConsecutiveBootFailCount = () =>
  store.get(EDesktopStoreKeys.ConsecutiveBootFailCount, 0);

export const incrementConsecutiveBootFailCount = () => {
  const newCount = getConsecutiveBootFailCount() + 1;
  store.set(EDesktopStoreKeys.ConsecutiveBootFailCount, newCount);
  return newCount;
};

export const resetConsecutiveBootFailCount = () =>
  store.set(EDesktopStoreKeys.ConsecutiveBootFailCount, 0);

export const setConsecutiveBootFailCount = (count: number) =>
  store.set(EDesktopStoreKeys.ConsecutiveBootFailCount, count);

export const getBootFailAppVersion = () =>
  store.get(EDesktopStoreKeys.BootFailAppVersion, '');

export const setBootFailAppVersion = (version: string) =>
  store.set(EDesktopStoreKeys.BootFailAppVersion, version);

// ==================== MMKV Persistent Store ====================
const mmkvAppSettingStore = new Store({ name: 'mmkv-onekey-app-setting' });

export const clearMmkvRecoveryKeys = () => {
  mmkvAppSettingStore.delete('onekey_pending_install_task');
  mmkvAppSettingStore.delete('onekey_whats_new_shown');
  mmkvAppSettingStore.delete('last_valid_server_time');
  mmkvAppSettingStore.delete('last_valid_local_time');
};

/**
 * Checks MMKV for a pending bundle-switch task and applies it before JS bundle loads.
 * Only handles the happy path (status=pending, bundle exists, env matches).
 * All complex logic (retry, download, error handling) remains in JS layer.
 */
export const processPreLaunchPendingTask = (): boolean => {
  try {
    const taskJson = mmkvAppSettingStore.get('onekey_pending_install_task') as
      | string
      | undefined;
    if (!taskJson || typeof taskJson !== 'string') return false;

    const task = JSON.parse(taskJson);
    if (task.status !== 'pending') return false;
    if (task.action !== 'switch-bundle') return false;
    if (task.type !== 'jsbundle-switch') return false;

    const now = Date.now();
    if (typeof task.expiresAt !== 'number' || task.expiresAt <= now)
      return false;
    if (task.nextRetryAt && task.nextRetryAt > now) return false;

    // Verify scheduledEnv matches current state (including buildNumber)
    const currentAppVersion = app.getVersion();
    if (task.scheduledEnvAppVersion !== currentAppVersion) return false;

    const scheduledBuildNumber = task.scheduledEnvBuildNumber ?? '';
    const currentBuildNumber = process.env.BUILD_NUMBER ?? '';
    if (
      scheduledBuildNumber &&
      currentBuildNumber &&
      scheduledBuildNumber !== currentBuildNumber
    ) {
      logger.info(
        'processPreLaunchPendingTask: buildNumber changed from',
        scheduledBuildNumber,
        'to',
        currentBuildNumber,
        ', skipping stale task',
      );
      return false;
    }

    const currentBundleData = getUpdateBundleData();
    const currentBundleVersion =
      currentBundleData?.bundleVersion || process.env.BUNDLE_VERSION || '';
    if (task.scheduledEnvBundleVersion !== currentBundleVersion) return false;

    // Extract payload
    const { appVersion, bundleVersion, signature } = task.payload || {};
    if (!appVersion || !bundleVersion || !signature) return false;

    // Verify bundle directory and entry file exist
    const bundleDirName = path.join(app.getPath('userData'), 'onekey-bundle');
    const extractDir = path.join(
      bundleDirName,
      `${appVersion}-${bundleVersion}`,
    );
    if (!fs.existsSync(extractDir)) return false;
    const indexHtmlPath = path.join(extractDir, 'build', 'index.html');
    if (!fs.existsSync(indexHtmlPath)) return false;

    // Apply: set new bundle data
    setUpdateBundleData({ appVersion, bundleVersion, signature });
    setNativeVersion(currentAppVersion);
    if (currentBuildNumber) {
      setNativeBuildNumber(currentBuildNumber);
    }

    // Update MMKV task status → applied_waiting_verify
    // Do NOT set runningStartedAt — a falsy value lets JS skip the
    // 10-minute grace period and verify alignment immediately on boot.
    task.status = 'applied_waiting_verify';
    delete task.runningStartedAt;
    mmkvAppSettingStore.set(
      'onekey_pending_install_task',
      JSON.stringify(task),
    );

    logger.info(
      'processPreLaunchPendingTask: switched to',
      appVersion,
      bundleVersion,
    );
    return true;
  } catch (e) {
    logger.error('processPreLaunchPendingTask failed:', e);
    return false;
  }
};
