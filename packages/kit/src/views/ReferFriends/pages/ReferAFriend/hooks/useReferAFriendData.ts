import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';
import { ETabReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { useLoginStatusChange } from './useLoginStatusChange';

export function useReferAFriendData() {
  const navigation = useAppNavigation();
  const [postConfig, setPostConfig] = useState<IInvitePostConfig | undefined>(
    undefined,
  );

  // Monitor login status changes and auto-navigate when user logs in
  useLoginStatusChange(() => {
    navigation.replace(ETabReferFriendsRoutes.TabInviteReward);
  });

  useEffect(() => {
    // Fetch post configuration
    void backgroundApiProxy.serviceReferralCode
      .getPostConfig()
      .then((config: IInvitePostConfig | undefined) => {
        setPostConfig(config);
        void backgroundApiProxy.serviceReferralCode
          .fetchPostConfig()
          .then(setPostConfig);
      });

    // Check login status and handle redirects
    void backgroundApiProxy.servicePrime.isLoggedIn().then((isLogin) => {
      if (isLogin) {
        navigation.push(ETabReferFriendsRoutes.TabInviteReward);
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
    });
  }, [navigation]);

  return {
    postConfig,
  };
}
