import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';

export const KEYLESS_DELETION_PATH = '/keyless-deletion';
export const KEYLESS_OAUTH_MARKER = 'onekey_keyless_deletion';

export function getKeylessSite(url: URL) {
  if (url.origin === WEB_APP_URL) return 'prod';
  if (url.origin === WEB_APP_URL_DEV) return 'test';
  if (
    process.env.NODE_ENV !== 'production' &&
    url.protocol === 'http:' &&
    url.hostname === '127.0.0.1'
  ) {
    return 'local';
  }
  return undefined;
}

function readInvitation(url: URL) {
  if (url.search || !getKeylessSite(url)) return '';
  const raw = url.hash.slice(1);
  try {
    decodeURIComponent(raw);
  } catch {
    return '';
  }
  const params = new URLSearchParams(raw);
  return params.size === 1 ? (params.get('invitationToken') ?? '') : '';
}

export function getKeylessEntry(url: URL) {
  const path = url.pathname.replace(/\/$/, '');
  if (path === KEYLESS_DELETION_PATH) {
    return {
      kind: 'invitation',
      invitationToken: readInvitation(url),
    } as const;
  }
  if (
    path === '/oauth_callback_web' &&
    url.searchParams.get(KEYLESS_OAUTH_MARKER) === '1'
  ) {
    return { kind: 'callback' } as const;
  }
  return undefined;
}
