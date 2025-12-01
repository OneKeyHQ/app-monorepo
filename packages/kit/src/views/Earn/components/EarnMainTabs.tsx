import { memo, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  RefreshControl,
  Tabs,
  YStack,
  useTabContainerWidth,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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

  useEffect(() => {
    if (defaultTab && tabsRef.current) {
      const targetTabName = initialTabName;
      const currentTabName = tabsRef.current.getFocusedTab();
      if (currentTabName !== targetTabName) {
        tabsRef.current.jumpToTab(targetTabName);
      }
    }
  }, [defaultTab, initialTabName]);

  useEffect(
    () => () => {
      tabsRef.current = null;
    },
    [],
  );

  const refreshControl = useMemo(() => {
    return isMobile &&
      refreshEarnAccounts &&
      isAccountsLoading !== undefined ? (
      <RefreshControl
        refreshing={isAccountsLoading}
        onRefresh={refreshEarnAccounts}
      />
    ) : undefined;
  }, [isMobile, refreshEarnAccounts, isAccountsLoading]);

  const tabContainerWidth = useTabContainerWidth();

  return (
    <Tabs.Container
      width={tabContainerWidth}
      ref={tabsRef}
      renderTabBar={(tabBarProps) => {
        const handleTabPress = (name: string) => {
          tabBarProps.onTabPress?.(name);
        };
        return <Tabs.TabBar {...tabBarProps} onTabPress={handleTabPress} />;
      }}
      initialTabName={initialTabName}
      {...containerProps}
    >
      <Tabs.Tab name={tabNames.assets}>
        <Tabs.ScrollView refreshControl={refreshControl}>
          <YStack pt="$6" gap="$8">
            <ProtocolsTabContent />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>
      <Tabs.Tab name={tabNames.portfolio}>
        <Tabs.ScrollView refreshControl={refreshControl}>
          <YStack pt="$6" gap="$8">
            <PortfolioTabContent portfolioData={portfolioData} />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>
      <Tabs.Tab name={tabNames.faqs}>
        <Tabs.ScrollView refreshControl={refreshControl}>
          <YStack px="$5" pt="$6" gap="$8">
            <FAQContent faqList={faqList} isLoading={isFaqLoading} />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export const EarnMainTabs = memo(EarnMainTabsComponent);
