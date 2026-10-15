import { useIntl } from 'react-intl';

import { Empty, ScrollView, Spinner, YStack } from '@onekeyhq/components';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig';
import { MarketRecommendList } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketRecommendList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function SelectorWatchlistRecommendations() {
  const intl = useIntl();
  const { recommendedTokens, isLoading } = useMarketBasicConfig();

  if (recommendedTokens.length === 0) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center">
        {isLoading ? (
          <Spinner size="large" />
        ) : (
          <Empty
            illustration="QuestionMark"
            title={intl.formatMessage({
              id: ETranslations.market_favorites_empty,
            })}
          />
        )}
      </YStack>
    );
  }

  return (
    <ScrollView
      testID="market-token-selector-recommendations"
      flex={1}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <MarketRecommendList
        recommendedTokens={recommendedTokens}
        maxSize={platformEnv.isExtensionUiPopup ? 6 : 8}
        containerProps={{ pt: '$2.5', pb: '$5' }}
      />
    </ScrollView>
  );
}
