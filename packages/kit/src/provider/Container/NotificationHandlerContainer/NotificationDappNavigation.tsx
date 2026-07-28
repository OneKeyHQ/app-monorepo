import { useCallback } from 'react';
import type { ReactNode } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useBrowserAction } from '../../../states/jotai/contexts/discovery';
import { DiscoveryBrowserProviderMirror } from '../../../views/Discovery/components/DiscoveryBrowserProviderMirror';

import type useAppNavigation from '../../../hooks/useAppNavigation';

type IAppNavigation = ReturnType<typeof useAppNavigation>;

export function useNotificationDappNavigation(navigation: IAppNavigation) {
  const browserAction = useBrowserAction().current;
  return useCallback(
    (url: string) => {
      if (platformEnv.isNative || platformEnv.isDesktop) {
        browserAction.handleOpenWebSite({
          webSite: {
            url,
            title: '',
            logo: undefined,
            sortIndex: undefined,
          },
          navigation,
          useCurrentWindow: false,
          tabId: '',
        });
      } else {
        openUrlExternal(url);
      }
    },
    [browserAction, navigation],
  );
}

export function NotificationHandlerDiscoveryProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DiscoveryBrowserProviderMirror>{children}</DiscoveryBrowserProviderMirror>
  );
}
