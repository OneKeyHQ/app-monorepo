import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page, useMedia } from '@onekeyhq/components';
import { TradingViewChartSettings } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings';
import type {
  ITradingViewChartSettingsProps,
  ITradingViewChartSettingsValue,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings';
import {
  getTradingViewChartSettingsValue,
  getTradingViewNativeChartSettings,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartSettingsAdapter';
import { useMarketTradingViewChartSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const NATIVE_HIDDEN_APPEARANCE_SECTION_IDS = [
  'events',
] as const satisfies NonNullable<
  ITradingViewChartSettingsProps['hiddenAppearanceSectionIds']
>;
const NATIVE_HIDDEN_OPTION_IDS = [
  'depth',
  'futureEvents',
  'pastEvents',
] as const satisfies NonNullable<
  ITradingViewChartSettingsProps['hiddenOptionIds']
>;
const NON_NATIVE_HIDDEN_OPTION_IDS = [
  ...NATIVE_HIDDEN_OPTION_IDS,
  'clickInteraction',
] as const satisfies NonNullable<
  ITradingViewChartSettingsProps['hiddenOptionIds']
>;

export default function MarketChartSettingsModal() {
  const intl = useIntl();
  const { md } = useMedia();
  const [chartSettings, setChartSettings] =
    useMarketTradingViewChartSettingsPersistAtom();
  const settingsValue = useMemo(
    () => getTradingViewChartSettingsValue(chartSettings),
    [chartSettings],
  );
  const updateChartSettings = useCallback(
    (value: ITradingViewChartSettingsValue) => {
      return setChartSettings((currentSettings) =>
        getTradingViewNativeChartSettings({ currentSettings, value }),
      );
    },
    [setChartSettings],
  );
  const handleMobileSettingsChange = useCallback(
    (value: ITradingViewChartSettingsValue) => {
      void updateChartSettings(value);
    },
    [updateChartSettings],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_chart_settings })}
      />
      <Page.Body minHeight={0}>
        <TradingViewChartSettings
          value={settingsValue}
          usePageFooter={!md}
          mobileLayout={md}
          hiddenAppearanceSectionIds={NATIVE_HIDDEN_APPEARANCE_SECTION_IDS}
          hiddenOptionIds={
            platformEnv.isNative
              ? NATIVE_HIDDEN_OPTION_IDS
              : NON_NATIVE_HIDDEN_OPTION_IDS
          }
          onChange={md ? handleMobileSettingsChange : undefined}
          onConfirm={updateChartSettings}
        />
      </Page.Body>
    </Page>
  );
}
