import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  RefreshControl,
  Tabs,
  YStack,
  rootNavigationRef,
  useTabContainerWidth,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsFirstFocused } from '../../../hooks/useIsFirstFocused';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';

import { FAQContent } from './FAQContent';
import { PortfolioTabContent } from './PortfolioTabContent';
import { ProtocolsTabContent } from './ProtocolsTabContent';

import type { IUseEarnPortfolioReturn } from '../hooks/useEarnPortfolio';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

interface IEarnMainTabsProps {
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  containerProps?: any;
  defaultTab?: 'assets' | 'portfolio' | 'faqs';
  portfolioData: IUseEarnPortfolioReturn;
}

const EarnMainTabsComponent = ({
  faqList,
  isFaqLoading = false,
  containerProps,
  defaultTab,
  portfolioData,
}: IEarnMainTabsProps) => {
  const intl = useIntl();
  const tabsRef = useRef<ITabContainerRef>(null);

  const tabNames = useMemo(
    () => ({
      assets: intl.formatMessage({
        id: ETranslations.earn_available_assets,
      }),
      portfolio: intl.formatMessage({
        id: ETranslations.earn_positions,
      }),
      faqs: intl.formatMessage({ id: ETranslations.global_faqs }),
    }),
    [intl],
  );

  const initialTabName = useMemo(() => {
    if (defaultTab === 'portfolio') return tabNames.portfolio;
    if (defaultTab === 'faqs') return tabNames.faqs;
    return tabNames.assets;
  }, [defaultTab, tabNames]);

  const tabKeyByName = useMemo(() => {
    const map: Record<string, 'assets' | 'portfolio' | 'faqs'> = {};
    (
      Object.entries(tabNames) as Array<[keyof typeof tabNames, string]>
    ).forEach(([key, value]) => {
      map[value] = key;
    });
    return map;
  }, [tabNames]);

  const handleTabChange = useCallback(
    ({ tabName }: { tabName: string }) => {
      const tabKey = tabKeyByName[tabName];
      if (tabKey) {
        rootNavigationRef.current?.setParams?.({
          tab: tabKey,
        });
      }
    },
    [tabKeyByName],
  );

  const isFocused = useRouteIsFocused();
  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    if (isFocused === isFocusedRef.current) {
      return;
    }
    isFocusedRef.current = isFocused;
    if (defaultTab && tabsRef.current) {
      const targetTabName = initialTabName;
      const currentTabName = tabsRef.current.getFocusedTab();
      if (currentTabName !== targetTabName) {
        tabsRef.current.jumpToTab(targetTabName);
      }
    }
  }, [defaultTab, initialTabName, isFocused]);

  useEffect(
    () => () => {
      tabsRef.current = null;
    },
    [],
  );

  const tabContainerWidth = useTabContainerWidth();

  const renderTabBar = useCallback((tabBarProps: TabBarProps<string>) => {
    const handleTabPress = (name: string) => {
      tabBarProps.onTabPress?.(name);
    };
    return <Tabs.TabBar {...tabBarProps} onTabPress={handleTabPress} />;
  }, []);

  return (
    <Tabs.Container
      width={platformEnv.isNative ? tabContainerWidth : undefined}
      ref={tabsRef}
      renderTabBar={renderTabBar}
      initialTabName={initialTabName}
      onTabChange={handleTabChange}
      {...containerProps}
    >
      <Tabs.Tab name={tabNames.assets}>
        <Tabs.ScrollView>
          <YStack pt="$6" gap="$8">
            <ProtocolsTabContent />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>
      <Tabs.Tab name={tabNames.portfolio}>
        <Tabs.ScrollView>
          <YStack pt="$6" gap="$8">
            <PortfolioTabContent portfolioData={portfolioData} />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>
      <Tabs.Tab name={tabNames.faqs}>
        <Tabs.ScrollView>
          <YStack px="$5" pt="$6" gap="$8" maxWidth={960}>
            <FAQContent faqList={faqList} isLoading={isFaqLoading} />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export const MemoizedEarnMainTabs = memo(EarnMainTabsComponent);

function ForwardedEarnMainTabs(
  props: React.ComponentProps<typeof EarnMainTabsComponent>,
) {
  const isFocused = useIsFocused();
  const isFirstFocused = useIsFirstFocused(isFocused);
  return isFirstFocused ? <EarnMainTabsComponent {...props} /> : null;
}
export const EarnMainTabs = memo(ForwardedEarnMainTabs);
