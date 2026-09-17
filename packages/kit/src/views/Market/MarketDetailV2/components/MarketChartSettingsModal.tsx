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
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useMarketTradingViewChartSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  EModalMarketRoutes,
  IModalMarketParamList,
} from '../../router/types';

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
// Prev close anchors on a stock's previous session close, so only stock detail
// charts offer it; every other chart keeps the option out of settings.
const PREVIOUS_CLOSE_HIDDEN_OPTION_IDS = [
  'previousClose',
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
  showPreviousClose = false,
  onClose,
}: {
  mobileLayout?: boolean;
  usePageFooter?: boolean;
  showPreviousClose?: boolean;
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
  const hiddenOptionIds = useMemo<
    NonNullable<ITradingViewChartSettingsProps['hiddenOptionIds']>
  >(
    () => [
      ...(platformEnv.isNative
        ? NATIVE_HIDDEN_OPTION_IDS
        : NON_NATIVE_HIDDEN_OPTION_IDS),
      ...(showPreviousClose ? [] : PREVIOUS_CLOSE_HIDDEN_OPTION_IDS),
    ],
    [showPreviousClose],
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
      hiddenOptionIds={hiddenOptionIds}
      onChange={mobileLayout ? handleMobileSettingsChange : undefined}
      onConfirm={updateChartSettings}
      onCancel={onClose}
      onConfirmSuccess={onClose}
    />
  );
}

export function showMarketChartSettingsDialog({
  showPreviousClose = false,
}: {
  showPreviousClose?: boolean;
} = {}) {
  return showTradingViewChartSettingsDialog({
    renderContent: (closeDialog) => (
      <MarketChartSettingsContent
        showPreviousClose={showPreviousClose}
        onClose={closeDialog}
      />
    ),
  });
}

export default function MarketChartSettingsModal() {
  const intl = useIntl();
  const { md } = useMedia();
  const route = useAppRoute<
    IModalMarketParamList,
    EModalMarketRoutes.MarketChartSettings
  >();
  const showPreviousClose = route.params?.showPreviousClose ?? false;

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.market_chart_settings })}
      />
      <Page.Body minHeight={0}>
        <MarketChartSettingsContent
          usePageFooter={!md}
          mobileLayout={md}
          showPreviousClose={showPreviousClose}
        />
      </Page.Body>
    </Page>
  );
}
