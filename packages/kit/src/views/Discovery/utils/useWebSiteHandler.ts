import { useCallback } from 'react';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useBrowserAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EEnterMethod } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/dapp';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { useActiveTabId, useWebTabDataById } from '../hooks/useWebTabs';

import type { IBrowserBookmark, IBrowserHistory } from '../types';

interface IHandleWebSiteParams {
  webSite?: IBrowserBookmark | IBrowserHistory;
  dApp?: IDApp;
  useSystemBrowser?: boolean;
  shouldPopNavigation?: boolean;
  useCurrentWindow?: boolean;
  tabId?: string;
  enterMethod: EEnterMethod;
}

export const useWebSiteHandler = () => {
  const { handleOpenWebSite } = useBrowserAction().current;
  const { setWebTabData } = useBrowserTabActions().current;
  const navigation = useAppNavigation();
  const { activeTabId } = useActiveTabId();
  const { tab: activeTab } = useWebTabDataById(activeTabId ?? '');
  const { gtMd } = useMedia();

  return useCallback(
    ({
      webSite,
      dApp,
      useSystemBrowser,
      shouldPopNavigation,
      enterMethod,
      useCurrentWindow,
      tabId,
    }: IHandleWebSiteParams) => {
      if (!webSite?.url) {
        return;
      }

      // If current active tab is of type 'home', change it to 'normal' and update its URL
      if (activeTab?.type === 'home' && !useSystemBrowser) {
        setWebTabData({
          id: activeTab.id,
          url: webSite.url,
          title: webSite.title || dApp?.name || '',
          type: 'normal',
          isPinned: activeTab.isPinned,
        });

        if (shouldPopNavigation) {
          navigation.pop();
        }
      } else if (useSystemBrowser) {
        openUrlExternal(webSite.url);
      } else {
        handleOpenWebSite({
          webSite,
          dApp,
          navigation,
          shouldPopNavigation,
          switchToMultiTabBrowser: gtMd,
          useCurrentWindow,
          tabId,
        });
      }

      defaultLogger.discovery.dapp.enterDapp({
        dappDomain: webSite.url,
        dappName: webSite.title || dApp?.name || '',
        enterMethod,
      });
    },
    [
      activeTab?.type,
      activeTab?.id,
      activeTab?.isPinned,
      setWebTabData,
      navigation,
      handleOpenWebSite,
      gtMd,
    ],
  );
};
