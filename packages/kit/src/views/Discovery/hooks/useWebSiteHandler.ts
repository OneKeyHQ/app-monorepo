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

import { useActiveTabId, useWebTabDataById } from './useWebTabs';

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
      const isDapp = !!dApp;
      const url = isDapp ? dApp?.url : webSite?.url;
      const title = isDapp ? dApp?.name : webSite?.title;

      if (!url || !title) {
        return;
      }

      console.log('limi-url', url, title);

      // If current active tab is of type 'home', change it to 'normal' and update its URL
      if (activeTab?.type === 'home' && !useSystemBrowser) {
        setWebTabData({
          id: activeTab.id,
          url,
          title,
          type: 'normal',
          isPinned: activeTab.isPinned,
        });

        if (shouldPopNavigation) {
          navigation.pop();
        }
      } else if (useSystemBrowser) {
        openUrlExternal(url);
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
        dappDomain: url,
        dappName: title,
        enterMethod,
      });
    },
    [activeTab, setWebTabData, navigation, handleOpenWebSite, gtMd],
  );
};
