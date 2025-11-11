import { useIntl } from 'react-intl';

import { RefreshControl, Tabs, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IEarnInvestmentItemV2 } from '@onekeyhq/shared/types/staking';

import { FAQContent } from './FAQContent';
import { PortfolioTabContent } from './PortfolioTabContent';
import { ProtocolsTabContent } from './ProtocolsTabContent';

export function EarnMainTabs({
  isMobile,
  assetTabData,
  faqList,
  isFaqLoading = false,
  // isPortfolioLoading = false,
  // portfolioInfo,
  isAccountsLoading,
  refreshEarnAccounts,
  containerProps,
}: {
  isMobile: boolean;
  assetTabData: Array<{ title: string; type: EAvailableAssetsTypeEnum }>;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  // isPortfolioLoading?: boolean;
  // portfolioInfo?: IEarnInvestmentItemV2[];
  isAccountsLoading?: boolean;
  refreshEarnAccounts?: () => void;
  containerProps?: any;
}) {
  const intl = useIntl();

  const refreshControl =
    isMobile && refreshEarnAccounts && isAccountsLoading !== undefined ? (
      <RefreshControl
        refreshing={isAccountsLoading}
        onRefresh={refreshEarnAccounts}
      />
    ) : undefined;

  return (
    <Tabs.Container
      renderTabBar={(props) => <Tabs.TabBar {...props} />}
      {...containerProps}
    >
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.earn_available_assets,
        })}
      >
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
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.earn_portfolio,
        })}
      >
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
      <Tabs.Tab name={intl.formatMessage({ id: ETranslations.global_faqs })}>
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
