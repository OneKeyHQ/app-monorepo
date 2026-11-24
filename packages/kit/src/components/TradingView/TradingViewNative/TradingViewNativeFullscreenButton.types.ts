import type { ITradingViewMobileControlsAppearance } from './types';

export interface ITradingViewNativeFullscreenButtonProps {
  appearance?: ITradingViewMobileControlsAppearance['fullscreenButton'];
  chartHeight: number;
  isFullscreen: boolean;
  onPress: () => void;
  timeAxisHeight: number;
  visibleSubIndicatorCount: number;
}
