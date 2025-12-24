import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Page,
  Stack,
  rootNavigationRef,
  useOrientation,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ETabDiscoveryRoutes,
  ITabDiscoveryParamList,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EarnHomeWithProvider } from '../../../Earn/EarnHome';
import { MarketHomeWithProvider } from '../../../Market/MarketHomeV2/MarketHomeV2';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { checkAndCreateFolder } from '../../utils/screenshot';
import { showTabBar } from '../../utils/tabBarUtils';

import { withBrowserProvider } from './WithBrowserProvider';

import type { RouteProp } from '@react-navigation/core';

const popToDiscoveryHomePage = () => {
  const rootState = rootNavigationRef.current?.getState();
  const currentIndex = rootState?.index || 0;
  const routes = rootState?.routes || [];
  const currentRoute = routes[currentIndex];
  if (currentRoute?.name === ERootRoutes.Main) {
    if (currentRoute.state) {
      const tabIndex = currentRoute.state.index || 0;
      const discoveryRoute = currentRoute.state.routes[tabIndex];
      if (discoveryRoute?.name === ETabRoutes.Discovery) {
        const discoveryState = discoveryRoute?.state;
        if (
          discoveryState?.index !== 0 &&
          rootNavigationRef.current?.canGoBack()
        ) {
          rootNavigationRef.current?.goBack();
          setTimeout(() => {
            popToDiscoveryHomePage();
          });
        }
      }
    }
  }
};

function MobileBrowser() {
  const route =
    useRoute<
      RouteProp<ITabDiscoveryParamList, ETabDiscoveryRoutes.TabDiscovery>
    >();
  const isLandscape = useOrientation();
  const { defaultTab, earnTab } = route?.params || {};
  const [settings] = useSettingsPersistAtom();
  const [selectedHeaderTab, setSelectedHeaderTab] = useState<ETranslations>(
    defaultTab || settings.selectedBrowserTab || ETranslations.global_market,
  );
  const handleChangeHeaderTab = useCallback(async (tab: ETranslations) => {
    setSelectedHeaderTab(tab);
    setTimeout(async () => {
      await backgroundApiProxy.serviceSetting.setSelectedBrowserTab(tab);
    }, 150);
  }, []);

  const previousDefaultTab = useRef<ETranslations | undefined>(defaultTab);
  useEffect(() => {
    if (previousDefaultTab.current !== defaultTab) {
      previousDefaultTab.current = defaultTab;
      if (defaultTab) {
        setTimeout(async () => {
          await handleChangeHeaderTab(defaultTab);
        }, 100);
      }
    }
  }, [defaultTab, handleChangeHeaderTab]);
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { closeWebTab } = useBrowserTabActions().current;

  useEffect(() => {
    if (!tabs?.length) {
      showTabBar();
    }
  }, [tabs]);

  useEffect(() => {
    void checkAndCreateFolder();
  }, []);

  const closeCurrentWebTab = useCallback(async () => {
    showTabBar();
    return activeTabId
      ? closeWebTab({ tabId: activeTabId, entry: 'Menu' })
      : Promise.resolve();
  }, [activeTabId, closeWebTab]);

  useEffect(() => {
    const listener = (event: { tab: ETranslations; openUrl?: boolean }) => {
      void handleChangeHeaderTab(event.tab);
      if (event.tab === ETranslations.global_browser && event.openUrl) {
        setTimeout(() => {
          popToDiscoveryHomePage();
        }, 50);
      }
    };
    appEventBus.on(EAppEventBusNames.SwitchDiscoveryTabInNative, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchDiscoveryTabInNative, listener);
    };
  }, [handleChangeHeaderTab]);

  // For risk detection
  useEffect(() => {
    const listener = () => {
      void closeCurrentWebTab();
    };
    appEventBus.on(EAppEventBusNames.CloseCurrentBrowserTab, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.CloseCurrentBrowserTab, listener);
    };
  }, [closeCurrentWebTab]);

  return (
    <Page fullPage>
      {/* custom header */}
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Discovery}
        selectedHeaderTab={selectedHeaderTab}
      />
      <Page.Body>
        {/* Market Tab */}
        <Stack
          flex={1}
          display={
            selectedHeaderTab === ETranslations.global_market
              ? undefined
              : 'none'
          }
        >
          <MarketHomeWithProvider
            isFocused={selectedHeaderTab === ETranslations.global_market}
          />
        </Stack>
        <Stack
          flex={1}
          display={
            selectedHeaderTab === ETranslations.global_earn ? undefined : 'none'
          }
        >
          <EarnHomeWithProvider
            showHeader={false}
            showContent={selectedHeaderTab === ETranslations.global_earn}
            defaultTab={earnTab}
          />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default memo(withBrowserProvider(MobileBrowser));
