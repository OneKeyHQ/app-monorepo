import { switchTabAsync } from '@onekeyhq/components';
import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import type { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { setPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import {
  ERootRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';

import type { IAppNavigation } from '../hooks/useAppNavigation';

export type IOneKeyAppLinkTarget = 'stock' | 'perps';

const ONEKEY_APP_LINK_HOSTS = new Set([
  new URL(WEB_APP_URL).hostname,
  new URL(WEB_APP_URL_DEV).hostname,
]);

function normalizePath(pathname: string) {
  return pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
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

  if (!ONEKEY_APP_LINK_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
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
}: {
  target: IOneKeyAppLinkTarget;
  navigation: IAppNavigation;
  perpSource?: EPerpPageEnterSource;
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
  await switchTabAsync(ETabRoutes.Perp);
}
