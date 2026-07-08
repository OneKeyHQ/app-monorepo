import { switchTabAsync } from '@onekeyhq/components';
import {
  ONEKEY_PERPS_APP_LINK_HOST,
  ONEKEY_STOCKS_APP_LINK_HOST,
  ONEKEY_UNIVERSAL_LINK_HOST,
  ONEKEY_UNIVERSAL_TEST_LINK_HOST,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import type { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { setPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import {
  ERootRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';

import type { IAppNavigation } from '../hooks/useAppNavigation';

export type IOneKeyAppLinkTarget = 'stock' | 'perps';
export type IOneKeyPerpsAppLinkRoute =
  | ETabRoutes.Perp
  | ETabRoutes.WebviewPerpTrade;

const ONEKEY_WEB_APP_LINK_HOSTS = new Set([
  ONEKEY_UNIVERSAL_LINK_HOST,
  ONEKEY_UNIVERSAL_TEST_LINK_HOST,
]);

const ONEKEY_BUSINESS_APP_LINK_HOST_TARGETS: Record<
  string,
  IOneKeyAppLinkTarget
> = {
  [ONEKEY_STOCKS_APP_LINK_HOST]: 'stock',
  [ONEKEY_PERPS_APP_LINK_HOST]: 'perps',
};

function normalizePath(pathname: string) {
  return pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
}

export function resolveOneKeyPerpsAppLinkRoute(
  perpTabShowWeb?: boolean,
): IOneKeyPerpsAppLinkRoute {
  return perpTabShowWeb ? ETabRoutes.WebviewPerpTrade : ETabRoutes.Perp;
}

export function parseOneKeyAppLinkTarget(
  url: string,
): IOneKeyAppLinkTarget | undefined {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return undefined;
  }

  if (parsedUrl.protocol !== 'https:') {
    return undefined;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const businessDomainTarget = ONEKEY_BUSINESS_APP_LINK_HOST_TARGETS[hostname];
  if (businessDomainTarget) {
    return businessDomainTarget;
  }

  if (!ONEKEY_WEB_APP_LINK_HOSTS.has(hostname)) {
    return undefined;
  }

  const path = normalizePath(parsedUrl.pathname);
  if (
    path === 'swap' &&
    parsedUrl.searchParams.get('tab')?.toLowerCase() === 'stock'
  ) {
    return 'stock';
  }

  if (path === 'perps') {
    return 'perps';
  }

  return undefined;
}

export async function navigateToOneKeyAppLinkTarget({
  target,
  navigation,
  perpSource,
  perpTabRoute,
}: {
  target: IOneKeyAppLinkTarget;
  navigation: IAppNavigation;
  perpSource?: EPerpPageEnterSource;
  perpTabRoute?: IOneKeyPerpsAppLinkRoute;
}) {
  if (target === 'stock') {
    await switchTabAsync(ETabRoutes.Swap);
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Swap,
      params: {
        screen: ETabSwapRoutes.TabSwap,
        params: {
          tab: 'stock',
        },
      },
    });
    return;
  }

  if (perpSource) {
    setPerpPageEnterSource(perpSource);
  }
  await switchTabAsync(perpTabRoute ?? resolveOneKeyPerpsAppLinkRoute());
}
