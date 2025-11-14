import { useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import { RefreshControl, Tabs, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { FAQContent } from './FAQContent';
import { PortfolioTabContent } from './PortfolioTabContent';
import { ProtocolsTabContent } from './ProtocolsTabContent';

export function EarnMainTabs({
  isMobile,
  faqList,
  isFaqLoading = false,
  isAccountsLoading,
  refreshEarnAccounts,
  containerProps,
  defaultTab,
  onTabChange,
}: {
  isMobile: boolean;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  isAccountsLoading?: boolean;
  refreshEarnAccounts?: () => void;
  containerProps?: any;
  defaultTab?: 'assets' | 'portfolio' | 'faqs';
  onTabChange?: (tab: 'assets' | 'portfolio' | 'faqs') => void;
}) {
  const intl = useIntl();
  const tabsRef = useRef<ITabContainerRef>(null);

  const tabNames = useMemo(
    () => ({
      assets: intl.formatMessage({
        id: ETranslations.earn_available_assets,
      }),
      portfolio: intl.formatMessage({
        id: ETranslations.earn_portfolio,
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

  // Switch tab when defaultTab changes (from route navigation)
  useEffect(() => {
    if (defaultTab && tabsRef.current) {
      const targetTabName = initialTabName;
      const currentTabName = tabsRef.current.getFocusedTab();
      if (currentTabName !== targetTabName) {
        tabsRef.current.jumpToTab(targetTabName);
      }
    }
  }, [defaultTab, initialTabName]);

  const refreshControl =
    isMobile && refreshEarnAccounts && isAccountsLoading !== undefined ? (
      <RefreshControl
        refreshing={isAccountsLoading}
        onRefresh={refreshEarnAccounts}
      />
    ) : undefined;

  return (
    <Tabs.Container
      ref={tabsRef}
      renderTabBar={(tabBarProps) => {
        const handleTabPress = (name: string) => {
          tabBarProps.onTabPress?.(name);
          if (onTabChange) {
            if (name === tabNames.portfolio) {
              onTabChange('portfolio');
            } else if (name === tabNames.faqs) {
              onTabChange('faqs');
            } else {
              onTabChange('assets');
            }
          }
        };
        return <Tabs.TabBar {...tabBarProps} onTabPress={handleTabPress} />;
      }}
      initialTabName={initialTabName}
      {...containerProps}
    >
      <Tabs.Tab name={tabNames.assets}>
        {isMobile ? (
          <Tabs.ScrollView refreshControl={refreshControl}>
            <YStack pt="$6" gap="$8">
              <ProtocolsTabContent />
            </YStack>
          </Tabs.ScrollView>
        ) : (
          <YStack>
            <YStack pt="$6" gap="$8">
              <ProtocolsTabContent />
            </YStack>
          </YStack>
        )}
      </Tabs.Tab>
      <Tabs.Tab name={tabNames.portfolio}>
        {isMobile ? (
          <Tabs.ScrollView refreshControl={refreshControl}>
            <YStack pt="$6" gap="$8">
              <PortfolioTabContent />
            </YStack>
          </Tabs.ScrollView>
        ) : (
          <YStack>
            <YStack pt="$6" gap="$8">
              <PortfolioTabContent />
            </YStack>
          </YStack>
        )}
      </Tabs.Tab>
      <Tabs.Tab name={tabNames.faqs}>
        {isMobile ? (
          <Tabs.ScrollView refreshControl={refreshControl}>
            <YStack px="$5" pt="$6" gap="$8">
              <FAQContent faqList={faqList} isLoading={isFaqLoading} />
            </YStack>
          </Tabs.ScrollView>
        ) : (
          <YStack>
            <YStack px="$5" pt="$6" gap="$8">
              <FAQContent faqList={faqList} isLoading={isFaqLoading} />
            </YStack>
          </YStack>
        )}
      </Tabs.Tab>
    </Tabs.Container>
  );
}
