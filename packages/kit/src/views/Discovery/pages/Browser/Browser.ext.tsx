import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ETabRoutes,
  type ETabDiscoveryRoutes,
  type ITabDiscoveryParamList,
} from '@onekeyhq/shared/src/routes';

import { EarnHomeWithProvider } from '../../../Earn/EarnHome';
import { MarketHomeWithProvider } from '../../../Market/MarketHomeV2/MarketHomeV2';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { checkAndCreateFolder } from '../../utils/screenshot';
import { showTabBar } from '../../utils/tabBarUtils';

import { withBrowserProvider } from './WithBrowserProvider';

import type { RouteProp } from '@react-navigation/core';
import { TabPageHeader } from '../../../../components/TabPageHeader';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function MobileBrowser() {
  const route =
    useRoute<
      RouteProp<ITabDiscoveryParamList, ETabDiscoveryRoutes.TabDiscovery>
    >();
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

  console.log('selectedHeaderTab', selectedHeaderTab);
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
