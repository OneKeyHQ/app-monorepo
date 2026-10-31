import { EPrimeEmailOTPScene } from '../consts/primeConsts';
import { ETranslationsMock } from '../locale/enum/translationsMock';

export const PRIME_USER_BANNED_CODE = 90_012;

// The descriptor also works before the next generated locale catalog pull.
export const primeUserBannedMessage = {
  id: ETranslationsMock.error__service_prime_user_banned_error,
  defaultMessage: 'This account has been banned.',
};

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
