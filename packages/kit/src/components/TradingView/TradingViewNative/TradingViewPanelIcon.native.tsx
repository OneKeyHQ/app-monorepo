import { SvgXml } from 'react-native-svg';

import { TRADING_VIEW_PANEL_ICONS } from './multiChartIcons';

import type { ITradingViewPanelIconProps } from './TradingViewPanelIcon';

export function TradingViewPanelIcon({
  name,
  color,
  size,
}: ITradingViewPanelIconProps) {
  return (
    <SvgXml
      xml={TRADING_VIEW_PANEL_ICONS[name]}
      width={size}
      height={size}
      color={color}
    />
  );
}
