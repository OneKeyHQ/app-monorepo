import { useMemo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';

// The web app that product referral links open; the test host while the dev
// test endpoint is on.
export function useReferralWebAppUrl() {
  const [devSettings] = useDevSettingsPersistAtom();
  const useTestUrl = Boolean(
    devSettings.enabled && devSettings.settings?.enableTestEndpoint,
  );
  return useMemo(
    () => (useTestUrl ? WEB_APP_URL_DEV : WEB_APP_URL),
    [useTestUrl],
  );
}
