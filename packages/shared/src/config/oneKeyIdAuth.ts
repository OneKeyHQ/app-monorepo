import { ONEKEY_ID_AUTH_CONFIG } from '../consts/authConsts';
import requestHelper from '../request/requestHelper';

export function getOneKeyIdAuthConfigByDevSettings(devSettings: {
  enabled: boolean;
  settings?: { enableTestEndpoint?: boolean };
}) {
  return devSettings.enabled && devSettings.settings?.enableTestEndpoint
    ? ONEKEY_ID_AUTH_CONFIG.test
    : ONEKEY_ID_AUTH_CONFIG.prod;
}

export async function getOneKeyIdAuthConfig() {
  return getOneKeyIdAuthConfigByDevSettings(
    await requestHelper.getDevSettingsPersistAtom(),
  );
}
