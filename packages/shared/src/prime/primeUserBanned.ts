import { EPrimeEmailOTPScene } from '../consts/primeConsts';
import { ETranslations } from '../locale/enum/translations';

import type { IPrimeUserInfo } from '../../types/prime/primeTypes';

export const PRIME_USER_BANNED_CODE = 90_012;

export const primeUserBannedMessage = {
  id: ETranslations.error__service_prime_user_banned_error,
  defaultMessage: 'This account has been banned.',
};

export function getLoggedInOneKeyIdUserId(
  user: Pick<
    IPrimeUserInfo,
    'isLoggedIn' | 'isLoggedInOnServer' | 'onekeyUserId'
  >,
) {
  return user.isLoggedIn && user.isLoggedInOnServer
    ? user.onekeyUserId
    : undefined;
}

type IPrimeUserBannedMockEnvironment = {
  isDev?: boolean;
  isDesktop?: boolean;
};

// Keep error definitions independent of platform initialization and its imports.
export function isPrimeUserBannedMockEnabled(
  devSettings:
    | {
        enabled?: boolean;
        settings?: { mockPrimeUserBanned?: boolean };
      }
    | undefined,
  environment: IPrimeUserBannedMockEnvironment,
) {
  return Boolean(
    environment.isDev &&
    environment.isDesktop &&
    devSettings?.enabled === true &&
    devSettings.settings?.mockPrimeUserBanned === true,
  );
}

export function isPrimeUserBannedMockError(
  error: unknown,
  environment: IPrimeUserBannedMockEnvironment,
) {
  return Boolean(
    environment.isDev &&
    environment.isDesktop &&
    (error as { data?: { primeUserBannedMock?: boolean } } | null)?.data
      ?.primeUserBannedMock,
  );
}

export function isPrimeUserBannedError(error: unknown): boolean {
  const value = error as {
    code?: unknown;
    data?: { code?: unknown };
    response?: { data?: { code?: unknown } };
  } | null;
  return (
    Number(value?.code) === PRIME_USER_BANNED_CODE ||
    Number(value?.data?.code) === PRIME_USER_BANNED_CODE ||
    Number(value?.response?.data?.code) === PRIME_USER_BANNED_CODE
  );
}

export function isOneKeyIdFeatureRequest(url = '') {
  return (
    url.startsWith('/prime/v1/') ||
    url.startsWith('/rebate/') ||
    url.startsWith('/wallet/v1/account/transaction/export-task/')
  );
}

export function isPrimeBannedAccountRecoveryRequest({
  url,
  method,
  data,
}: {
  url?: string;
  method?: string;
  data?: unknown;
}): boolean {
  const path = (url || '').split('?')[0];
  const verb = method?.toLowerCase();
  if (verb === 'get') {
    return (
      path === '/prime/v1/account/profile' || path === '/prime/v1/user/info'
    );
  }
  if (verb !== 'post') {
    return false;
  }
  if (
    [
      '/prime/v1/user/delete',
      '/prime/v1/user/logout',
      '/prime/v1/user/login',
      '/prime/v1/account/oauth/login',
    ].includes(path)
  ) {
    return true;
  }
  if (path !== '/prime/v1/general/emailOTP') {
    return false;
  }
  let body: unknown = data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return false;
    }
  }
  return (
    typeof body === 'object' &&
    body !== null &&
    'scene' in body &&
    body.scene === EPrimeEmailOTPScene.DeleteOneKeyId
  );
}
