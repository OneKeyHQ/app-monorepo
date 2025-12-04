import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

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

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';

import { FAQContent } from './FAQContent';
import { PortfolioTabContent } from './PortfolioTabContent';
import { ProtocolsTabContent } from './ProtocolsTabContent';

import type { IUseEarnPortfolioReturn } from '../hooks/useEarnPortfolio';

const EarnMainTabsComponent = ({
  isMobile,
  faqList,
  isFaqLoading = false,
  isAccountsLoading,
  refreshEarnAccounts,
  containerProps,
  defaultTab,
  portfolioData,
}: {
  isMobile: boolean;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  isAccountsLoading?: boolean;
  refreshEarnAccounts?: () => void;
  containerProps?: any;
  defaultTab?: 'assets' | 'portfolio' | 'faqs';
  portfolioData: IUseEarnPortfolioReturn;
}) => {
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

  return (
    <Tabs.Container
      width={platformEnv.isNative ? tabContainerWidth : undefined}
      ref={tabsRef}
      renderTabBar={(tabBarProps) => {
        const handleTabPress = (name: string) => {
          tabBarProps.onTabPress?.(name);
        };
        return <Tabs.TabBar {...tabBarProps} onTabPress={handleTabPress} />;
      }}
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
          <YStack px="$5" pt="$6" gap="$8">
            <FAQContent faqList={faqList} isLoading={isFaqLoading} />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export const EarnMainTabs = memo(EarnMainTabsComponent);
