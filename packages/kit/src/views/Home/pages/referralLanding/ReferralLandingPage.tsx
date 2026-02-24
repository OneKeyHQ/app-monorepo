import { useEffect, useRef } from 'react';

import {
  Page,
  Spinner,
  Stack,
  YStack,
  rootNavigationRef,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  APP_STORE_DOWNLOAD_LINK,
  APP_STORE_DOWNLOAD_WEB_LINK,
  DOWNLOAD_MOBILE_APP_URL,
  PLAY_STORE_LINK,
} from '@onekeyhq/shared/src/config/appConfig';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  type ETabHomeRoutes as ETabHomeRoutesType,
  ETabRoutes,
  type ITabHomeParamList,
} from '@onekeyhq/shared/src/routes';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

// Wait for navigation to be ready
const waitForNavigationReady = async (maxWaitMs = 3000): Promise<boolean> => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (rootNavigationRef.current) {
      return true;
    }
    await timerUtils.wait(100);
  }
  return false;
};

// Map page parameter to tab routes
const PAGE_TO_TAB_ROUTE: Record<string, ETabRoutes> = {
  perp: ETabRoutes.Perp,
  perps: ETabRoutes.Perp,
  swap: ETabRoutes.Swap,
  market: ETabRoutes.Market,
  earn: ETabRoutes.Earn,
  defi: ETabRoutes.Earn,
  discover: ETabRoutes.Discovery,
};

function ReferralLandingPage() {
  const route = useAppRoute<
    ITabHomeParamList,
    ETabHomeRoutesType.TabHomeReferralLanding
  >();
  const navigation = useAppNavigation();
  const [appIsLocked] = useAppIsLockedAtom();

  const hasProcessedRef = useRef(false);

  const routeParams = route.params as
    | { code: string; page?: string }
    | undefined;
  const routeCode = routeParams?.code;
  const page = routeParams?.page;

  // Handle /r/invite?code=XXX case - extract code from URL query params
  let code = routeCode;
  if (routeCode === 'invite' && platformEnv.isWeb) {
    const parsedURL = new URL(globalThis?.location.href);
    const queryCode = parsedURL.searchParams.get('code');
    if (queryCode) {
      code = queryCode;
    }
  }

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }

    // Mobile browsers should open the app (if installed) or fall back to the store.
    // Universal Links may not trigger when the URL is pasted into the address bar.
    if (platformEnv.isWeb && platformEnv.isWebMobile) {
      hasProcessedRef.current = true;

      const storeUrlAuto = platformEnv.isWebMobileIOS
        ? APP_STORE_DOWNLOAD_WEB_LINK
        : platformEnv.isWebMobileAndroid
          ? PLAY_STORE_LINK
          : DOWNLOAD_MOBILE_APP_URL;

      const deepLinkUrl = code
        ? uriUtils.buildDeepLinkUrl({
            path: EOneKeyDeepLinkPath.invited_by_friend,
            query: {
              code,
              page,
            },
          })
        : '';

      defaultLogger.referral.page.enterReferralGuide(
        code,
        'web_mobile_redirect',
      );

      const startTime = Date.now();
      const fallbackDelayMs = 1200;
      // If we don't redirect around the expected time window, it's likely the app opened
      // (timers get throttled/paused in background) and the user returned later.
      const maxElapsedForFallbackMs = fallbackDelayMs + 2500;

      const redirectToStore = () => {
        if (platformEnv.isWebMobileIOS) {
          // Try to open the App Store app first; fall back to the web page if blocked.
          const storeStartTime = Date.now();
          globalThis.location.href = APP_STORE_DOWNLOAD_LINK;
          globalThis.setTimeout(() => {
            const elapsed = Date.now() - storeStartTime;
            const isVisible = globalThis.document?.visibilityState !== 'hidden';
            if (isVisible && elapsed <= 1500) {
              globalThis.location.href = APP_STORE_DOWNLOAD_WEB_LINK;
            }
          }, 300);
          return;
        }
        globalThis.location.href = storeUrlAuto;
      };

      const openDeepLinkSilently = (url: string) => {
        try {
          const doc = globalThis.document;
          if (doc?.body) {
            // Use an iframe to avoid breaking the current page on iOS when the app isn't installed.
            const iframe = doc.createElement('iframe');
            iframe.style.display = 'none';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.src = url;
            doc.body.appendChild(iframe);
            globalThis.setTimeout(() => {
              try {
                iframe.remove();
              } catch {
                // ignore
              }
            }, 800);
            return;
          }
        } catch {
          // ignore
        }
        globalThis.location.href = url;
      };

      const fallbackTimer = globalThis.setTimeout(() => {
        const elapsed = Date.now() - startTime;
        const isVisible = globalThis.document?.visibilityState !== 'hidden';
        if (isVisible && elapsed <= maxElapsedForFallbackMs) {
          redirectToStore();
        }
      }, fallbackDelayMs);

      if (deepLinkUrl) {
        if (platformEnv.isWebMobileIOS) {
          openDeepLinkSilently(deepLinkUrl);
        } else {
          globalThis.location.href = deepLinkUrl;
        }
      } else {
        redirectToStore();
      }

      return () => {
        globalThis.clearTimeout(fallbackTimer);
      };
    }

    // Process referral landing after app is unlocked
    if (appIsLocked) {
      return;
    }

    hasProcessedRef.current = true;

    const processReferralLanding = async () => {
      // Wait for navigation system to be ready
      const isNavigationReady = await waitForNavigationReady();
      if (!isNavigationReady) {
        // Navigation system not ready, fallback to web redirect
        if (platformEnv.isWeb) {
          globalThis.location.href = '/';
        }
        return;
      }

      // Log the referral landing
      defaultLogger.referral.page.enterReferralGuide(code, 'app_landing');

      // Save referral code to perp DB if page is perp-related
      if (code && (page === 'perp' || page === 'perps')) {
        try {
          await backgroundApiProxy.simpleDb.perp.setPerpData((prev) => ({
            ...prev,
            referralCode: code,
          }));
        } catch (error) {
          console.error('Failed to save referral code to perp DB:', error);
        }
      }

      // Determine target tab route (default to Market)
      const pageLower = page?.toLowerCase() ?? '';
      const targetTabRoute = PAGE_TO_TAB_ROUTE[pageLower] ?? ETabRoutes.Market;

      // Navigate to target page
      navigation.switchTab(targetTabRoute);

      // Open InvitedByFriend modal after navigation
      setTimeout(() => {
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: EModalReferFriendsRoutes.InvitedByFriend,
          params: {
            code,
            page,
          },
        });
      }, 1500);
    };

    void processReferralLanding();
  }, [appIsLocked, code, page, navigation]);

  return (
    <Page>
      <Page.Body>
        <YStack flex={1} ai="center" jc="center">
          <Stack>
            <Spinner size="large" />
          </Stack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export { ReferralLandingPage };
