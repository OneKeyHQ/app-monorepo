import requestHelper from '@onekeyhq/shared/src/request/requestHelper';

import { checkIsOneKeyDomain } from '../endpoints';
import {
  settingsPersistAtom,
  settingsValuePersistAtom,
} from '../states/jotai/atoms';

export function updateInterceptorRequestHelper() {
  requestHelper.checkIsOneKeyDomain = checkIsOneKeyDomain;
  requestHelper.getSettingsPersistAtom = async () => settingsPersistAtom.get();
  requestHelper.getSettingsValuePersistAtom = async () =>
    settingsValuePersistAtom.get();
}
