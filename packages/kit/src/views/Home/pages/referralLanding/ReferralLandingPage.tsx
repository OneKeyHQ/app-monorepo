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

// Deep-link → store fallback timing constants.
// On mobile web, we attempt to open the app via deep link, then redirect to
// the app store if the page stays visible (i.e. the deep link had no handler).

// How long to wait after firing the deep link before redirecting to the store.
// 1200 ms is a trade-off: long enough for the OS to open the app and trigger
// visibilitychange/pagehide, short enough that the user doesn't stare at a
// blank page.  Empirically validated on iOS 17 Safari & Android Chrome 120+.
const DEEP_LINK_FALLBACK_DELAY_MS = 1200;

// After injecting the hidden iframe for the deep link on iOS, keep it alive
// long enough for the OS to finish handling.  Must be >= DEEP_LINK_FALLBACK_DELAY_MS
// so the iframe is still present when Safari checks for a handler.
const IFRAME_CLEANUP_DELAY_MS = DEEP_LINK_FALLBACK_DELAY_MS + 500; // 1700 ms

// iOS-specific: when `itms-apps://` fails to open the App Store app (e.g.
// restricted profile), we fall back to the HTTPS web link after this delay.
const IOS_STORE_WEB_FALLBACK_DELAY_MS = 300;

// If the store redirect round-trip takes longer than this, assume the App
// Store actually opened (the timer fired late because the page was backgrounded)
// and skip the web fallback.
const IOS_STORE_ELAPSED_THRESHOLD_MS = 1500;

// Delay before opening the InvitedByFriend modal after tab navigation.
// Gives the target tab enough time to mount and render before the modal overlay.
const MODAL_OPEN_DELAY_MS = 1500;

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

  // Mobile web: try deep link then fall back to app store.
  // Isolated from appIsLocked so atom hydration cannot cancel the fallback timer.
  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }
    if (!(platformEnv.isWeb && platformEnv.isWebMobile)) {
      return;
    }

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

    // Track whether the page ever went to background. If the app opened, the page is typically
    // hidden/pagehide, and timers may fire later when the user comes back.
    let didHide = false;
    const markHide = () => {
      didHide = true;
    };
    const onVisibilityChange = () => {
      if (globalThis.document?.visibilityState === 'hidden') {
        markHide();
      }
    };

    globalThis.document?.addEventListener(
      'visibilitychange',
      onVisibilityChange,
    );
    globalThis.addEventListener?.('pagehide', markHide);

    let storeFallbackTimer:
      | ReturnType<typeof globalThis.setTimeout>
      | undefined;

    const redirectToStore = () => {
      if (platformEnv.isWebMobileIOS) {
        // Try the native itms-apps:// scheme first; if blocked, fall back to HTTPS.
        const storeStartTime = Date.now();
        globalThis.location.href = APP_STORE_DOWNLOAD_LINK;
        storeFallbackTimer = globalThis.setTimeout(() => {
          const elapsed = Date.now() - storeStartTime;
          const isVisible =
            globalThis.document?.visibilityState !== 'hidden';
          if (isVisible && elapsed <= IOS_STORE_ELAPSED_THRESHOLD_MS) {
            globalThis.location.href = APP_STORE_DOWNLOAD_WEB_LINK;
          }
        }, IOS_STORE_WEB_FALLBACK_DELAY_MS);
        return;
      }
      globalThis.location.href = storeUrlAuto;
    };

    let iframeRef: HTMLIFrameElement | undefined;

    const openDeepLinkSilently = (url: string) => {
      try {
        const doc = globalThis.document;
        if (doc?.body) {
          const iframe = doc.createElement('iframe');
          iframe.style.display = 'none';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.src = url;
          doc.body.appendChild(iframe);
          iframeRef = iframe;
          globalThis.setTimeout(() => {
            try {
              iframe.remove();
            } catch (removeError) {
              console.error(
                'Failed to remove deep link iframe:',
                removeError,
              );
            }
            iframeRef = undefined;
          }, IFRAME_CLEANUP_DELAY_MS);
          return;
        }
      } catch (error) {
        console.error('Failed to open deep link via iframe:', error);
      }
      globalThis.location.href = url;
    };

    let fallbackTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const armFallbackTimer = () => {
      fallbackTimer = globalThis.setTimeout(() => {
        const isVisible =
          globalThis.document?.visibilityState !== 'hidden';
        if (isVisible && !didHide) {
          redirectToStore();
        }
      }, DEEP_LINK_FALLBACK_DELAY_MS);
    };

    if (deepLinkUrl) {
      armFallbackTimer();

      if (platformEnv.isWebMobileIOS) {
        openDeepLinkSilently(deepLinkUrl);
      } else {
        globalThis.location.href = deepLinkUrl;
      }
    } else {
      redirectToStore();
    }

    return () => {
      if (fallbackTimer) {
        globalThis.clearTimeout(fallbackTimer);
      }
      if (storeFallbackTimer) {
        globalThis.clearTimeout(storeFallbackTimer);
      }
      if (iframeRef) {
        try {
          iframeRef.remove();
        } catch {
          // best-effort cleanup
        }
        iframeRef = undefined;
      }
      globalThis.document?.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );
      globalThis.removeEventListener?.('pagehide', markHide);
    };
    // `code` and `page` come from route.params (useAppRoute), which are set once
    // during navigation and never mutate for this screen instance. They are safe
    // to omit from the dependency array; we list them explicitly so the effect
    // re-runs only if the user navigates here with different params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, page]);

  // Native / desktop web: process referral after app is unlocked.
  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }
    if (platformEnv.isWeb && platformEnv.isWebMobile) {
      return;
    }
    if (appIsLocked) {
      return;
    }

    hasProcessedRef.current = true;

    const processReferralLanding = async () => {
      const isNavigationReady = await waitForNavigationReady();
      if (!isNavigationReady) {
        if (platformEnv.isWeb) {
          globalThis.location.href = '/';
        }
        return;
      }

      defaultLogger.referral.page.enterReferralGuide(code, 'app_landing');

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

      const pageLower = page?.toLowerCase() ?? '';
      const targetTabRoute = PAGE_TO_TAB_ROUTE[pageLower] ?? ETabRoutes.Market;

      navigation.switchTab(targetTabRoute);

      setTimeout(() => {
        navigation.pushModal(EModalRoutes.ReferFriendsModal, {
          screen: EModalReferFriendsRoutes.InvitedByFriend,
          params: {
            code,
            page,
          },
        });
      }, MODAL_OPEN_DELAY_MS);
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
