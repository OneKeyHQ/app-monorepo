import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';

function getDefaultDevOnlyPassword() {
  if (process.env.NODE_ENV !== 'production') {
    return `${formatDateFns(new Date(), 'yyyyMMdd')}-onekey-debug`;
  }

  return '';
}

let cachedDevOnlyPassword = getDefaultDevOnlyPassword();

export function getCachedDevOnlyPassword() {
  return cachedDevOnlyPassword;
}

export function cacheDevOnlyPassword(password: string | undefined) {
  if (!password) {
    return;
  }

  cachedDevOnlyPassword = password;
}

export function clearCachedDevOnlyPassword(password?: string) {
  if (password !== undefined && password !== cachedDevOnlyPassword) {
    return;
  }

  cachedDevOnlyPassword = getDefaultDevOnlyPassword();
}
