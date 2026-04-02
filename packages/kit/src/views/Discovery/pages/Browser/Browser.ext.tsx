import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { LegacyUniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/LegacyUniversalSearchInput';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  type ETabDiscoveryRoutes,
  ETabRoutes,
  type ITabDiscoveryParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EarnHomeWithProvider } from '../../../Earn/EarnHome';
import { MarketHomeWithProvider } from '../../../Market/MarketHomeV2/MarketHomeV2';

import { withBrowserProvider } from './WithBrowserProvider';

import type { RouteProp } from '@react-navigation/core';

type IExploreTabName = 'market' | 'earn' | 'browser';
type IExploreTabSwitchType = 'default' | 'tap' | 'swipe';

function getExploreTabName(tab: ETranslations): IExploreTabName {
  if (tab === ETranslations.global_market) {
    return 'market';
  }
  if (tab === ETranslations.global_earn) {
    return 'earn';
  }
  return 'browser';
}

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
  const exploreTabSwitchTypeRef = useRef<IExploreTabSwitchType>('default');
  const hasLoggedExploreTabViewRef = useRef(false);

  const handleChangeHeaderTab = useCallback(async (tab: ETranslations) => {
    setSelectedHeaderTab(tab);
    setTimeout(async () => {
      await backgroundApiProxy.serviceSetting.setSelectedBrowserTab(tab);
    }, 150);
  }, []);

  useEffect(() => {
    const switchType = hasLoggedExploreTabViewRef.current
      ? exploreTabSwitchTypeRef.current
      : 'default';

    hasLoggedExploreTabViewRef.current = true;
    defaultLogger.discovery.browser.exploreTabView({
      tabName: getExploreTabName(selectedHeaderTab),
      switchType,
    });
    exploreTabSwitchTypeRef.current = 'default';
  }, [selectedHeaderTab]);

  const previousDefaultTab = useRef<ETranslations | undefined>(defaultTab);
  useEffect(() => {
    if (previousDefaultTab.current !== defaultTab) {
      previousDefaultTab.current = defaultTab;
      if (defaultTab) {
        exploreTabSwitchTypeRef.current = 'default';
        setTimeout(async () => {
          await handleChangeHeaderTab(defaultTab);
        }, 100);
      }
    }
  }, [defaultTab, handleChangeHeaderTab]);

  useEffect(() => {
    const listener = (event: {
      tab: ETranslations;
      openUrl?: boolean;
      switchType?: IExploreTabSwitchType;
    }) => {
      exploreTabSwitchTypeRef.current = event.switchType ?? 'default';
      void handleChangeHeaderTab(event.tab);
    };
    appEventBus.on(EAppEventBusNames.SwitchDiscoveryTabInNative, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchDiscoveryTabInNative, listener);
    };
  }, [handleChangeHeaderTab]);

  return (
    <Page fullPage>
      <Page.Body>
        {/* custom header */}
        <YStack my="$2">
          <XStack mx="$5">
            <LegacyUniversalSearchInput size="medium" initialTab="market" />
          </XStack>
          <TabPageHeader
            sceneName={EAccountSelectorSceneName.home}
            tabRoute={ETabRoutes.Discovery}
            selectedHeaderTab={selectedHeaderTab}
          />
        </YStack>
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
