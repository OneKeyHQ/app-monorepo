import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page, useMedia } from '@onekeyhq/components';
import {
  TradingViewChartSettings,
  showTradingViewChartSettingsDialog,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings';
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
  'countdown',
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

function MarketChartSettingsContent({
  mobileLayout = false,
  usePageFooter = false,
  onClose,
}: {
  mobileLayout?: boolean;
  usePageFooter?: boolean;
  onClose?: () => void;
}) {
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
    <TradingViewChartSettings
      value={settingsValue}
      usePageFooter={usePageFooter}
      mobileLayout={mobileLayout}
      showChartType={mobileLayout}
      hiddenAppearanceSectionIds={NATIVE_HIDDEN_APPEARANCE_SECTION_IDS}
      hiddenOptionIds={
        platformEnv.isNative
          ? NATIVE_HIDDEN_OPTION_IDS
          : NON_NATIVE_HIDDEN_OPTION_IDS
      }
      onChange={mobileLayout ? handleMobileSettingsChange : undefined}
      onConfirm={updateChartSettings}
      onCancel={onClose}
      onConfirmSuccess={onClose}
    />
  );
}

export function showMarketChartSettingsDialog() {
  return showTradingViewChartSettingsDialog({
    renderContent: (closeDialog) => (
      <MarketChartSettingsContent onClose={closeDialog} />
    ),
  });
}

export default function MarketChartSettingsModal() {
  const intl = useIntl();
  const { md } = useMedia();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_chart_settings })}
      />
      <Page.Body minHeight={0}>
        <MarketChartSettingsContent usePageFooter={!md} mobileLayout={md} />
      </Page.Body>
    </Page>
  );
}
