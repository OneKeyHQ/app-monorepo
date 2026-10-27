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
import type { ITradingViewSettingsDialogRef } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings/TradingViewSettingsDialog';
import {
  getTradingViewChartSettingsValue,
  getTradingViewNativeChartSettings,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartSettingsAdapter';
import type { ITradingViewNativeStorageNamespace } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/types';
import { useTradingViewNativeChartSettings } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/useTradingViewNativeSettings';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
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
// Only charts that render the hover navigation bar offer its visibility toggle.
const NAVIGATION_BUTTONS_HIDDEN_OPTION_IDS = [
  'navigationButtons',
] as const satisfies NonNullable<
  ITradingViewChartSettingsProps['hiddenOptionIds']
>;
const NON_NATIVE_HIDDEN_OPTION_IDS = [
  ...NATIVE_HIDDEN_OPTION_IDS,
  'clickInteraction',
] as const satisfies NonNullable<
  ITradingViewChartSettingsProps['hiddenOptionIds']
>;

type IMarketChartSettingsContentProps = {
  dialogRef?: ITradingViewSettingsDialogRef;
  storageNamespace?: ITradingViewNativeStorageNamespace;
  mobileLayout?: boolean;
  usePageFooter?: boolean;
  showPreviousClose?: boolean;
  showNavigationButtons?: boolean;
  onClose?: () => void;
};

function MarketChartSettingsContent(props: IMarketChartSettingsContentProps) {
  const settingsState = useTradingViewNativeChartSettings(
    props.storageNamespace,
  );
  return <ChartSettingsContent {...props} settingsState={settingsState} />;
}

function ChartSettingsContent({
  dialogRef,
  settingsState,
  mobileLayout = false,
  usePageFooter = false,
  showPreviousClose = false,
  showNavigationButtons = false,
  onClose,
}: IMarketChartSettingsContentProps & {
  settingsState: ReturnType<typeof useTradingViewNativeChartSettings>;
}) {
  const [chartSettings, setChartSettings] = settingsState;
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
      ...(showNavigationButtons ? [] : NAVIGATION_BUTTONS_HIDDEN_OPTION_IDS),
    ],
    [showNavigationButtons, showPreviousClose],
  );
  const handleMobileSettingsChange = useCallback(
    (value: ITradingViewChartSettingsValue) => {
      void updateChartSettings(value);
    },
    [updateChartSettings],
  );

  return (
    <TradingViewChartSettings
      dialogRef={dialogRef}
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
  storageNamespace,
  showPreviousClose = false,
  showNavigationButtons = false,
}: {
  showPreviousClose?: boolean;
  showNavigationButtons?: boolean;
  storageNamespace?: ITradingViewNativeStorageNamespace;
} = {}) {
  return showTradingViewChartSettingsDialog({
    renderContent: (closeDialog, dialogRef) => (
      <MarketChartSettingsContent
        dialogRef={dialogRef}
        storageNamespace={storageNamespace}
        showPreviousClose={showPreviousClose}
        showNavigationButtons={showNavigationButtons}
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
          storageNamespace={route.params?.storageNamespace}
          usePageFooter={!md}
          mobileLayout={md}
          showPreviousClose={showPreviousClose}
        />
      </Page.Body>
    </Page>
  );
}
