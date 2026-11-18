type IAllowListRule = {
  showParams: boolean;
  showUrl?: boolean;
};

type IAllowList = Record<string, IAllowListRule>;

const DYNAMIC_PATH_SUFFIX = '/.';
export const WEB_ROUTE_NOT_FOUND_EVENT = 'onekey-web-route-not-found';

function normalizeWebPathname(path?: string) {
  if (!path) {
    return '';
  }
  const [pathname = ''] = path.split(/[?#]/);
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

export function isNotFoundRouteState(
  state:
    | {
        index?: number;
        routes?: { name?: string }[];
      }
    | null
    | undefined,
) {
  const routes = state?.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    return false;
  }
  const focusedIndex =
    typeof state?.index === 'number' &&
    state.index >= 0 &&
    state.index < routes.length
      ? state.index
      : routes.length - 1;
  return routes[focusedIndex]?.name === 'NotFound';
}

export function clearWebRouteNotFoundState() {
  const runtimeGlobal = globalThis as Record<string, unknown>;
  runtimeGlobal.__onekeyWebRouteNotFound = false;
  runtimeGlobal.__onekeyWebUnmatchedPath = '';
}

export function syncWebRouteNotFoundState({
  path,
  state,
}: {
  path: string;
  state:
    | {
        routes?: { name?: string }[];
      }
    | null
    | undefined;
}) {
  const runtimeGlobal = globalThis as Record<string, unknown>;
  if (isNotFoundRouteState(state)) {
    runtimeGlobal.__onekeyWebRouteNotFound = true;
    runtimeGlobal.__onekeyWebUnmatchedPath = normalizeWebPathname(path);
    if (typeof globalThis.dispatchEvent === 'function') {
      try {
        globalThis.dispatchEvent(new Event(WEB_ROUTE_NOT_FOUND_EVENT));
      } catch {
        // Ignore environments without DOM Event support.
      }
    }
    return true;
  }
  clearWebRouteNotFoundState();
  return false;
}

export function shouldPreserveUnmatchedWebUrl({
  currentPath,
  unmatchedPath,
}: {
  currentPath?: string;
  unmatchedPath?: string;
}) {
  const normalizedCurrent = normalizeWebPathname(currentPath);
  const normalizedUnmatched = normalizeWebPathname(unmatchedPath);
  return Boolean(
    normalizedCurrent &&
    normalizedUnmatched &&
    normalizedCurrent === normalizedUnmatched,
  );
}

export function normalizeMarketTokenDetailPath(path: string) {
  // Native tokens have an empty address. Publish the existing native route
  // without its empty address segment so allowlisting and reload agree.
  return path.replace(/^(\/market\/token\/[^/?]+)\/(?=\?|$)/u, '$1');
}

function matchesDynamicAllowListPath({
  allowListKey,
  path,
}: {
  allowListKey: string;
  path: string;
}) {
  if (!allowListKey.endsWith(DYNAMIC_PATH_SUFFIX)) {
    return false;
  }
  // buildAllowList collapses one or more route params into a trailing `/.`.
  const pathPrefix = allowListKey.slice(0, -DYNAMIC_PATH_SUFFIX.length);
  const dynamicPath = path.slice(pathPrefix.length + 1);
  return (
    path.startsWith(`${pathPrefix}/`) &&
    dynamicPath.length > 0 &&
    dynamicPath.split('/').every(Boolean)
  );
}

export function getWebDappAllowListRule({
  allowList,
  allowListKeys,
  path,
}: {
  allowList: IAllowList;
  allowListKeys: string[];
  path: string;
}) {
  const directRule = allowList[path];
  if (directRule) {
    return directRule;
  }
  const matchedKey = allowListKeys.find((key) =>
    matchesDynamicAllowListPath({ allowListKey: key, path }),
  );
  return matchedKey ? allowList[matchedKey] : undefined;
}

export function getWebDappUrlFallback({
  allowList,
  allowListKeys,
  currentPath,
  currentSearch = '',
}: {
  allowList: IAllowList;
  allowListKeys: string[];
  currentPath?: string;
  currentSearch?: string;
}) {
  if (!currentPath) {
    return '/market';
  }
  const pathWithQuery = `${currentPath}${currentSearch}`;
  const rule = getWebDappAllowListRule({
    allowList,
    allowListKeys,
    path: currentPath,
  });
  if (!rule?.showUrl) {
    return '/market';
  }
  return rule.showParams ? pathWithQuery : currentPath;
}
