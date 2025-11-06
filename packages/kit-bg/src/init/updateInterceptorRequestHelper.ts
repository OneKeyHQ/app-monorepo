import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';
import { DEFAULT_IP_TABLE_CONFIG } from '@onekeyhq/shared/src/request/constants/ipTableDefaults';
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
      if (!simpleDb) {
        return null;
      }
      return simpleDb.ipTable.getConfig();
    },
  });
}
