import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  ONEKEY_TEST_URL,
  ONEKEY_URL,
  WEB_APP_URL_SHORT,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { createReferralLandingRequestGuard } from './referralLandingRequestGuard';

const URL_PROTOCOL_PREFIX_REGEXP = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//u;
const VALID_REFERRAL_CODE = /^[a-zA-Z0-9_-]{1,32}$/;

const REFERRAL_LANDING_ROOT_HOSTS = [
  new URL(ONEKEY_URL).hostname,
  new URL(ONEKEY_TEST_URL).hostname,
  new URL(WEB_APP_URL_SHORT).hostname,
];

function isReferralLandingHost(hostname: string): boolean {
  return REFERRAL_LANDING_ROOT_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export function isValidReferralCode(code: unknown): code is string {
  return typeof code === 'string' && VALID_REFERRAL_CODE.test(code);
}

export type IReferralLandingLinkParams = {
  code: string;
  page: string;
};

type IReferralLandingRouteParams = IReferralLandingLinkParams & {
  fromDeepLink: boolean;
  referralRequestId: number;
};

function navigateToReferralLandingRoute({
  navigation,
  params,
}: {
  navigation: IAppNavigation;
  params: IReferralLandingRouteParams;
}) {
  navigation.navigate(ERootRoutes.Main, {
    screen: ETabRoutes.Home,
    params: {
      screen: ETabHomeRoutes.TabHomeReferralLanding,
      params,
    },
  });
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseUrlLike(value: string): URL | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }

  const normalizedValue = URL_PROTOCOL_PREFIX_REGEXP.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;
  try {
    return new URL(normalizedValue);
  } catch {
    return undefined;
  }
}

export function parseReferralLandingUrl(
  url: string,
): IReferralLandingLinkParams | undefined {
  const parsedUrl = parseUrlLike(url);
  if (!parsedUrl || parsedUrl.protocol !== 'https:') {
    return undefined;
  }

  if (!isReferralLandingHost(parsedUrl.hostname.toLowerCase())) {
    return undefined;
  }

  const pathParts = parsedUrl.pathname
    .split('/')
    .filter(Boolean)
    .map(safeDecodeURIComponent);
  const [prefix, code, appSegment, page, extraSegment] = pathParts;
  if (prefix !== 'r' || !code || extraSegment) {
    return undefined;
  }
  if (!isValidReferralCode(code)) {
    return undefined;
  }
  if (!appSegment) {
    return { code, page: '' };
  }
  if (appSegment !== 'app') {
    return undefined;
  }
  return { code, page: page ?? '' };
}

export async function navigateToReferralLanding({
  code,
  page,
  navigation,
  fromDeepLink = true,
  times = 0,
  skipOverlayGuard,
  shouldContinue,
  referralRequestId,
}: IReferralLandingLinkParams & {
  navigation?: IAppNavigation;
  fromDeepLink?: boolean;
  times?: number;
  skipOverlayGuard?: boolean;
  shouldContinue?: () => boolean;
  referralRequestId?: number;
}): Promise<boolean> {
  const {
    requestId: currentReferralRequestId,
    shouldContinue: isCurrentReferralRequest,
  } = createReferralLandingRequestGuard({
    requestId: referralRequestId,
    shouldContinue,
  });

  if (times > 10) {
    return false;
  }

  const appNavigation = navigation ?? appGlobals.$rootAppNavigation;
  if (!appNavigation) {
    if (!isCurrentReferralRequest()) {
      return false;
    }
    setTimeout(() => {
      void navigateToReferralLanding({
        code,
        page,
        fromDeepLink,
        times: times + 1,
        skipOverlayGuard,
        shouldContinue,
        referralRequestId: currentReferralRequestId,
      });
    }, 1500);
    return true;
  }

  if (!isCurrentReferralRequest()) {
    return false;
  }

  if (!skipOverlayGuard) {
    const { showReferralBlockingOverlayToast } =
      await import('./referralLandingOverlayGuard');
    if (!isCurrentReferralRequest()) {
      return false;
    }
    if (
      showReferralBlockingOverlayToast({
        shouldContinue: isCurrentReferralRequest,
        onContinue: async ({ shouldContinue: shouldContinueAfterToast }) => {
          await navigateToReferralLanding({
            code,
            page,
            navigation: appGlobals.$rootAppNavigation ?? appNavigation,
            fromDeepLink,
            skipOverlayGuard: true,
            shouldContinue: () =>
              isCurrentReferralRequest() && shouldContinueAfterToast(),
            referralRequestId: currentReferralRequestId,
          });
        },
      })
    ) {
      return true;
    }
  }

  await timerUtils.wait(50);
  if (!isCurrentReferralRequest()) {
    return false;
  }
  navigateToReferralLandingRoute({
    navigation: appNavigation,
    params: {
      code,
      page,
      fromDeepLink,
      referralRequestId: currentReferralRequestId,
    },
  });
  return true;
}

export async function handleReferralLandingUrl({
  url,
  navigation,
  fromDeepLink,
}: {
  url: string;
  navigation?: IAppNavigation;
  fromDeepLink?: boolean;
}): Promise<boolean> {
  const params = parseReferralLandingUrl(url);
  if (!params) {
    return false;
  }

  return navigateToReferralLanding({
    ...params,
    navigation,
    fromDeepLink,
  });
}
