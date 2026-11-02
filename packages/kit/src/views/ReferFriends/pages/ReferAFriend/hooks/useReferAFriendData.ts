import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useReplaceToReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IPerksOpenEntry,
  IReferralPageTab,
} from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { useInvitePostConfig } from '../../../hooks/useInvitePostConfig';

import { useLoginStatusChange } from './useLoginStatusChange';

export function useReferAFriendData(routeParams?: {
  tab?: IReferralPageTab;
  perksEntry?: IPerksOpenEntry;
}) {
  const replaceToReferFriends = useReplaceToReferFriends();
  const routeParamsRef = useRef(routeParams);
  routeParamsRef.current = routeParams;
  // Logged-in users are redirected to InviteReward, so only load (and render)
  // the poster once logout is confirmed; otherwise it flashes before navigation.
  const [isLoggedOutConfirmed, setIsLoggedOutConfirmed] = useState(false);
  const { postConfig } = useInvitePostConfig({
    enabled: isLoggedOutConfirmed,
  });
  const redirectSignedIn = useCallback(() => {
    const current = routeParamsRef.current;
    void replaceToReferFriends({
      isLoggedIn: true,
      ...(current?.tab ? { tab: current.tab } : null),
      ...(current?.perksEntry ? { perksEntry: current.perksEntry } : null),
    });
  }, [replaceToReferFriends]);

  // Monitor login status changes and auto-navigate when user logs in
  useLoginStatusChange(() => {
    // Pass isLoggedIn: true to skip redundant check since hook already confirmed login
    redirectSignedIn();
  });

  useEffect(() => {
    async function checkLoginAndRedirect() {
      let isLogin = false;
      try {
        isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
      } catch {
        // Fall back to the poster rather than leaving the page blank.
      }
      if (isLogin) {
        redirectSignedIn();
        return;
      }
      setIsLoggedOutConfirmed(true);

      // Handle web-specific URL parameters
      if (
        platformEnv.isWeb &&
        (globalThis?.location.href.includes('utm_source=web_share') ||
          globalThis?.location.href.includes('app=1'))
      ) {
        const parsedURL = new URL(globalThis?.location.href);
        const code = parsedURL.searchParams.get('code');
        const utmSource = parsedURL.searchParams.get('utm_source');
        const url = uriUtils.buildDeepLinkUrl({
          path: EOneKeyDeepLinkPath.invite_share,
          query: {
            utm_source: utmSource || '',
            code: code || '',
          },
        });
        defaultLogger.referral.page.enterReferralGuide(code, utmSource);
        globalThis.location.href = url;
      }
    }

    void checkLoginAndRedirect();
  }, [redirectSignedIn]);

  return {
    postConfig,
  };
}
