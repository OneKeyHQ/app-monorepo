import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IMarketSearchTab,
  getDetailPopoverSearchTabs,
} from '../../../utils/marketSearchList';

const SEARCH_TAB_LABELS: Record<IMarketSearchTab, ETranslations> = {
  all: ETranslations.global_all,
  tokens: ETranslations.global_universal_search_tabs_tokens,
  stocks: ETranslations.perps_token_selector_stocks,
};

export type IMarketTokenSelectorSearchTab = IMarketSearchTab;

export function MarketTokenSelectorSearchTabs({
  value,
  onChange,
  hasStockResults = false,
}: {
  value: IMarketTokenSelectorSearchTab;
  onChange: (value: IMarketTokenSelectorSearchTab) => void;
  hasStockResults?: boolean;
}) {
  const intl = useIntl();
  const tabs = getDetailPopoverSearchTabs(hasStockResults);

  return (
    <XStack
      flexShrink={0}
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      {tabs.map((tab) => {
        const isActive = value === tab;
        return (
          <YStack
            key={tab}
            testID={`market-token-selector-search-tab-${tab}`}
            px="$4"
            py="$3"
            cursor="pointer"
            borderBottomWidth={isActive ? '$0.5' : '$0'}
            borderBottomColor="$borderActive"
            onPress={() => onChange(tab)}
          >
            <SizableText
              size="$bodyLgMedium"
              color={isActive ? '$text' : '$textSubdued'}
            >
              {intl.formatMessage({ id: SEARCH_TAB_LABELS[tab] })}
            </SizableText>
          </YStack>
        );
      })}
    </XStack>
  );
}
