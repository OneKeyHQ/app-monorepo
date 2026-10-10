import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Expand-tab handoffs arrive as hash query params
// (ui-expand-tab.html#/?key=value) on a fresh tab or via hashchange on a
// reused one.
export function getExtExpandTabHashParams(): URLSearchParams | undefined {
  if (!platformEnv.isExtensionUiExpandTab) {
    return undefined;
  }
  const hash = globalThis.location?.hash ?? '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) {
    return undefined;
  }
  return new URLSearchParams(hash.slice(queryIndex + 1));
}

// Strips consumed handoff params via history.replaceState so a manual refresh
// does not re-trigger the handoff. Best-effort: the caller already read them.
export function stripExtExpandTabHashParams(keys: string[]) {
  try {
    const hash = globalThis.location?.hash ?? '';
    const queryIndex = hash.indexOf('?');
    if (queryIndex < 0) {
      return;
    }
    const searchParams = new URLSearchParams(hash.slice(queryIndex + 1));
    keys.forEach((key) => searchParams.delete(key));
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
    // URL cleanup is best-effort only.
  }
}
