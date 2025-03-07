import { useCallback } from 'react';

import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import type { IBrowserBookmark, IBrowserHistory } from '../types';

interface IHandleWebSiteParams {
  webSite?: IBrowserBookmark | IBrowserHistory;
  dApp?: IDApp;
  useSystemBrowser?: boolean;
  switchToMultiTabBrowser?: boolean;
  navigation?: any;
  shouldPopNavigation?: boolean;
  enterMethod: EEnterMethod;
}

export const useWebSiteHandler = () => {
  const { handleOpenWebSite } = useBrowserAction().current;

  return useCallback(
    async ({
      webSite,
      dApp,
      useSystemBrowser,
      switchToMultiTabBrowser,
      navigation,
      shouldPopNavigation = true,
      enterMethod,
    }: IHandleWebSiteParams) => {
      if (!webSite?.url) {
        return;
      }

      if (useSystemBrowser) {
        openUrlExternal(webSite.url);
      } else {
        handleOpenWebSite({
          webSite,
          dApp,
          switchToMultiTabBrowser,
          navigation,
          shouldPopNavigation,
        });
      }

      defaultLogger.discovery.dapp.enterDapp({
        dappDomain: webSite.url,
        dappName: webSite.title || dApp?.name || '',
        enterMethod,
      });
    },
    [handleOpenWebSite],
  );
};
