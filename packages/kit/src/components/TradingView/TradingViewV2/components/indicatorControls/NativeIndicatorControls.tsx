import { memo } from 'react';

import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
  TradingViewIndicatorQuickBar,
} from '../../../TradingViewChartControls/indicatorSelector/NativeIndicatorQuickBar';

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
    onIndicatorsDialogPress,
    onControlInteraction,
    onTouchScroll,
  }: {
    nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData | null;
    nativeIndicatorState: ITradingViewNativeIndicatorState;
    maxSelectableSubIndicatorCount?: number;
    splitSections?: boolean;
    onIndicatorSelect: (indicatorName: string, desiredActive: boolean) => void;
    onIndicatorsDialogPress?: () => void;
    onControlInteraction?: () => void;
    onTouchScroll?: (deltaY: number) => void;
  }) => {
    const intl = useIntl();
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
        settingsControl={
          onIndicatorsDialogPress ? (
            <IconButton
              testID="trading-view-native-indicators-quick-bar-trigger"
              size="small"
              variant="tertiary"
              icon="ChartTrending2Outline"
              iconSize="$5"
              width="$10"
              height={TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT}
              accessibilityLabel={intl.formatMessage({
                id: ETranslations.market_indicators,
              })}
              onPress={onIndicatorsDialogPress}
            />
          ) : undefined
        }
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
