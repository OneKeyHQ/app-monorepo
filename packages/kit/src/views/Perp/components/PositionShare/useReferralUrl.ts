import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';

export function useReferralUrl() {
  const [devSettings] = useDevSettingsPersistAtom();

  const { result: summaryInfo, isLoading } = usePromiseResult(
    async () => {
      const code =
        await backgroundApiProxy.serviceReferralCode.getMyReferralCode();
      if (code) {
        return { inviteCode: code };
      }
      const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (!isLoggedIn) {
        return null;
      }

      return backgroundApiProxy.serviceReferralCode.getSummaryInfo();
    },
    [],
    {
      initResult: undefined,
      watchLoading: true,
    },
  );

  const webAppUrl = useMemo(() => {
    const useTestUrl =
      devSettings.enabled && devSettings.settings?.enableTestEndpoint;
    return useTestUrl ? WEB_APP_URL_DEV : WEB_APP_URL;
  }, [devSettings.enabled, devSettings.settings?.enableTestEndpoint]);

  const inviteCode = summaryInfo?.inviteCode;
  const defaultReferralUrl = `${webAppUrl}/perps`;

  const referralQrCodeUrl = useMemo(() => {
    if (!inviteCode) {
      return defaultReferralUrl;
    }
    return `${webAppUrl}/r/${inviteCode}/app/perp`;
  }, [inviteCode, webAppUrl, defaultReferralUrl]);

  const referralDisplayText = inviteCode || defaultReferralUrl;

  const isReady = isLoading === false;
  return {
    referralQrCodeUrl,
    referralDisplayText,
    isReady,
  };
}
