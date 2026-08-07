import type { IEOneKeyDeepLinkParams } from '@onekeyhq/shared/src/consts/deeplinkConsts.desktop';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts.desktop';

import { handleCustomInjectedDeepLink } from './handleCustomInjectedDeepLink';

export async function tryHandleDevelopmentDesktopDeepLink({
  deepLinkPath,
  queryParams,
}: {
  deepLinkPath?: string | null;
  queryParams?: Record<string, unknown> | null;
}): Promise<boolean> {
  if (deepLinkPath !== EOneKeyDeepLinkPath.custom_injected) {
    return false;
  }
  await handleCustomInjectedDeepLink(
    queryParams as IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.custom_injected],
  );
  return true;
}
