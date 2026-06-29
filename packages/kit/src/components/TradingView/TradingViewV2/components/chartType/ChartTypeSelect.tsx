import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, IconButton, Select } from '@onekeyhq/components';

import {
  HEADER_ICON_BUTTON_STYLE_PROPS,
  formatChartTypeOptionLabel,
  getChartTypeIconName,
} from '../utils/NativeChartControlsShared';

import type { ITradingViewChartTypeOption } from '../../types';

export function ChartTypeSelect({
  title,
  chartTypes,
  activeChartType,
  onChartTypeChange,
}: {
  title: string;
  chartTypes: ITradingViewChartTypeOption[];
  activeChartType: number | undefined;
  onChartTypeChange: (chartType: number) => void;
}) {
  const intl = useIntl();
  const items = useMemo(
    () =>
      chartTypes.map((chartType) => ({
        label: formatChartTypeOptionLabel(intl, chartType),
        value: chartType.value,
        leading: (
          <Icon
            name={getChartTypeIconName(chartType)}
            size="$5"
            color="$iconSubdued"
          />
        ),
      })),
    [chartTypes, intl],
  );
  const value = activeChartType ?? chartTypes[0]?.value;
  const selectedChartType =
    chartTypes.find((chartType) => chartType.value === value) ?? chartTypes[0];

  return (
    <Select
      testID="trading-view-native-chart-type-select"
      title={title}
      items={items}
      value={value}
      onChange={(chartType) => {
        if (typeof chartType === 'number') {
          onChartTypeChange(chartType);
        }
      }}
      placement="bottom-end"
      floatingPanelProps={{
        width: '$56',
      }}
      renderTrigger={({ onPress, disabled }) => (
        <IconButton
          testID="trading-view-native-chart-type-select-trigger"
          size="small"
          variant="tertiary"
          icon={getChartTypeIconName(selectedChartType)}
          iconSize="$5"
          title={title}
          disabled={disabled}
          onPress={onPress}
          {...HEADER_ICON_BUTTON_STYLE_PROPS}
        />
      )}
    />
  );
}
