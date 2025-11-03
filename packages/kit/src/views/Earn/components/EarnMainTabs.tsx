import { useIntl } from 'react-intl';

import { RefreshControl, Tabs, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IEarnInvestmentItem } from '@onekeyhq/shared/types/staking';

import { FAQContent } from './FAQContent';
import { PortfolioTabContent } from './PortfolioTabContent';
import { ProtocolsTabContent } from './ProtocolsTabContent';

export function EarnMainTabs({
  isMobile,
  assetTabData,
  faqList,
  isFaqLoading = false,
  isPortfolioLoading = false,
  portfolioInfo,
  isAccountsLoading,
  refreshOverViewData,
  containerProps,
}: {
  isMobile: boolean;
  assetTabData: Array<{ title: string; type: EAvailableAssetsTypeEnum }>;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  isPortfolioLoading?: boolean;
  portfolioInfo?: IEarnInvestmentItem[];
  isAccountsLoading?: boolean;
  refreshOverViewData?: () => void;
  containerProps?: any;
}) {
  const intl = useIntl();

  const refreshControl =
    isMobile && refreshOverViewData && isAccountsLoading !== undefined ? (
      <RefreshControl
        refreshing={isAccountsLoading}
        onRefresh={refreshOverViewData}
      />
    ) : undefined;

  const WrapperComponent = isMobile ? Tabs.ScrollView : YStack;

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
        <WrapperComponent>
          <YStack pt="$6" gap="$8">
            <ProtocolsTabContent />
          </YStack>
        </WrapperComponent>
      </Tabs.Tab>
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.earn_portfolio,
        })}
      >
        <WrapperComponent>
          <YStack px="$5" pt="$6" gap="$8">
            <PortfolioTabContent
              isLoading={isPortfolioLoading}
              portfolioInfo={portfolioInfo ?? []}
            />
          </YStack>
        </WrapperComponent>
      </Tabs.Tab>
      <Tabs.Tab name={intl.formatMessage({ id: ETranslations.global_faqs })}>
        <WrapperComponent>
          <YStack px="$5" pt="$6" gap="$8">
            <FAQContent faqList={faqList} isLoading={isFaqLoading} />
          </YStack>
        </WrapperComponent>
      </Tabs.Tab>
    </Tabs.Container>
  );
}
