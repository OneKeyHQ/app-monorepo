import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import {
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IMatchDAppItemType } from '../types';

export function useOpenWebsite() {
  const navigation = useAppNavigation();
  const { setDisplayHomePage } = useBrowserTabActions().current;
  const { openMatchDApp } = useBrowserAction().current;

  const handleOpenWebSite = useCallback(
    ({ dApp, webSite }: IMatchDAppItemType) => {
      setDisplayHomePage(false);

      void openMatchDApp({
        webSite,
        dApp,
        isNewWindow: true,
      });
      if (platformEnv.isDesktop) {
        navigation.switchTab(ETabRoutes.MultiTabBrowser);
      } else {
        navigation.pop();
      }
    },
    [setDisplayHomePage, navigation, openMatchDApp],
  );
  return {
    handleOpenWebSite,
  };
}
