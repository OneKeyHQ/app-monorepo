import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DEFAULT_REFERRAL_URL } from './constants';

function getWebAppUrl() {
  return platformEnv.isDev ? WEB_APP_URL_DEV : WEB_APP_URL;
}

export function useReferralUrl() {
  const { result: summaryInfo, isLoading } = usePromiseResult(
    async () => {
      const code =
        await backgroundApiProxy.serviceReferralCode.getMyReferralCode();
      if (code) {
        return { inviteCode: code };
      }
      return backgroundApiProxy.serviceReferralCode.getSummaryInfo();
    },
    [],
    {
      initResult: undefined,
      watchLoading: true,
    },
  );

  const referralUrl = useMemo(() => {
    if (!summaryInfo?.inviteCode) {
      return DEFAULT_REFERRAL_URL;
    }
    return `${getWebAppUrl()}/r/${summaryInfo.inviteCode}/app/perp`;
  }, [summaryInfo?.inviteCode]);

  const isReady = !isLoading && !!summaryInfo?.inviteCode;

  return { referralUrl, inviteCode: summaryInfo?.inviteCode, isReady };
}
