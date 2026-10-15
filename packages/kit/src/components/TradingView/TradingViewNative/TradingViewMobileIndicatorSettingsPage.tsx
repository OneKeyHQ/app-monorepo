import { useCallback, useMemo } from 'react';

import { StackActions, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Icon,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import type { IModalMarketParamList } from '@onekeyhq/kit/src/views/Market/router/types';
import { useSwapTradingViewIndicatorSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  createTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeIndicatorSettings,
  getTradingViewNativeIndicatorSettingsValue,
} from './indicatorSettingsAdapter';
import { localizeTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsLocalization';
import { mergeMobileIndicatorSettings } from './mobileIndicatorSettingsUtils';
import { TradingViewMobileIndicatorEditor } from './TradingViewMobileIndicatorEditor';
import { useTradingViewNativeIndicatorSettings } from './useTradingViewNativeSettings';
import { isTradingViewNativeAnyIndicator } from './utils/chartIndicators';

import type { ITradingViewNativeStorageNamespace } from './types';
import type { ITradingViewIndicatorSettingsItem } from '../TradingViewChartControls/chartSettings';
import type { RouteProp } from '@react-navigation/native';

function IndicatorSettingsPageContent({
  settingsState,
}: {
  settingsState: ReturnType<typeof useTradingViewNativeIndicatorSettings>;
}) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IModalNavigationProp<IModalMarketParamList>>();
  const { params } =
    useRoute<
      RouteProp<
        IModalMarketParamList,
        EModalMarketRoutes.MarketIndicatorSettings
      >
    >();
  const [settings, setSettings] = settingsState;
  const value = useMemo(
    () =>
      localizeTradingViewNativeIndicatorSettingsValue(
        getTradingViewNativeIndicatorSettingsValue(settings),
        intl,
      ),
    [intl, settings],
  );
  const defaults = useMemo(
    () =>
      localizeTradingViewNativeIndicatorSettingsValue(
        createTradingViewNativeIndicatorSettingsValue(),
        intl,
      ),
    [intl],
  );
  const selected = value.indicators.find(
    ({ id }) => id === params?.indicatorId,
  );
  const defaultIndicator = defaults.indicators.find(
    ({ id }) => id === params?.indicatorId,
  );
  const handleSave = useCallback(
    (indicator: ITradingViewIndicatorSettingsItem) => {
      const indicatorId = indicator.id;
      if (!isTradingViewNativeAnyIndicator(indicatorId)) {
        return;
      }
      const next = getTradingViewNativeIndicatorSettings({
        ...value,
        indicators: value.indicators.map((item) =>
          item.id === indicatorId ? indicator : item,
        ),
      });
      setSettings((current) =>
        mergeMobileIndicatorSettings(current, next, indicatorId),
      );
    },
    [setSettings, value],
  );
  const handleClose = useCallback(() => navigation.pop(), [navigation]);

  if (selected && defaultIndicator) {
    return (
      <TradingViewMobileIndicatorEditor
        key={selected.id}
        indicator={selected}
        defaultIndicator={defaultIndicator}
        onSave={handleSave}
        onClose={handleClose}
      />
    );
  }

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_indicators })}
      />
      <Page.Body>
        <ScrollView testID="trading-view-mobile-indicator-settings-list">
          <YStack px="$5" py="$2" gap="$4">
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
                {value.indicators
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
                        if (!isTradingViewNativeAnyIndicator(indicatorId)) {
                          return;
                        }
                        // The list and editor need separate entries for the same route.
                        navigation.dispatch(
                          StackActions.push(
                            EModalMarketRoutes.MarketIndicatorSettings,
                            {
                              storageNamespace:
                                params?.storageNamespace ?? 'market',
                              indicatorId,
                            } satisfies IModalMarketParamList[EModalMarketRoutes.MarketIndicatorSettings],
                          ),
                        );
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
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

function DefaultIndicatorSettingsPage({
  storageNamespace,
}: {
  storageNamespace?: ITradingViewNativeStorageNamespace;
}) {
  const settingsState = useTradingViewNativeIndicatorSettings(storageNamespace);
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
    <DefaultIndicatorSettingsPage storageNamespace={params?.storageNamespace} />
  );
}
