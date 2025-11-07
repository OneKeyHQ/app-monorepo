import requestHelper from '@onekeyhq/shared/src/request/requestHelper';

import { checkIsOneKeyDomain } from '../endpoints';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';
import {
  settingsPersistAtom,
  settingsValuePersistAtom,
} from '../states/jotai/atoms/settings';

export function updateInterceptorRequestHelper() {
  requestHelper.overrideMethods({
    checkIsOneKeyDomain,
    getDevSettingsPersistAtom: async () => devSettingsPersistAtom.get(),
    getSettingsPersistAtom: async () => settingsPersistAtom.get(),
    getSettingsValuePersistAtom: async () => settingsValuePersistAtom.get(),
    getIpTableConfig: async () => {
      // Lazy load simpleDb to avoid ensureRunOnBackground check during module initialization
      const { default: simpleDb } = await import(
        '@onekeyhq/kit-bg/src/dbs/simple/simpleDb'
      );
      if (!simpleDb) {
        return null;
      }
      return simpleDb.ipTable.getConfig();
    },
  });
}
