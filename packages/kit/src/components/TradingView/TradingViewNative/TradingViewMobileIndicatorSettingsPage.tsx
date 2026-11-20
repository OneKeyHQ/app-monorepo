import { useCallback, useMemo } from 'react';

import { StackActions, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Page, ScrollView } from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router/types';
import type { IModalMarketParamList } from '@onekeyhq/kit/src/views/Market/router/types';
import { useSwapTradingViewIndicatorSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  createTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeIndicatorSettingsValue,
} from './indicatorSettingsAdapter';
import { localizeTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsLocalization';
import { createMobileIndicatorSettingsUpdater } from './mobileIndicatorSettingsUtils';
import { TradingViewMobileIndicatorEditor } from './TradingViewMobileIndicatorEditor';
import { TradingViewMobileIndicatorList } from './TradingViewMobileIndicatorList';
import { useTradingViewNativeIndicatorSettings } from './useTradingViewNativeSettings';

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
      const updater = createMobileIndicatorSettingsUpdater(value, indicator);
      if (!updater) {
        return;
      }
      return setSettings(updater);
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
          <TradingViewMobileIndicatorList
            px="$5"
            py="$2"
            indicators={value.indicators}
            onSelect={(indicatorId) => {
              // The list and editor need separate entries for the same route.
              navigation.dispatch(
                StackActions.push(EModalMarketRoutes.MarketIndicatorSettings, {
                  storageNamespace: params?.storageNamespace ?? 'market',
                  indicatorId,
                } satisfies IModalMarketParamList[EModalMarketRoutes.MarketIndicatorSettings]),
              );
            }}
          />
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
