import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { WEB_APP_URL } from '@onekeyhq/shared/src/config/appConfig';

import { DEFAULT_REFERRAL_URL } from './constants';

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
    return `${WEB_APP_URL}/r/${summaryInfo.inviteCode}/app/perp`;
  }, [summaryInfo?.inviteCode]);

  const isReady = !isLoading && !!summaryInfo?.inviteCode;

  return { referralUrl, isReady };
}
