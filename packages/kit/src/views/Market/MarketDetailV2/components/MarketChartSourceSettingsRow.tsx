import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ITradingViewChartMode } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls';
import {
  CHART_DISPLAY_SELECT_WIDTH,
  SettingsRow,
  SettingsSelect,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings/TradingViewSettingsPrimitives';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const CHART_MODE_OPTIONS = [
  'native',
  'tradingView',
] as const satisfies readonly ITradingViewChartMode[];

export function MarketChartSourceSettingsRow({
  chartMode,
  isDisabled,
  onChartSwitch,
}: {
  chartMode: ITradingViewChartMode;
  isDisabled: boolean;
  onChartSwitch: () => void;
}) {
  const intl = useIntl();
  const title = intl.formatMessage({ id: ETranslations.market_chart });
  const optionLabels = useMemo(
    () => ({
      native: intl.formatMessage({ id: ETranslations.market_chart_original }),
      tradingView: 'TradingView',
    }),
    [intl],
  );

  return (
    <SettingsRow label={title} testID="market-chart-settings-chart-source-row">
      <SettingsSelect
        testID="chart-source"
        title={title}
        value={chartMode}
        options={CHART_MODE_OPTIONS}
        optionLabels={optionLabels}
        width={CHART_DISPLAY_SELECT_WIDTH}
        disabled={isDisabled}
        onChange={(nextChartMode) => {
          if (nextChartMode !== chartMode) {
            onChartSwitch();
          }
        }}
      />
    </SettingsRow>
  );
}
