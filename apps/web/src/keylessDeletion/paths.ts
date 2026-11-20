export const KEYLESS_OAUTH_MARKER = 'onekey_keyless_deletion';
export const KEYLESS_DELETION_SUPPORT_EMAIL = 'legal@onekey.so';

export function getKeylessRouteKind(url: URL) {
  const path = url.pathname.replace(/\/$/, '');
  if (path === '/keyless-deletion') return 'invitation';
  if (
    path === '/oauth_callback_web' &&
    url.searchParams.get(KEYLESS_OAUTH_MARKER) === '1'
  ) {
    return 'callback';
  }
  return undefined;
}
