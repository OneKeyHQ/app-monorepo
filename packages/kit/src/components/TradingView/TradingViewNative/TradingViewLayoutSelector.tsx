import { Select } from '@onekeyhq/components';

import { TradingViewPanelButton } from './TradingViewPanelButton';

import type { ITradingViewPanelIconProps } from './TradingViewPanelIcon';

export interface ITradingViewLayoutSelectorProps {
  title: string;
  panelCount: number;
  icon: ITradingViewPanelIconProps['name'];
  onChange: (value: number) => void;
}

export function TradingViewLayoutSelector({
  title,
  panelCount,
  icon,
  onChange,
}: ITradingViewLayoutSelectorProps) {
  return (
    <Select
      testID="trading-view-chart-layout-select"
      title={title}
      value={panelCount}
      items={[
        { label: '1 × 1', value: 1 },
        { label: '1 × 2', value: 2 },
        { label: '2 × 2', value: 4 },
      ]}
      onChange={onChange}
      placement="bottom-end"
      floatingPanelProps={{ width: 160 }}
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
