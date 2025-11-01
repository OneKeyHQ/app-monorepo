import { useIntl } from 'react-intl';

import { RefreshControl, Tabs, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IEarnInvestmentItem } from '@onekeyhq/shared/types/staking';

import { FAQContent } from './FAQContent';
import { PortfolioTabContent } from './PortfolioTabContent';
import {
  ProtocolsTabContentDesktop,
  ProtocolsTabContentMobile,
} from './ProtocolsTabContent';

export function EarnMainTabs({
  isMobile,
  assetTabData,
  faqList,
  isFaqLoading = false,
  isPortfolioLoading = false,
  portfolioInfo,
  isLoading,
  refreshOverViewData,
  containerProps,
}: {
  isMobile: boolean;
  assetTabData: Array<{ title: string; type: EAvailableAssetsTypeEnum }>;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading?: boolean;
  isPortfolioLoading?: boolean;
  portfolioInfo?: IEarnInvestmentItem[];
  isLoading?: boolean;
  refreshOverViewData?: () => void;
  containerProps?: any;
}) {
  const intl = useIntl();

  const refreshControl =
    isMobile && refreshOverViewData && isLoading !== undefined ? (
      <RefreshControl refreshing={isLoading} onRefresh={refreshOverViewData} />
    ) : undefined;

  const WrapperComponent = isMobile ? Tabs.ScrollView : YStack;
  const wrapperProps = isMobile
    ? { refreshControl }
    : { pt: '$6' as const, gap: '$8' as const };

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
            <ProtocolsTabContentMobile assetTabData={assetTabData} />
          </Tabs.ScrollView>
        ) : (
          <ProtocolsTabContentDesktop />
        )}
      </Tabs.Tab>
      <Tabs.Tab
        name={intl.formatMessage({
          id: ETranslations.earn_portfolio,
        })}
      >
        <WrapperComponent {...wrapperProps}>
          <YStack px="$5">
            <PortfolioTabContent
              isLoading={isPortfolioLoading}
              portfolioInfo={portfolioInfo ?? []}
            />
          </YStack>
        </WrapperComponent>
      </Tabs.Tab>
      <Tabs.Tab name={intl.formatMessage({ id: ETranslations.global_faqs })}>
        <WrapperComponent {...wrapperProps}>
          <YStack px="$5">
            <FAQContent faqList={faqList} isLoading={isFaqLoading} />
          </YStack>
        </WrapperComponent>
      </Tabs.Tab>
    </Tabs.Container>
  );
}
