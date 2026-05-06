import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  closeAllDialogInstances,
  rootNavigationRef,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { safePushToEarnRoute } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import {
  InvitedByFriendContent,
  InvitedByFriendImage,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InvitedByFriend/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ANDROID_PACKAGE_NAME,
  APP_STORE_DOWNLOAD_WEB_LINK,
  PLAY_STORE_LINK,
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
  ETabEarnRoutes,
  ETabHomeRoutes,
  type ETabHomeRoutes as ETabHomeRoutesType,
  ETabRoutes,
  type ITabHomeParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

// Delay before opening the InvitedByFriend modal after tab navigation.
// Gives the target tab enough time to mount and render before the modal overlay.
const MODAL_OPEN_DELAY_MS = 1500;

// Build an Android intent:// URL that opens the app without sending users to a
// store automatically. The current page is used as browser fallback so users can
// still choose the store option themselves if the app is not installed.
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

function openIOSAppStore() {
  globalThis.location.href = APP_STORE_DOWNLOAD_WEB_LINK;
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

function MobileWebOptionCard({
  icon,
  title,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  onPress: () => void;
}) {
  return (
    <Stack
      borderWidth={1}
      borderColor="$borderStrong"
      borderRadius="$3"
      p="$3"
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
      cursor="pointer"
    >
      <XStack alignItems="center" gap="$3">
        <Stack
          bg="$bgStrong"
          borderRadius="$2"
          p="$2"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name={icon} size="$5" color="$iconSubdued" />
        </Stack>
        <YStack flex={1} gap="$0.5">
          <SizableText size="$bodyLgMedium">{title}</SizableText>
        </YStack>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    </Stack>
  );
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

  const buildMobileDeepLinkUrl = useCallback(
    () =>
      code
        ? uriUtils.buildDeepLinkUrl({
            path: EOneKeyDeepLinkPath.invited_by_friend,
            query: {
              code,
              page,
            },
          })
        : '',
    [code, page],
  );

  const logMobileWebReferralLinkEntry = useCallback(() => {
    defaultLogger.referral.page.enterReferralGuide(code, 'web_mobile_redirect');
    defaultLogger.referral.page.enterFromReferralLink({
      referralCode: code ?? '',
      landingPage: page ? `/app/${page}` : '/app',
      utmSource: 'web_mobile_redirect',
    });
  }, [code, page]);

  const handleOpenMobileApp = useCallback(() => {
    logMobileWebReferralLinkEntry();
    defaultLogger.referral.page.clickAcceptInviteButton({
      referralCode: code ?? '',
      acceptMethod: 'web_no_extension',
    });

    const deepLinkUrl = buildMobileDeepLinkUrl();
    if (!deepLinkUrl) {
      if (platformEnv.isWebMobileIOS) {
        openIOSAppStore();
        return;
      }
      globalThis.location.href = PLAY_STORE_LINK;
      return;
    }

    if (platformEnv.isWebMobileAndroid) {
      const intentUrl = buildAndroidIntentUrl(
        deepLinkUrl,
        globalThis.location.href,
      );
      globalThis.location.href = intentUrl;
      return;
    }

    if (platformEnv.isWebMobileIOS) {
      globalThis.location.href = deepLinkUrl;
      return;
    }

    globalThis.location.href = deepLinkUrl;
  }, [buildMobileDeepLinkUrl, code, logMobileWebReferralLinkEntry]);

  const handleOpenMobileStore = useCallback(() => {
    logMobileWebReferralLinkEntry();
    defaultLogger.referral.page.clickAcceptInviteButton({
      referralCode: code ?? '',
      acceptMethod: 'web_no_extension',
    });

    if (platformEnv.isWebMobileIOS) {
      openIOSAppStore();
      return;
    }

    globalThis.location.href = PLAY_STORE_LINK;
  }, [code, logMobileWebReferralLinkEntry]);

  let storeIcon: React.ComponentProps<typeof Icon>['name'] = 'StoreOutline';
  if (platformEnv.isWebMobileIOS) {
    storeIcon = 'AppleBrand';
  } else if (platformEnv.isWebMobileAndroid) {
    storeIcon = 'GooglePlayBrand';
  }

  const handleShowMobileWebOptions = useCallback(() => {
    const dialog = Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.referral_choose_how_to_bind,
      }),
      showCancelButton: false,
      showConfirmButton: false,
      estimatedContentHeight: 128,
      renderContent: (
        <YStack gap="$2">
          <MobileWebOptionCard
            icon="PhoneOutline"
            title={intl.formatMessage({
              id: ETranslations.open_in_mobile_app,
            })}
            onPress={() => {
              handleOpenMobileApp();
              void dialog.close();
            }}
          />

          <MobileWebOptionCard
            icon={storeIcon}
            title={intl.formatMessage({
              id: ETranslations.global_download_app,
            })}
            onPress={() => {
              handleOpenMobileStore();
              void dialog.close();
            }}
          />
        </YStack>
      ),
    });
  }, [handleOpenMobileApp, handleOpenMobileStore, intl, storeIcon]);

  const mobileWebFooter = (
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
        onPress={handleShowMobileWebOptions}
      >
        {intl.formatMessage({
          id: ETranslations.wallet_subsidy_claim,
        })}
      </Button>
    </XStack>
  );

  // Native / desktop web: process referral after app is unlocked.
  // hasProcessedRef guards against duplicate processing in this effect only;
  // the mobile web path is handled by the explicit chooser above.
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

      const pageName = normalizeReferralLandingPageName(page);
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
        <Page.Footer>{mobileWebFooter}</Page.Footer>
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
