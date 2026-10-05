import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SEARCH_RESULT_TABS = [
  { id: 'all', translationId: ETranslations.global_all },
  {
    id: 'stocks',
    translationId: ETranslations.perps_token_selector_stocks,
  },
  { id: 'market', translationId: ETranslations.global_market },
] as const;

export type IMarketTokenSelectorSearchTab =
  (typeof SEARCH_RESULT_TABS)[number]['id'];

export function MarketTokenSelectorSearchTabs({
  value,
  onChange,
}: {
  value: IMarketTokenSelectorSearchTab;
  onChange: (value: IMarketTokenSelectorSearchTab) => void;
}) {
  const intl = useIntl();

  return (
    <XStack
      flexShrink={0}
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
    >
      {SEARCH_RESULT_TABS.map((tab) => {
        const isActive = value === tab.id;
        return (
          <YStack
            key={tab.id}
            testID={`market-token-selector-search-tab-${tab.id}`}
            px="$4"
            py="$3"
            cursor="pointer"
            borderBottomWidth={isActive ? '$0.5' : '$0'}
            borderBottomColor="$borderActive"
            onPress={() => onChange(tab.id)}
          >
            <SizableText
              size="$headingSm"
              color={isActive ? '$text' : '$textSubdued'}
            >
              {intl.formatMessage({ id: tab.translationId })}
            </SizableText>
          </YStack>
        );
      })}
    </XStack>
  );
}
