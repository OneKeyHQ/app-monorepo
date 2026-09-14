import { useMemo } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Icon,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type {
  EModalMarketRoutes,
  IModalMarketParamList,
} from '@onekeyhq/kit/src/views/Market/router/types';
import {
  useMarketTradingViewIndicatorSettingsPersistAtom,
  useSwapTradingViewIndicatorSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsAdapter';
import { localizeTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsLocalization';
import { mergeMobileIndicatorSettings } from './mobileIndicatorSettingsUtils';
import { showTradingViewNativeIndicatorSettingsDialog } from './showTradingViewNativeIndicatorSettingsDialog';
import { isTradingViewNativeAnyIndicator } from './utils/chartIndicators';

import type { RouteProp } from '@react-navigation/native';

function IndicatorSettingsPageContent({
  settingsState,
}: {
  settingsState: ReturnType<
    typeof useMarketTradingViewIndicatorSettingsPersistAtom
  >;
}) {
  const intl = useIntl();
  const [settings, setSettings] = settingsState;
  const value = useMemo(
    () =>
      localizeTradingViewNativeIndicatorSettingsValue(
        getTradingViewNativeIndicatorSettingsValue(settings),
        intl,
      ),
    [intl, settings],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_indicators })}
      />
      <Page.Body>
        <ScrollView testID="trading-view-mobile-indicator-settings-list">
          <YStack px="$5" py="$4" gap="$6">
            {(['main', 'sub'] as const).map((scope) => (
              <YStack key={scope} gap="$2">
                <SizableText size="$bodyMd" color="$textSubdued" py="$2">
                  {intl.formatMessage({
                    id:
                      scope === 'main'
                        ? ETranslations.market_main_chart_indicators
                        : ETranslations.market_sub_chart_indicators,
                  })}
                </SizableText>
                {value.indicators
                  .filter((indicator) => indicator.scope === scope)
                  .map((indicator) => (
                    <XStack
                      key={indicator.id}
                      testID={`trading-view-mobile-indicator-settings-${indicator.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={indicator.title}
                      minHeight={64}
                      gap="$3"
                      py="$3"
                      alignItems="center"
                      onPress={() => {
                        const indicatorId = indicator.id;
                        if (!isTradingViewNativeAnyIndicator(indicatorId)) {
                          return;
                        }
                        showTradingViewNativeIndicatorSettingsDialog({
                          displayMode: 'focused',
                          initialIndicatorId: indicatorId,
                          intl,
                          value,
                          onConfirm: (nextValue) =>
                            setSettings((current) =>
                              mergeMobileIndicatorSettings(
                                current,
                                nextValue,
                                indicatorId,
                              ),
                            ),
                        });
                      }}
                    >
                      <YStack flex={1} gap="$1">
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
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

function MarketIndicatorSettingsPage() {
  const settingsState = useMarketTradingViewIndicatorSettingsPersistAtom();
  return <IndicatorSettingsPageContent settingsState={settingsState} />;
}

function SwapIndicatorSettingsPage() {
  const settingsState = useSwapTradingViewIndicatorSettingsPersistAtom();
  return <IndicatorSettingsPageContent settingsState={settingsState} />;
}

export default function TradingViewMobileIndicatorSettingsPage() {
  const { params } =
    useRoute<
      RouteProp<
        IModalMarketParamList,
        EModalMarketRoutes.MarketIndicatorSettings
      >
    >();
  return params?.storageNamespace === 'swap' ? (
    <SwapIndicatorSettingsPage />
  ) : (
    <MarketIndicatorSettingsPage />
  );
}
