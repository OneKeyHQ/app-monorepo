import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';

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
import { useOneKeyWalletDetection } from '@onekeyhq/kit/src/hooks/useWebDapp/useOneKeyWalletDetection';
import { createReferralLandingRequestGuard } from '@onekeyhq/kit/src/routes/config/deeplink/referralLandingRequestGuard';
import { safePushToEarnRoute } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import { useBindReferralViaExtension } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useBindReferralViaExtension';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import type {
  IClickReferralLandingButtonParams,
  IReferralLandingBindMethod,
} from '@onekeyhq/shared/src/logger/scopes/referral/scenes/page';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETabEarnRoutes,
  type ETabHomeRoutes as ETabHomeRoutesType,
  ETabRoutes,
  type ITabHomeParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import {
  openAppViaDeepLink,
  redirectToStore,
  scheduleDeepLinkFallbackHint,
} from '../../utils/deepLinkLaunchUtils';

import { REFERRAL_STEP2_ANCHOR_ID, ReferralWebLanding } from './components';
import { openReferralInvitedByFriendModalWithGuard } from './referralLandingModalGuard';

import type { IReferralVariant } from './components';

type IReferralLandingRouteName =
  | ETabHomeRoutesType.TabHomeReferralLanding
  | ETabHomeRoutesType.TabHomeReferralLandingWithoutPage
  | ETabHomeRoutesType.TabHomeReferralLandingCodeOnly;

type IReferralLandingRouteParams =
  | ITabHomeParamList[ETabHomeRoutesType.TabHomeReferralLanding]
  | ITabHomeParamList[ETabHomeRoutesType.TabHomeReferralLandingWithoutPage]
  | ITabHomeParamList[ETabHomeRoutesType.TabHomeReferralLandingCodeOnly];
// Delay before opening the InvitedByFriend modal after tab navigation.
// Gives the target tab enough time to mount and render before the modal overlay.
const MODAL_OPEN_DELAY_MS = 1500;

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

const isPerpReferralLandingPage = (
  pageName?: EReferralLandingPageName,
): boolean =>
  pageName === EReferralLandingPageName.Perp ||
  pageName === EReferralLandingPageName.Perps;

async function syncPerpReferralCodeForActiveRequest({
  code,
  pageName,
  shouldContinue,
}: {
  code: string | undefined;
  pageName: EReferralLandingPageName | undefined;
  shouldContinue: () => boolean;
}) {
  if (!code) {
    return true;
  }

  const nextReferralCode = isPerpReferralLandingPage(pageName)
    ? code
    : undefined;

  try {
    await backgroundApiProxy.simpleDb.perp.setPerpData((prev) => {
      if (!shouldContinue()) {
        return prev ?? {};
      }
      if (nextReferralCode) {
        return {
          ...prev,
          referralCode: nextReferralCode,
        };
      }
      if (!prev?.referralCode) {
        return prev ?? {};
      }
      const { referralCode, ...rest } = prev;
      return rest;
    });
  } catch (error) {
    defaultLogger.app.error.log(
      `Failed to sync referral code to perp DB: ${String(error)}`,
    );
  }

  return shouldContinue();
}

function getReferralLandingRouteParams(
  routeParams: IReferralLandingRouteParams | undefined,
): {
  code: string | undefined;
  page: string | undefined;
  fromDeepLink: boolean | undefined;
  referralRequestId: number | undefined;
} {
  return {
    code: routeParams?.code,
    page: routeParams && 'page' in routeParams ? routeParams.page : undefined,
    fromDeepLink:
      routeParams && 'fromDeepLink' in routeParams
        ? routeParams.fromDeepLink
        : undefined,
    referralRequestId:
      routeParams && 'referralRequestId' in routeParams
        ? routeParams.referralRequestId
        : undefined,
  };
}

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

const REFERRAL_LOG_KEY_SEPARATOR = '|';
const REFERRAL_ENTER_DEDUP_WINDOW_MS = 3000;

const buildReferralEntryLogKey = ({
  referralCode,
  landingPage,
  utmSource,
}: {
  referralCode: string | undefined;
  landingPage: string;
  utmSource: IReferralUtmSource;
}) =>
  [referralCode ?? '', landingPage, utmSource].join(REFERRAL_LOG_KEY_SEPARATOR);

function ReferralLandingPage() {
  const route = useAppRoute<ITabHomeParamList, IReferralLandingRouteName>();
  const navigation = useAppNavigation();
  const [appIsLocked] = useAppIsLockedAtom();

  const {
    code: routeCode,
    page,
    fromDeepLink,
    referralRequestId,
  } = getReferralLandingRouteParams(route.params);

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
  const landingPage = useMemo(() => (page ? `/app/${page}` : '/app'), [page]);

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
        landingPage,
        utmSource,
      });
    },
    [code, landingPage],
  );

  const recentWebEnterLogsRef = useRef(new Map<string, number>());
  const logWebEnterDeduped = useCallback(
    (utmSource: IReferralUtmSource) => {
      const logKey = buildReferralEntryLogKey({
        referralCode: code,
        landingPage,
        utmSource,
      });
      const now = Date.now();
      const lastLoggedAt = recentWebEnterLogsRef.current.get(logKey);
      if (
        lastLoggedAt !== undefined &&
        now - lastLoggedAt < REFERRAL_ENTER_DEDUP_WINDOW_MS
      ) {
        return;
      }
      recentWebEnterLogsRef.current.set(logKey, now);
      logEnter(utmSource);
    },
    [code, landingPage, logEnter],
  );

  const loggedPageOpenKeysRef = useRef(new Set<string>());
  useEffect(() => {
    if (!isWeb) return;
    const logKey = `${code ?? ''}${REFERRAL_LOG_KEY_SEPARATOR}${landingPage}`;
    if (loggedPageOpenKeysRef.current.has(logKey)) {
      return;
    }
    loggedPageOpenKeysRef.current.add(logKey);
    defaultLogger.referral.page.referralPageOpen({
      referralCode: code ?? '',
      landingPage,
      pageVariant: variant,
    });
  }, [code, isWeb, landingPage, variant]);

  const logReferralLandingButton = useCallback(
    ({
      buttonName,
      bindMethod,
    }: Pick<
      IClickReferralLandingButtonParams,
      'buttonName' | 'bindMethod'
    >) => {
      const params = {
        referralCode: code ?? '',
        landingPage,
        buttonName,
      };
      defaultLogger.referral.page.clickReferralLandingButton(
        bindMethod
          ? {
              ...params,
              bindMethod,
            }
          : params,
      );
    },
    [code, landingPage],
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
    logReferralLandingButton({ buttonName: 'download_app' });
    logWebEnterDeduped(REFERRAL_UTM_SOURCE.webAppStore);
    redirectToStore();
  }, [logReferralLandingButton, logWebEnterDeduped]);

  const [isDownloadHintVisible, setIsDownloadHintVisible] = useState(false);
  const downloadHintCleanupRef = useRef<(() => void) | null>(null);
  const clearDownloadHintTimer = useCallback(() => {
    downloadHintCleanupRef.current?.();
    downloadHintCleanupRef.current = null;
  }, []);
  const scheduleDownloadHint = useCallback(() => {
    clearDownloadHintTimer();
    setIsDownloadHintVisible(false);

    downloadHintCleanupRef.current = scheduleDeepLinkFallbackHint({
      onFallback: () => setIsDownloadHintVisible(true),
    });
  }, [clearDownloadHintTimer]);

  const launchViaDeepLink = useCallback(
    (utmSource: IReferralUtmSource) => {
      logWebEnterDeduped(utmSource);
      const deepLink = buildDeepLink();
      if (!deepLink) return;
      scheduleDownloadHint();
      openAppViaDeepLink(deepLink);
    },
    [buildDeepLink, logWebEnterDeduped, scheduleDownloadHint],
  );

  const { isOneKeyInstalled } = useOneKeyWalletDetection();
  const { bindViaExtension } = useBindReferralViaExtension({
    referralCode: code ?? '',
  });

  const getBindMethod = useCallback(
    (): IReferralLandingBindMethod =>
      isOneKeyInstalled ? 'web_extension' : 'deep_link',
    [isOneKeyInstalled],
  );

  const startBindFlow = useCallback(
    (bindMethod: IReferralLandingBindMethod, utmSource: IReferralUtmSource) => {
      if (bindMethod === 'web_extension') {
        logWebEnterDeduped(utmSource);
        void bindViaExtension();
        return;
      }
      launchViaDeepLink(utmSource);
    },
    [bindViaExtension, logWebEnterDeduped, launchViaDeepLink],
  );

  const handleBind = useCallback(() => {
    if (!code) return;
    const bindMethod = getBindMethod();
    logReferralLandingButton({
      buttonName: 'bind_invite_code',
      bindMethod,
    });
    startBindFlow(
      bindMethod,
      bindMethod === 'web_extension'
        ? REFERRAL_UTM_SOURCE.webBindExtension
        : REFERRAL_UTM_SOURCE.webBindDeepLink,
    );
  }, [code, getBindMethod, logReferralLandingButton, startBindFlow]);

  const handleCopyCode = useCallback(() => {
    defaultLogger.referral.page.copyReferralCode({
      referralCode: code ?? '',
      landingPage,
    });
  }, [code, landingPage]);

  // Briefly highlight Step 2 after scroll so the focus shift is visible.
  const [isStep2Highlighted, setIsStep2Highlighted] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      clearTimeout(highlightTimerRef.current ?? undefined);
      clearDownloadHintTimer();
    },
    [clearDownloadHintTimer],
  );
  const handleScrollToBind = useCallback(() => {
    const bindMethod = code ? getBindMethod() : undefined;
    logReferralLandingButton(
      bindMethod
        ? {
            buttonName: 'already_have_wallet',
            bindMethod,
          }
        : { buttonName: 'already_have_wallet' },
    );
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
    if (bindMethod) {
      startBindFlow(bindMethod, REFERRAL_UTM_SOURCE.webAlreadyHaveSkip);
    } else {
      logWebEnterDeduped(REFERRAL_UTM_SOURCE.webAlreadyHaveSkip);
    }
  }, [
    code,
    getBindMethod,
    logReferralLandingButton,
    logWebEnterDeduped,
    startBindFlow,
  ]);

  // Trade has no extension shortcut: opening the target tab requires the app,
  // not just sign-and-bind.
  const handleTrade = useCallback(() => {
    logReferralLandingButton({ buttonName: 'trade_now' });
    launchViaDeepLink(REFERRAL_UTM_SOURCE.webTradeDeepLink);
  }, [launchViaDeepLink, logReferralLandingButton]);

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
  // skip this effect. Track a stable request key so reused route instances can
  // still process a newer referral request.
  const processedReferralRequestKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (isWeb) {
      return;
    }
    if (appIsLocked) {
      return;
    }
    const referralRequestKey =
      referralRequestId !== undefined
        ? `request:${referralRequestId}`
        : `route:${code ?? ''}:${page ?? ''}:${fromDeepLink ? '1' : '0'}`;
    if (processedReferralRequestKeyRef.current === referralRequestKey) {
      return;
    }
    processedReferralRequestKeyRef.current = referralRequestKey;

    let mounted = true;
    let modalTimerId: ReturnType<typeof setTimeout> | undefined;
    const { shouldContinue: shouldContinueReferralRequest } =
      createReferralLandingRequestGuard({
        requestId: referralRequestId,
        shouldContinue: () => mounted,
      });

    const processReferralLanding = async () => {
      const isNavigationReady = await waitForNavigationReady();
      if (!shouldContinueReferralRequest()) {
        return;
      }
      if (!isNavigationReady) {
        return;
      }

      const utmSource = fromDeepLink
        ? REFERRAL_UTM_SOURCE.deepLink
        : REFERRAL_UTM_SOURCE.appLanding;
      logEnter(utmSource);

      if (
        !(await syncPerpReferralCodeForActiveRequest({
          code,
          pageName,
          shouldContinue: shouldContinueReferralRequest,
        }))
      ) {
        return;
      }

      const targetTabRoute = pageName
        ? (PAGE_TO_TAB_ROUTE[pageName] ?? ETabRoutes.Market)
        : ETabRoutes.Market;

      if (pageName && EARN_PAGE_NAMES.has(pageName)) {
        await safePushToEarnRoute(navigation, ETabEarnRoutes.EarnHome);
        if (!shouldContinueReferralRequest()) {
          return;
        }
      } else if (targetTabRoute === ETabRoutes.Perp) {
        setPerpPageEnterSource(EPerpPageEnterSource.Referral);
        navigation.switchTab(targetTabRoute);
      } else {
        navigation.switchTab(targetTabRoute);
      }

      modalTimerId = setTimeout(() => {
        if (!shouldContinueReferralRequest()) {
          return;
        }
        openReferralInvitedByFriendModalWithGuard({
          code,
          page,
          navigation,
          shouldContinue: shouldContinueReferralRequest,
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
  }, [
    appIsLocked,
    code,
    page,
    pageName,
    navigation,
    isWeb,
    fromDeepLink,
    referralRequestId,
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
            onCopyCode={handleCopyCode}
            onBind={handleBind}
            onTrade={handleTrade}
            isStep2Highlighted={isStep2Highlighted}
            isDownloadHintVisible={isDownloadHintVisible}
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
