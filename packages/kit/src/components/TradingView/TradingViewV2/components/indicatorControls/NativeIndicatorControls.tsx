import { memo } from 'react';

import { TradingViewIndicatorQuickBar } from '../../../TradingViewChartControls/indicatorSelector/NativeIndicatorQuickBar';

import { useNativeIndicatorControls } from './hooks/useNativeIndicatorActiveValues';

import type { ITradingViewNativeIndicatorState } from './hooks/useNativeIndicatorActiveValues';
import type { ITradingViewNativeChartControlsConfigData } from '../../types';

export { TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT } from '../../../TradingViewChartControls/indicatorSelector/NativeIndicatorQuickBar';

export const TradingViewNativeIndicatorQuickBar = memo(
  ({
    nativeChartControlsConfig,
    nativeIndicatorState,
    maxSelectableSubIndicatorCount,
    splitSections = false,
    onIndicatorSelect,
    onControlInteraction,
    onTouchScroll,
  }: {
    nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
    nativeIndicatorState: ITradingViewNativeIndicatorState;
    maxSelectableSubIndicatorCount?: number;
    splitSections?: boolean;
    onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
    onControlInteraction?: () => void;
    onTouchScroll?: (deltaY: number) => void;
  }) => {
    const {
      activeIndicatorValues,
      mainIndicators,
      subIndicators,
      hasVisibleIndicators,
      canToggleIndicatorOn,
      handleIndicatorPress,
    } = useNativeIndicatorControls({
      nativeChartControlsConfig,
      nativeIndicatorState,
      maxSelectableSubIndicatorCount,
      onIndicatorSelect,
    });

    if (!hasVisibleIndicators) {
      return null;
    }

    return (
      <TradingViewIndicatorQuickBar
        activeIndicatorValues={activeIndicatorValues}
        mainIndicators={mainIndicators}
        subIndicators={subIndicators}
        canToggleIndicatorOn={canToggleIndicatorOn}
        onIndicatorPress={handleIndicatorPress}
        splitSections={splitSections}
        onControlInteraction={onControlInteraction}
        onTouchScroll={onTouchScroll}
      />
    );
  },
);

TradingViewNativeIndicatorQuickBar.displayName =
  'TradingViewNativeIndicatorQuickBar';

export {
  IndicatorListDialogContent,
  IndicatorPopover,
} from '../../../TradingViewChartControls/indicatorSelector/NativeIndicatorSelector';
