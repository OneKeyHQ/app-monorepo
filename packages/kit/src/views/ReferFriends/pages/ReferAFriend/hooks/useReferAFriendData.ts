import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useReplaceToReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { useInvitePostConfig } from '../../../hooks/useInvitePostConfig';

import { useLoginStatusChange } from './useLoginStatusChange';

export function useReferAFriendData() {
  const replaceToReferFriends = useReplaceToReferFriends();
  const { postConfig } = useInvitePostConfig();

  // Monitor login status changes and auto-navigate when user logs in
  useLoginStatusChange(() => {
    // Pass isLoggedIn: true to skip redundant check since hook already confirmed login
    void replaceToReferFriends({ isLoggedIn: true });
  });

  useEffect(() => {
    async function checkLoginAndRedirect() {
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (isLogin) {
        void replaceToReferFriends();
        return;
      }

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
  }, [replaceToReferFriends]);

  return {
    postConfig,
  };
}
