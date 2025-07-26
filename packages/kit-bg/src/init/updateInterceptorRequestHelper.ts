import requestHelper from '@onekeyhq/shared/src/request/requestHelper';

import { checkIsOneKeyDomain } from '../endpoints';
import {
  apiEndpointConfigPersistAtom,
  devSettingsPersistAtom,
  settingsPersistAtom,
  settingsValuePersistAtom,
} from '../states/jotai/atoms';

export function updateInterceptorRequestHelper() {
  requestHelper.overrideMethods({
    checkIsOneKeyDomain,
    getDevSettingsPersistAtom: async () => devSettingsPersistAtom.get(),
    getSettingsPersistAtom: async () => settingsPersistAtom.get(),
    getSettingsValuePersistAtom: async () => settingsValuePersistAtom.get(),
    getApiEndpointConfigPersistAtom: async () =>
      apiEndpointConfigPersistAtom.get(),
  });
}
