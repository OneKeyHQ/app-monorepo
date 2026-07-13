import requestHelper from '@onekeyhq/shared/src/request/requestHelper';

import { checkIsOneKeyDomain } from '../endpoints';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';
import {
  settingsPersistAtom,
  settingsValuePersistAtom,
} from '../states/jotai/atoms/settings';

/**
 * Request interceptor setup — safe to import from any runtime.
 * Does NOT reference simpleDb. On native main thread (split-thread mode),
 * getIpTableConfig returns null. On all other platforms (desktop, web, ext)
 * and on background thread, the full version with simpleDb is installed
 * separately via updateInterceptorRequestHelperWithIpTable (separate file).
 */
export function updateInterceptorRequestHelper() {
  const getIpTableConfig = requestHelper.getIpTableConfig;

  requestHelper.overrideMethods({
    checkIsOneKeyDomain,
    getDevSettingsPersistAtom: async () => devSettingsPersistAtom.get(),
    getSettingsPersistAtom: async () => settingsPersistAtom.get(),
    getSettingsValuePersistAtom: async () => settingsValuePersistAtom.get(),
    getIpTableConfig,
  });
}
