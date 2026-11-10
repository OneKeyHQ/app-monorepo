import platformEnv from '@onekeyhq/shared/src/platformEnv';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';

import { checkIsOneKeyDomain } from '../endpoints';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';
import {
  settingsPersistAtom,
  settingsValuePersistAtom,
} from '../states/jotai/atoms/settings';

function isDesktopIsolatedRenderer(): boolean {
  if (!platformEnv.isDesktop || typeof globalThis.location === 'undefined') {
    return false;
  }
  const renderMode = new URLSearchParams(globalThis.location.search ?? '').get(
    'render',
  );
  return renderMode === 'tray' || renderMode === 'prime-purchase';
}

/**
 * Request interceptor setup — safe to import from any runtime.
 * Does NOT reference simpleDb. On native main thread (split-thread mode),
 * getIpTableConfig returns null. On all other platforms (desktop, web, ext)
 * and on background thread, the full version with simpleDb is installed
 * separately via updateInterceptorRequestHelperWithIpTable (separate file).
 */
export function updateInterceptorRequestHelper() {
  if (isDesktopIsolatedRenderer()) {
    // Isolated desktop renderers (?render=tray, ?render=prime-purchase) do not
    // mount KitProvider or run jotaiInit(), so PersistAtom.get() would hang.
    return;
  }
  const getIpTableConfig = requestHelper.getIpTableConfig;

  requestHelper.overrideMethods({
    checkIsOneKeyDomain,
    getDevSettingsPersistAtom: async () => devSettingsPersistAtom.get(),
    getSettingsPersistAtom: async () => settingsPersistAtom.get(),
    getSettingsValuePersistAtom: async () => settingsValuePersistAtom.get(),
    getIpTableConfig,
  });
}
