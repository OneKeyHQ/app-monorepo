import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Page,
  Spinner,
  Stack,
  Toast,
  YStack,
  closeAllDialogInstances,
  rootNavigationRef,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useOneKeyWalletDetection } from '@onekeyhq/kit/src/hooks/useWebDapp/useOneKeyWalletDetection';
import { safePushToEarnRoute } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import { useBindReferralViaExtension } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useBindReferralViaExtension';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ANDROID_PACKAGE_NAME,
  APP_STORE_DOWNLOAD_LINK,
  APP_STORE_DOWNLOAD_WEB_LINK,
  DOWNLOAD_URL,
  PLAY_STORE_LINK,
} from '@onekeyhq/shared/src/config/appConfig';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
  ETabEarnRoutes,
  ETabHomeRoutes,
  type ETabHomeRoutes as ETabHomeRoutesType,
  ETabRoutes,
  type ITabHomeParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { REFERRAL_STEP2_ANCHOR_ID, ReferralWebLanding } from './components';

import type { IReferralVariant } from './components';

// iOS App Store: when `itms-apps://` fails (e.g. restricted profile), fall
// back to the HTTPS web link after this delay.
const IOS_STORE_WEB_FALLBACK_DELAY_MS = 300;

// If the store redirect round-trip takes longer than this, assume the App
// Store actually opened (timer fired late because the page was backgrounded)
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
function buildAndroidIntentUrl(deepLinkUrl: string): string {
  const schemeEnd = deepLinkUrl.indexOf('://');
  if (schemeEnd === -1) {
    return deepLinkUrl;
  }
  const scheme = deepLinkUrl.slice(0, schemeEnd);
  const rest = deepLinkUrl.slice(schemeEnd + 3);
  // Intentionally omit S.browser_fallback_url. With a fallback URL, Chrome
  // navigates to it on miss and reloads the page, killing our 1.5s "app not
  // detected" toast timer. Without one, Chrome stays on the current page and
  // the timer fires correctly. Step 1 still has the explicit download CTA.
  return `intent://${rest}#Intent;scheme=${scheme};package=${ANDROID_PACKAGE_NAME};end`;
}

const waitForNavigationReady = async (until = 3000): Promise<boolean> => {
  await timerUtils.sleepUntil({
    conditionFn: () => !!rootNavigationRef.current,
    until,
  });
  return !!rootNavigationRef.current;
};

enum EReferralLandingPageName {
  Perp = 'perp',
  Perps = 'perps',
  Swap = 'swap',
  Market = 'market',
  Earn = 'earn',
  DeFi = 'defi',
  Discover = 'discover',
}

// Map page parameter to tab routes
const PAGE_TO_TAB_ROUTE: Partial<Record<EReferralLandingPageName, ETabRoutes>> =
  {
    [EReferralLandingPageName.Perp]: ETabRoutes.Perp,
    [EReferralLandingPageName.Perps]: ETabRoutes.Perp,
    [EReferralLandingPageName.Swap]: ETabRoutes.Swap,
    [EReferralLandingPageName.Market]: ETabRoutes.Market,
    [EReferralLandingPageName.Discover]: ETabRoutes.Discovery,
  };

const EARN_PAGE_NAMES = new Set<EReferralLandingPageName>([
  EReferralLandingPageName.Earn,
  EReferralLandingPageName.DeFi,
]);

const normalizeReferralLandingPageName = (
  page?: string,
): EReferralLandingPageName | undefined => {
  const pageLower = page?.toLowerCase();
  return Object.values(EReferralLandingPageName).includes(
    pageLower as EReferralLandingPageName,
  )
    ? (pageLower as EReferralLandingPageName)
    : undefined;
};

const DEFAULT_INVITEE_DISCOUNT = '10%';

const REFERRAL_UTM_SOURCE = {
  webAppStore: 'web_appstore',
  webBindExtension: 'web_bind_extension',
  webBindDeepLink: 'web_bind_deep_link',
  webTradeDeepLink: 'web_trade_deep_link',
  webAlreadyHaveSkip: 'web_already_have_skip',
  deepLink: 'deep_link',
  appLanding: 'app_landing',
} as const;
type IReferralUtmSource =
  (typeof REFERRAL_UTM_SOURCE)[keyof typeof REFERRAL_UTM_SOURCE];

const formatDiscount = (value?: { amount: number; unit: string }) =>
  value ? `${value.amount}${value.unit}` : '';

function redirectToStore() {
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
  if (platformEnv.isWebMobileAndroid) {
    globalThis.location.href = PLAY_STORE_LINK;
    return;
  }
  globalThis.location.href = DOWNLOAD_URL;
}

function openAppViaDeepLink(deepLinkUrl: string) {
  if (!deepLinkUrl) return;
  if (platformEnv.isWebMobileAndroid) {
    globalThis.location.href = buildAndroidIntentUrl(deepLinkUrl);
    return;
  }
  // iOS / desktop web: navigate to the custom scheme directly. iOS 17+ Safari
  // has tightened restrictions on iframe-based deep link injection, so direct
  // navigation has higher success rates. If the scheme is unhandled, the
  // browser shows a prompt; user can fall back to Step 1's explicit download.
  globalThis.location.href = deepLinkUrl;
}

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

  // /r/invite?code=XXX → extract code from URL query params.
  // When the query is missing, return undefined (not the literal "invite") so
  // Step 2 renders the "------" placeholder and disables copy/bind/deep-link.
  const code = useMemo(() => {
    if (routeCode !== 'invite' || !platformEnv.isWeb) return routeCode;
    return (
      new URL(globalThis?.location.href).searchParams.get('code') ?? undefined
    );
  }, [routeCode]);

  const isWeb = platformEnv.isWeb;
  const pageName = useMemo(
    () => normalizeReferralLandingPageName(page),
    [page],
  );
  const variant = useMemo<IReferralVariant>(
    () => (pageName && EARN_PAGE_NAMES.has(pageName) ? 'defi' : 'perps'),
    [pageName],
  );

  const [inviteeDiscount, setInviteeDiscount] = useState(
    DEFAULT_INVITEE_DISCOUNT,
  );

  useEffect(() => {
    if (!isWeb) return;
    let mounted = true;
    void (async () => {
      const config =
        await backgroundApiProxy.serviceReferralCode.getPostConfig();
      if (mounted && config?.inviteeDiscount) {
        setInviteeDiscount(formatDiscount(config.inviteeDiscount));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isWeb]);

  const logEnter = useCallback(
    (utmSource: IReferralUtmSource) => {
      defaultLogger.referral.page.enterReferralGuide(code, utmSource);
      defaultLogger.referral.page.enterFromReferralLink({
        referralCode: code ?? '',
        landingPage: page ? `/app/${page}` : '/app',
        utmSource,
      });
    },
    [code, page],
  );

  const buildDeepLink = useCallback(
    () =>
      code
        ? uriUtils.buildDeepLinkUrl({
            path: EOneKeyDeepLinkPath.invited_by_friend,
            query: { code, page },
          })
        : '',
    [code, page],
  );

  const handleDownload = useCallback(() => {
    logEnter(REFERRAL_UTM_SOURCE.webAppStore);
    redirectToStore();
  }, [logEnter]);

  // 1.5s after firing a deep link, if the page never went to background
  // (visibilityState !== 'hidden'), the OS didn't hand off to OneKey App —
  // either it's not installed, the scheme was blocked (iOS 17+ Safari is
  // strict), or the user dismissed the open-in-app prompt. Toast a hint
  // pointing back to Step 1's explicit download.
  const unhandledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchViaDeepLink = useCallback(
    (utmSource: IReferralUtmSource) => {
      logEnter(utmSource);
      openAppViaDeepLink(buildDeepLink());
      clearTimeout(unhandledTimerRef.current ?? undefined);
      unhandledTimerRef.current = setTimeout(() => {
        if (typeof globalThis.document === 'undefined') return;
        if (globalThis.document.visibilityState === 'hidden') return;
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.referral_web_landing_app_not_detected,
          }),
        });
      }, 1500);
    },
    [logEnter, buildDeepLink, intl],
  );

  // Trade has no extension shortcut: opening the target tab requires the app,
  // not just sign-and-bind.
  const handleTrade = useCallback(
    () => launchViaDeepLink(REFERRAL_UTM_SOURCE.webTradeDeepLink),
    [launchViaDeepLink],
  );

  const { isOneKeyInstalled } = useOneKeyWalletDetection();
  const { bindViaExtension } = useBindReferralViaExtension({
    referralCode: code ?? '',
  });
  const handleBind = useCallback(() => {
    if (!code) return;
    if (isOneKeyInstalled) {
      logEnter(REFERRAL_UTM_SOURCE.webBindExtension);
      void bindViaExtension();
      return;
    }
    launchViaDeepLink(REFERRAL_UTM_SOURCE.webBindDeepLink);
  }, [code, isOneKeyInstalled, bindViaExtension, logEnter, launchViaDeepLink]);

  // Briefly highlight Step 2 after scroll so the focus shift is visible.
  const [isStep2Highlighted, setIsStep2Highlighted] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      clearTimeout(highlightTimerRef.current ?? undefined);
      clearTimeout(unhandledTimerRef.current ?? undefined);
    },
    [],
  );
  const handleScrollToBind = useCallback(() => {
    logEnter(REFERRAL_UTM_SOURCE.webAlreadyHaveSkip);
    if (typeof globalThis.document !== 'undefined') {
      globalThis.document
        .getElementById(REFERRAL_STEP2_ANCHOR_ID)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    clearTimeout(highlightTimerRef.current ?? undefined);
    setIsStep2Highlighted(true);
    highlightTimerRef.current = setTimeout(
      () => setIsStep2Highlighted(false),
      1500,
    );
  }, [logEnter]);

  useFocusEffect(
    useCallback(() => {
      if (!isWeb) return undefined;
      appEventBus.emit(EAppEventBusNames.HideTabBar, true);
      return () => {
        appEventBus.emit(EAppEventBusNames.HideTabBar, false);
      };
    }, [isWeb]),
  );

  // Native / extension only: web platforms render the 3-step UI above and
  // skip this effect. hasProcessedRef guards against duplicate processing.
  const hasProcessedRef = useRef(false);
  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }
    if (isWeb) {
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
        return;
      }

      const utmSource = fromDeepLink
        ? REFERRAL_UTM_SOURCE.deepLink
        : REFERRAL_UTM_SOURCE.appLanding;
      logEnter(utmSource);

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

      const targetTabRoute = pageName
        ? (PAGE_TO_TAB_ROUTE[pageName] ?? ETabRoutes.Market)
        : ETabRoutes.Market;

      if (pageName && EARN_PAGE_NAMES.has(pageName)) {
        await safePushToEarnRoute(navigation, ETabEarnRoutes.EarnHome);
      } else if (targetTabRoute === ETabRoutes.Perp) {
        setPerpPageEnterSource(EPerpPageEnterSource.Referral);
        navigation.switchTab(targetTabRoute);
      } else {
        navigation.switchTab(targetTabRoute);
      }

      modalTimerId = setTimeout(() => {
        void (async () => {
          // Native referral links can arrive while an app-level Dialog is open.
          // Close existing dialogs before pushing the invitation modal.
          if (platformEnv.isNative) {
            await closeAllDialogInstances();
          }
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
          navigation.reset({
            index: 0,
            routes: [{ name: ETabHomeRoutes.TabHome }],
          });
        })();
      }, MODAL_OPEN_DELAY_MS);
    };

    void processReferralLanding();

    return () => {
      mounted = false;
      if (modalTimerId) {
        clearTimeout(modalTimerId);
      }
    };
  }, [
    appIsLocked,
    code,
    page,
    pageName,
    navigation,
    isWeb,
    fromDeepLink,
    logEnter,
  ]);

  if (isWeb) {
    return (
      <Page scrollEnabled>
        <Page.Body>
          <ReferralWebLanding
            code={code}
            variant={variant}
            inviteeDiscount={inviteeDiscount}
            onDownload={handleDownload}
            onScrollToBind={handleScrollToBind}
            onBind={handleBind}
            onTrade={handleTrade}
            isStep2Highlighted={isStep2Highlighted}
          />
        </Page.Body>
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
