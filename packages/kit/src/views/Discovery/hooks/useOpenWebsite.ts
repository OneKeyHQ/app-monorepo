import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import {
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IMatchDAppItemType } from '../types';

export function useOpenWebsite({
  useCurrentWindow,
  tabId,
}: {
  useCurrentWindow?: boolean;
  tabId?: string;
}) {
  const navigation = useAppNavigation();
  const { setDisplayHomePage } = useBrowserTabActions().current;
  const { openMatchDApp } = useBrowserAction().current;
  const isNewWindow = !useCurrentWindow;

  const handleOpenWebSite = useCallback(
    ({ dApp, webSite }: IMatchDAppItemType) => {
      setDisplayHomePage(false);

      void openMatchDApp({
        webSite,
        dApp,
        isNewWindow,
        tabId,
      });
      if (platformEnv.isDesktop) {
        navigation.switchTab(ETabRoutes.MultiTabBrowser);
      } else {
        navigation.pop();
      }
    },
    [setDisplayHomePage, navigation, openMatchDApp, isNewWindow, tabId],
  );
  return {
    handleOpenWebSite,
  };
}
