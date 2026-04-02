import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  Spinner,
  Stack,
  XStack,
  YStack,
  rootNavigationRef,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  InvitedByFriendContent,
  InvitedByFriendImage,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InvitedByFriend/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ANDROID_PACKAGE_NAME,
  APP_STORE_DOWNLOAD_LINK,
  APP_STORE_DOWNLOAD_WEB_LINK,
  DOWNLOAD_MOBILE_APP_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  type ETabHomeRoutes as ETabHomeRoutesType,
  ETabRoutes,
  type ITabHomeParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

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

// Build an Android intent:// URL with built-in Play Store fallback.
// Chrome (and Chromium-based browsers) handles this natively: opens the app if
// installed, otherwise redirects to S.browser_fallback_url.
// Using location.href with a raw custom scheme (onekey-wallet://) on Android
// navigates to an ERR_UNKNOWN_URL_SCHEME error page, destroying the JS context
// and any fallback timers.
function buildAndroidIntentUrl(
  deepLinkUrl: string,
  fallbackUrl: string,
): string {
  const schemeEnd = deepLinkUrl.indexOf('://');
  if (schemeEnd === -1) {
    return fallbackUrl;
  }
  const scheme = deepLinkUrl.slice(0, schemeEnd);
  const rest = deepLinkUrl.slice(schemeEnd + 3);
  return `intent://${rest}#Intent;scheme=${scheme};package=${ANDROID_PACKAGE_NAME};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

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
  const intl = useIntl();
  const [appIsLocked] = useAppIsLockedAtom();

  const routeParams = route.params as
    | { code: string; page?: string; fromDeepLink?: boolean }
    | undefined;
  const routeCode = routeParams?.code;
  const page = routeParams?.page;
  const fromDeepLink = routeParams?.fromDeepLink;

  // Handle /r/invite?code=XXX case - extract code from URL query params
  let code = routeCode;
  if (routeCode === 'invite' && platformEnv.isWeb) {
    const parsedURL = new URL(globalThis?.location.href);
    const queryCode = parsedURL.searchParams.get('code');
    if (queryCode) {
      code = queryCode;
    }
  }

  const isMobileWeb = platformEnv.isWeb && platformEnv.isWebMobile;

  const [isJoining, setIsJoining] = useState(false);

  // Mobile web: user presses "Join" → try deep link, fall back to app store.
  const handleMobileWebJoin = useCallback(() => {
    if (isJoining) {
      return;
    }
    setIsJoining(true);
    const storeUrlAuto = platformEnv.isWebMobileIOS
      ? APP_STORE_DOWNLOAD_WEB_LINK
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

    defaultLogger.referral.page.enterReferralGuide(code, 'web_mobile_redirect');
    defaultLogger.referral.page.enterFromReferralLink({
      referralCode: code ?? '',
      landingPage: page ? `/app/${page}` : '/app',
      utmSource: 'web_mobile_redirect',
    });

    const redirectToStore = () => {
      if (platformEnv.isWebMobileIOS) {
        const storeStartTime = Date.now();
        globalThis.location.href = APP_STORE_DOWNLOAD_LINK;
        globalThis.setTimeout(() => {
          const elapsed = Date.now() - storeStartTime;
          const isVisible = globalThis.document?.visibilityState !== 'hidden';
          if (isVisible && elapsed <= IOS_STORE_ELAPSED_THRESHOLD_MS) {
            globalThis.location.href = APP_STORE_DOWNLOAD_WEB_LINK;
          }
        }, IOS_STORE_WEB_FALLBACK_DELAY_MS);
        return;
      }
      globalThis.location.href = storeUrlAuto;
    };

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
          globalThis.setTimeout(() => {
            try {
              iframe.remove();
            } catch (removeError) {
              console.error('Failed to remove deep link iframe:', removeError);
            }
          }, IFRAME_CLEANUP_DELAY_MS);
          return;
        }
      } catch (error) {
        console.error('Failed to open deep link via iframe:', error);
      }
      globalThis.location.href = url;
    };

    if (deepLinkUrl) {
      if (platformEnv.isWebMobileAndroid) {
        const intentUrl = buildAndroidIntentUrl(
          deepLinkUrl,
          DOWNLOAD_MOBILE_APP_URL,
        );
        globalThis.location.href = intentUrl;
      } else if (platformEnv.isWebMobileIOS) {
        const armTime = Date.now();
        globalThis.setTimeout(() => {
          const elapsed = Date.now() - armTime;
          const isVisible = globalThis.document?.visibilityState !== 'hidden';
          const timerFiredLate = elapsed > DEEP_LINK_FALLBACK_DELAY_MS * 2;
          if (isVisible && !timerFiredLate) {
            redirectToStore();
          }
        }, DEEP_LINK_FALLBACK_DELAY_MS);
        openDeepLinkSilently(deepLinkUrl);
      } else {
        globalThis.setTimeout(() => {
          const isVisible = globalThis.document?.visibilityState !== 'hidden';
          if (isVisible) {
            redirectToStore();
          }
        }, DEEP_LINK_FALLBACK_DELAY_MS);
        globalThis.location.href = deepLinkUrl;
      }
    } else {
      redirectToStore();
    }
  }, [code, page, isJoining]);

  // Native / desktop web: process referral after app is unlocked.
  // hasProcessedRef guards against duplicate processing in this effect only;
  // the mobile web path is handled by handleMobileWebJoin (user-initiated).
  const hasProcessedRef = useRef(false);
  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }
    if (isMobileWeb) {
      return;
    }
    if (appIsLocked) {
      return;
    }

    hasProcessedRef.current = true;

    let mounted = true;
    let modalTimerId: ReturnType<typeof setTimeout> | undefined;

    const processReferralLanding = async () => {
      const isNavigationReady = await waitForNavigationReady();
      if (!mounted) {
        return;
      }
      if (!isNavigationReady) {
        if (platformEnv.isWeb) {
          globalThis.location.href = '/';
        }
        return;
      }

      const utmSource = fromDeepLink ? 'deep_link' : 'app_landing';
      defaultLogger.referral.page.enterReferralGuide(code, utmSource);
      defaultLogger.referral.page.enterFromReferralLink({
        referralCode: code ?? '',
        landingPage: page ? `/app/${page}` : '/app',
        utmSource,
      });

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

      if (targetTabRoute === ETabRoutes.Perp) {
        setPerpPageEnterSource(EPerpPageEnterSource.Referral);
      }
      navigation.switchTab(targetTabRoute);

      modalTimerId = setTimeout(() => {
        if (!mounted) {
          return;
        }
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

    return () => {
      mounted = false;
      if (modalTimerId) {
        clearTimeout(modalTimerId);
      }
    };
  }, [appIsLocked, code, page, navigation, isMobileWeb, fromDeepLink]);

  if (isMobileWeb) {
    return (
      <Page scrollEnabled>
        <Page.Body>
          <YStack pb="$5" maxWidth={640} mx="auto" flex={1}>
            <InvitedByFriendImage />
            <InvitedByFriendContent referralCode={code} />
          </YStack>
        </Page.Body>
        <Page.Footer>
          <XStack
            gap="$4"
            w="100%"
            justifyContent="space-between"
            px="$4"
            py="$4"
            bg="$bgApp"
          >
            <Button
              variant="primary"
              flex={1}
              size="large"
              disabled={isJoining}
              loading={isJoining}
              onPress={handleMobileWebJoin}
            >
              {intl.formatMessage({
                id: ETranslations.referral_accept,
              })}
            </Button>
          </XStack>
        </Page.Footer>
      </Page>
    );
  }

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
