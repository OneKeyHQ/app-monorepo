import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';

const primaryInviteCodeCache = new Map<string, string>();
const inFlightPrimaryInviteCode = new Map<
  string,
  Promise<string | undefined>
>();

async function getPrimaryInviteCode(cacheKey: string) {
  const cached = primaryInviteCodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  let inFlight = inFlightPrimaryInviteCode.get(cacheKey);
  if (!inFlight) {
    inFlight = backgroundApiProxy.serviceReferralCode
      .getSummaryInfo()
      .then((summary) => summary?.inviteCode || undefined)
      .catch(() => undefined);
    inFlightPrimaryInviteCode.set(cacheKey, inFlight);
  }
  try {
    const inviteCode = await inFlight;
    if (inviteCode) {
      primaryInviteCodeCache.set(cacheKey, inviteCode);
    }
    return inviteCode;
  } finally {
    inFlightPrimaryInviteCode.delete(cacheKey);
  }
}

export function useReferralUrl() {
  const [devSettings] = useDevSettingsPersistAtom();
  const [primeUser] = usePrimePersistAtom();

  const useTestUrl =
    devSettings.enabled && devSettings.settings?.enableTestEndpoint;

  const referralCacheKey = useMemo(() => {
    if (!primeUser?.isLoggedInOnServer || !primeUser.onekeyUserId) {
      return undefined;
    }
    const envKey = useTestUrl ? 'dev' : 'prod';
    return `${primeUser.onekeyUserId}:${envKey}`;
  }, [primeUser?.isLoggedInOnServer, primeUser?.onekeyUserId, useTestUrl]);

  const { result: summaryInfo, isLoading } = usePromiseResult(
    async () => {
      if (referralCacheKey) {
        const primaryCode = await getPrimaryInviteCode(referralCacheKey);
        if (primaryCode) {
          return { inviteCode: primaryCode };
        }
        const localCode =
          await backgroundApiProxy.serviceReferralCode.getMyReferralCode();
        if (localCode) {
          return { inviteCode: localCode };
        }
        return null;
      }
      const localCode =
        await backgroundApiProxy.serviceReferralCode.getMyReferralCode();
      if (localCode) {
        return { inviteCode: localCode };
      }

      const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (!isLoggedIn) {
        return null;
      }

      return backgroundApiProxy.serviceReferralCode.getSummaryInfo();
    },
    [referralCacheKey],
    {
      initResult: undefined,
      watchLoading: true,
      undefinedResultIfReRun: true,
    },
  );

  const webAppUrl = useMemo(() => {
    return useTestUrl ? WEB_APP_URL_DEV : WEB_APP_URL;
  }, [useTestUrl]);

  const cachedPrimaryCode = referralCacheKey
    ? primaryInviteCodeCache.get(referralCacheKey)
    : undefined;
  const inviteCode = summaryInfo?.inviteCode || cachedPrimaryCode;
  const defaultReferralUrl = `${webAppUrl}/perps`;

  const referralQrCodeUrl = useMemo(() => {
    if (!inviteCode) {
      return defaultReferralUrl;
    }
    return `${webAppUrl}/r/${inviteCode}/app/perps`;
  }, [inviteCode, webAppUrl, defaultReferralUrl]);

  const referralDisplayText = inviteCode || defaultReferralUrl;

  const isReady = Boolean(inviteCode) || isLoading === false;
  return {
    referralQrCodeUrl,
    referralDisplayText,
    isReady,
  };
}
