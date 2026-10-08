import { TRADING_VIEW_PANEL_ICONS } from './multiChartIcons';

export interface ITradingViewPanelIconProps {
  name: keyof typeof TRADING_VIEW_PANEL_ICONS;
  color: string;
  size: number;
}

export function TradingViewPanelIcon({
  name,
  color,
  size,
}: ITradingViewPanelIconProps) {
  const url = `url("data:image/svg+xml,${encodeURIComponent(TRADING_VIEW_PANEL_ICONS[name])}")`;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: color,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  );
}
