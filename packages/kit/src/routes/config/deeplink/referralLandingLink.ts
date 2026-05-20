import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  ONEKEY_TEST_URL,
  ONEKEY_URL,
  WEB_APP_URL_SHORT,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETabHomeRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

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

export type IReferralLandingLinkParams = {
  code: string;
  page: string;
};

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
  if (!VALID_REFERRAL_CODE.test(code)) {
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
}: IReferralLandingLinkParams & {
  navigation?: IAppNavigation;
  fromDeepLink?: boolean;
  times?: number;
}): Promise<boolean> {
  if (times > 10) {
    return false;
  }

  const appNavigation = navigation ?? appGlobals.$rootAppNavigation;
  if (!appNavigation) {
    setTimeout(() => {
      void navigateToReferralLanding({
        code,
        page,
        fromDeepLink,
        times: times + 1,
      });
    }, 1500);
    return true;
  }

  appNavigation.switchTab(ETabRoutes.Home);
  await timerUtils.wait(50);
  appNavigation.push(ETabHomeRoutes.TabHomeReferralLanding, {
    code,
    page,
    fromDeepLink,
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
