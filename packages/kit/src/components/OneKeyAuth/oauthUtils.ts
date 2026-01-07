import { ONEKEY_OAUTH_STATE_KEY } from '@onekeyhq/shared/src/consts/authConsts';

/**
 * Ensures that the redirectTo URL contains ONEKEY_OAUTH_STATE_KEY parameter.
 * If the parameter is missing, generates a cryptographically secure random state
 * and appends it to the URL.
 *
 * Defense-in-depth: Supabase PKCE URL may not include `state`. We embed our own
 * nonce into redirectTo so the callback must carry it back to us.
 *
 * @param redirectTo - The redirect URL to ensure state parameter exists
 * @returns The redirect URL with ONEKEY_OAUTH_STATE_KEY parameter guaranteed to exist, or original URL if crypto is unavailable
 */
export function ensureOneKeyOAuthState(
  redirectTo: string | undefined,
): string | undefined {
  if (!redirectTo) {
    return redirectTo;
  }

  try {
    const redirectUrl = new URL(redirectTo);
    if (!redirectUrl.searchParams.has(ONEKEY_OAUTH_STATE_KEY)) {
      // Prefer crypto-grade random; if unavailable, skip rather than generating weak state.
      const bytes = new Uint8Array(16);
      const cryptoObj = globalThis.crypto as
        | undefined
        | { getRandomValues: (arr: Uint8Array) => Uint8Array };
      if (cryptoObj?.getRandomValues) {
        cryptoObj.getRandomValues(bytes);
        const state = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        redirectUrl.searchParams.set(ONEKEY_OAUTH_STATE_KEY, state);
        return redirectUrl.toString();
      }
    }
    return redirectTo;
  } catch {
    // If URL parsing fails, return original URL
    return redirectTo;
  }
}
