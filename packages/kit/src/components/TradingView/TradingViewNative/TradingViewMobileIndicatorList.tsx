import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { isTradingViewNativeAnyIndicator } from './utils/chartIndicators';

import type { ITradingViewNativeAnyIndicator } from './utils/chartIndicators';
import type { ITradingViewIndicatorSettingsItem } from '../TradingViewChartControls/chartSettings';

// Main and sub indicator rows shared by the modal page and the fullscreen
// chart panel.
export function TradingViewMobileIndicatorList({
  indicators,
  onSelect,
  ...containerProps
}: {
  indicators: ITradingViewIndicatorSettingsItem[];
  onSelect: (indicatorId: ITradingViewNativeAnyIndicator) => void;
} & IYStackProps) {
  const intl = useIntl();
  return (
    <YStack gap="$4" {...containerProps}>
      {(['main', 'sub'] as const).map((scope) => (
        <YStack key={scope}>
          <SizableText size="$bodyMd" color="$textSubdued" py="$2">
            {intl.formatMessage({
              id:
                scope === 'main'
                  ? ETranslations.market_main_chart_indicators
                  : ETranslations.market_sub_chart_indicators,
            })}
          </SizableText>
          {indicators
            .filter((indicator) => indicator.scope === scope)
            .map((indicator) => (
              <XStack
                key={indicator.id}
                testID={`trading-view-mobile-indicator-settings-${indicator.id}`}
                accessibilityRole="button"
                accessibilityLabel={indicator.title}
                minHeight={48}
                gap="$3"
                py="$2"
                alignItems="center"
                onPress={() => {
                  const indicatorId = indicator.id;
                  if (isTradingViewNativeAnyIndicator(indicatorId)) {
                    onSelect(indicatorId);
                  }
                }}
              >
                <YStack flex={1} gap="$0.5">
                  <SizableText size="$bodyLgMedium">
                    {indicator.label}
                  </SizableText>
                  {indicator.description ? (
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {indicator.description}
                    </SizableText>
                  ) : null}
                </YStack>
                <Icon
                  name="ChevronRightOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              </XStack>
            ))}
        </YStack>
      ))}
    </YStack>
  );
}
