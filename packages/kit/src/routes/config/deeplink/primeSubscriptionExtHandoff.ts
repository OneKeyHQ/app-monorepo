import {
  PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY,
  PRIME_SUBSCRIPTION_EXT_HANDOFF_VALUE,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function consumePrimeSubscriptionHandoffFromUrl(): boolean {
  if (!platformEnv.isExtensionUiExpandTab) {
    return false;
  }
  const hash = globalThis.location?.hash ?? '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) {
    return false;
  }
  const searchParams = new URLSearchParams(hash.slice(queryIndex + 1));
  if (
    searchParams.get(PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY) !==
    PRIME_SUBSCRIPTION_EXT_HANDOFF_VALUE
  ) {
    return false;
  }

  try {
    searchParams.delete(PRIME_SUBSCRIPTION_EXT_HANDOFF_QUERY);
    const restQuery = searchParams.toString();
    const newHash = `${hash.slice(0, queryIndex)}${
      restQuery ? `?${restQuery}` : ''
    }`;
    globalThis.history?.replaceState?.(
      globalThis.history?.state ?? null,
      '',
      `${globalThis.location.pathname}${globalThis.location.search}${
        newHash || '#/'
      }`,
    );
  } catch {
    // replaceState is best-effort; the handoff is already consumed.
  }

  return true;
}
