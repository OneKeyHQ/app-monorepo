import { Select, useTheme } from '@onekeyhq/components';

import { TradingViewPanelButton } from './TradingViewPanelButton';
import { TradingViewPanelIcon } from './TradingViewPanelIcon';

import type { ITradingViewLayoutSelectorProps } from './TradingViewLayoutSelector';

const LAYOUT_OPTIONS = [
  { label: '1 × 1', value: 1, icon: 'single' },
  { label: '1 × 2', value: 2, icon: 'columns' },
  { label: '2 × 2', value: 4, icon: 'grid' },
] as const;

export function TradingViewLayoutSelector({
  title,
  panelCount,
  icon,
  onChange,
}: ITradingViewLayoutSelectorProps) {
  const theme = useTheme();

  return (
    <Select
      testID="trading-view-chart-layout-select"
      title={title}
      value={panelCount}
      items={LAYOUT_OPTIONS.map((option) => ({
        label: option.label,
        value: option.value,
        leading: (
          <TradingViewPanelIcon
            name={option.icon}
            size={20}
            color={theme.iconSubdued.val}
          />
        ),
      }))}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ width: 180 }}
      renderTrigger={({ onPress }) => (
        <TradingViewPanelButton
          icon={icon}
          accessibilityLabel={title}
          testID="trading-view-chart-layout-trigger"
          onPress={onPress}
        />
      )}
    />
  );
}
